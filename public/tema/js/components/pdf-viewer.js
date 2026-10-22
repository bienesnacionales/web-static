/**
 * Componente global — Visor de PDF.
 *
 * Tres cometidos, en este orden de antigüedad:
 *
 * 1. **Carga diferida** (2026-09-11). Un visor con `lazy` —el de
 *    `partials/pdf-modal.php`— nace con la URL en `data-mbn-pdf-src` y sin
 *    `data`, así que el navegador no pide el documento hasta que se abre el
 *    modal que lo contiene. Se escucha `show.bs.modal` en el documento: los
 *    eventos de Bootstrap burbujean, y un modal que llegue después al DOM
 *    queda cubierto igual.
 *
 * 2. **Elegir entre dos URL** (2026-10-07). El visor diferido trae también
 *    `data-mbn-pdf-src-narrow`, la misma dirección con los parámetros de
 *    apertura de pantalla estrecha (`view=Fit`): una página A4 al `zoom=90` de
 *    siempre no cabe por debajo de `md`. El ancho se mira al abrir, una vez.
 *
 * 3. **Pintar el PDF con PDF.js donde el visor del navegador no sirve**
 *    (2026-10-08). El `<object>` depende del visor integrado, y en móvil ese
 *    visor falla de dos maneras: **Chrome en Android no tiene** —se ve la
 *    reserva, «Este navegador no puede mostrar el documento»— y **Safari en
 *    iOS pinta el PDF pero no deja desplazarse por él** dentro de la página.
 *    En esos casos el `<object>` se sustituye por un visor propio: las páginas
 *    en `<canvas>`, una debajo de otra, ajustadas al ancho, dentro de una caja
 *    que se desplaza como cualquier otra, con botones de zoom, contador de
 *    página y una capa de texto que deja seleccionar y que lee el lector de
 *    pantalla.
 *
 *    **Cuándo se usa cada uno** (`usaVisorNativo()`): el nativo solo cuando el
 *    navegador declara visor (`navigator.pdfViewerEnabled`) y **no hay ningún
 *    puntero táctil** (`any-pointer: coarse`). Es decir, el escritorio de
 *    siempre conserva el visor del navegador —con su búsqueda, impresión y
 *    descarga—, y teléfonos y tabletas, incluido el iPad con teclado, pasan a
 *    PDF.js. `window.mbnPdfViewerMode = 'pdfjs' | 'native'` lo fuerza, para el
 *    harness.
 *
 *    PDF.js vive en `assets/vendor/pdfjs/<versión>/` —build `legacy`, sin CDN
 *    (§8)— y **solo se descarga cuando hace falta**: al abrir el modal, o al
 *    cargar una página con un visor suelto en un dispositivo táctil. Los
 *    archivos van con extensión `.js` y no `.mjs`: nginx no conoce `.mjs`, lo
 *    serviría como `application/octet-stream` y el navegador se niega a
 *    ejecutar un módulo con ese tipo.
 *
 * La ruta de la librería y los textos llegan de PHP en `window.mbnPdfViewer`
 * (`mbn_component_pdf_viewer_script_config()`); sin ellos, la ruta se deduce
 * de este mismo script y los textos caen al castellano de abajo.
 *
 * @package mbn
 */

( function () {
	'use strict';

	var ESTRECHO = '(max-width: 767.98px)';

	/** Niveles de zoom, relativos al ajuste al ancho (1 = «100 %»). */
	var ZOOMS = [ 0.5, 0.75, 1, 1.25, 1.5, 2, 3 ];
	var ZOOM_INICIAL = 2;

	/** Relleno de la caja de páginas; tiene que coincidir con el CSS. */
	var RELLENO = 16;

	/**
	 * Píxeles máximos de un canvas. Safari en iOS no pinta los que pasan de
	 * 16 777 216 (4096²): el canvas sale en blanco sin error.
	 */
	var MAX_PIXELES = 16777216;

	var config = window.mbnPdfViewer || {};

	var TEXTOS = {
		loading: 'Cargando documento…',
		error: 'No se pudo mostrar el documento.',
		zoomIn: 'Acercar',
		zoomOut: 'Alejar',
		zoom: 'Zoom: %s',
		page: 'Página %1$s de %2$s',
		download: 'Descargar'
	};

	Object.keys( config.text || {} ).forEach( function ( clave ) {
		TEXTOS[ clave ] = config.text[ clave ];
	} );

	/**
	 * Carpeta de PDF.js. La imprime PHP; sin ella, se resuelve contra la URL de
	 * este script, que vive en `assets/js/components/`.
	 */
	var BASE = config.base || ( function () {
		var propio = document.currentScript || document.querySelector( 'script[src*="/assets/js/components/pdf-viewer.js"]' );

		try {
			return new URL( '../../vendor/pdfjs/6.4.299/', propio ? propio.src : window.location.href ).href;
		} catch ( e ) {
			return '';
		}
	} )();

	function formato( plantilla ) {
		var args = Array.prototype.slice.call( arguments, 1 );

		return plantilla
			.replace( /%(\d)\$s/g, function ( m, n ) {
				return String( args[ n - 1 ] );
			} )
			.replace( '%s', String( args[ 0 ] ) );
	}

	function el( etiqueta, clase ) {
		var nodo = document.createElement( etiqueta );

		if ( clase ) {
			nodo.className = clase;
		}

		return nodo;
	}

	/**
	 * ¿Sirve el visor del navegador? Ver el punto 3 del docblock.
	 *
	 * @return {boolean}
	 */
	function usaVisorNativo() {
		if ( 'native' === window.mbnPdfViewerMode ) {
			return true;
		}

		if ( 'pdfjs' === window.mbnPdfViewerMode ) {
			return false;
		}

		var tactil = !! ( window.matchMedia && window.matchMedia( '(any-pointer: coarse)' ).matches );

		return true === navigator.pdfViewerEnabled && ! tactil;
	}

	/* ---------------------------------------------------------------------
	 * PDF.js: se importa una sola vez, la primera que se necesita.
	 * ------------------------------------------------------------------ */

	var libreria = null;

	function cargaLibreria() {
		if ( ! libreria ) {
			libreria = import( BASE + 'pdf.min.js' ).then( function ( lib ) {
				lib.GlobalWorkerOptions.workerSrc = BASE + 'pdf.worker.min.js';

				return lib;
			} );

			// Un fallo de red no deja la librería rota para el siguiente intento.
			libreria.catch( function () {
				libreria = null;
			} );
		}

		return libreria;
	}

	/* ---------------------------------------------------------------------
	 * El visor propio.
	 * ------------------------------------------------------------------ */

	/**
	 * Sustituye un `<object>` del visor por las páginas pintadas con PDF.js.
	 *
	 * @param {HTMLObjectElement} frame El `<object>` del componente.
	 * @return {HTMLElement} La caja que lo sustituye; lleva `mbnPdf.ajusta()`.
	 */
	function montaDocumento( frame ) {
		var url      = ( frame.getAttribute( 'data-mbn-pdf-src' ) || frame.getAttribute( 'data' ) || '' ).split( '#' )[ 0 ];
		var etiqueta = frame.getAttribute( 'title' ) || '';
		var reserva  = frame.querySelector( '.mbn-notice' );
		var enModal  = !! frame.closest( '.mbn-pdf-modal' );

		// Las dos clases: la del panel (alto, radio, fondo y, en el modal, el
		// reparto del flex) y la propia, que lo convierte en columna.
		var raiz = el( 'div', 'mbn-pdf-viewer__frame mbn-pdf-viewer__doc' );
		raiz.setAttribute( 'style', frame.getAttribute( 'style' ) || '' );

		var barra = el( 'div', 'mbn-pdf-viewer__bar' );
		barra.hidden = true;

		var menos = el( 'button', 'mbn-pdf-viewer__zoom' );
		menos.type = 'button';
		menos.textContent = '−';
		menos.setAttribute( 'aria-label', TEXTOS.zoomOut );

		var mas = el( 'button', 'mbn-pdf-viewer__zoom' );
		mas.type = 'button';
		mas.textContent = '+';
		mas.setAttribute( 'aria-label', TEXTOS.zoomIn );

		// El porcentaje se anuncia al cambiar: es la respuesta a los botones.
		var nivel = el( 'span', 'mbn-pdf-viewer__scale' );
		nivel.setAttribute( 'role', 'status' );

		var contador = el( 'span', 'mbn-pdf-viewer__count' );

		barra.appendChild( menos );
		barra.appendChild( nivel );
		barra.appendChild( mas );
		barra.appendChild( contador );

		// Dentro del modal, «Descargar» ya está en su cabecera.
		if ( ! enModal && url ) {
			var descarga = el( 'a', 'mbn-pdf-viewer__download' );
			var oculto   = el( 'span', 'visually-hidden' );

			descarga.href = url;
			descarga.setAttribute( 'download', '' );
			descarga.textContent = TEXTOS.download;
			oculto.textContent = ': ' + etiqueta;
			descarga.appendChild( oculto );
			barra.appendChild( descarga );
		}

		var hoja = el( 'div', 'mbn-pdf-viewer__pages' );
		hoja.setAttribute( 'role', 'region' );
		hoja.setAttribute( 'aria-label', etiqueta );
		hoja.tabIndex = 0;

		var aviso = el( 'p', 'mbn-pdf-viewer__status' );
		aviso.setAttribute( 'role', 'status' );
		aviso.textContent = TEXTOS.loading;
		hoja.appendChild( aviso );

		raiz.appendChild( barra );
		raiz.appendChild( hoja );
		frame.parentNode.replaceChild( raiz, frame );

		var estado = {
			lib: null,
			pdf: null,
			paginas: [],
			base: null,
			ancho: 0,
			zoom: ZOOM_INICIAL,
			actual: 0
		};

		function fallo() {
			barra.hidden = true;
			hoja.textContent = '';

			if ( reserva ) {
				hoja.appendChild( reserva );
			} else {
				aviso.textContent = TEXTOS.error;
				hoja.appendChild( aviso );
			}
		}

		function anchoUtil() {
			return Math.max( 0, hoja.clientWidth - 2 * RELLENO );
		}

		function escala() {
			var ajuste = estado.base && estado.ancho > 0 ? estado.ancho / estado.base.w : 1;

			return ajuste * ZOOMS[ estado.zoom ];
		}

		function coloca( p ) {
			var e = escala();

			p.el.style.width = Math.floor( p.w * e ) + 'px';
			p.el.style.height = Math.floor( p.h * e ) + 'px';
			p.el.style.setProperty( '--total-scale-factor', String( e ) );
		}

		function suelta( p ) {
			p.version++;

			if ( p.tarea ) {
				p.tarea.cancel();
				p.tarea = null;
			}

			if ( p.capa ) {
				p.capa.remove();
				p.capa = null;
			}

			if ( p.canvas ) {
				p.canvas.width = 0;
				p.canvas.height = 0;
				p.canvas.remove();
				p.canvas = null;
			}

			p.pintada = false;
		}

		function pinta( p ) {
			if ( p.pintada || p.tarea ) {
				return;
			}

			var version = ++p.version;

			estado.pdf.getPage( p.n ).then( function ( page ) {
				if ( version !== p.version ) {
					return;
				}

				// Las páginas de otro tamaño que la primera se corrigen aquí.
				var natural = page.getViewport( { scale: 1 } );

				if ( Math.abs( natural.width - p.w ) > 0.5 || Math.abs( natural.height - p.h ) > 0.5 ) {
					p.w = natural.width;
					p.h = natural.height;
					coloca( p );
				}

				var vp  = page.getViewport( { scale: escala() } );
				var dpr = Math.min( window.devicePixelRatio || 1, 2 );

				if ( vp.width * vp.height * dpr * dpr > MAX_PIXELES ) {
					dpr = Math.sqrt( MAX_PIXELES / ( vp.width * vp.height ) );
				}

				// Se pinta en un canvas nuevo y se cambia al terminar: al hacer
				// zoom, el anterior queda estirado por CSS en vez de en blanco.
				var canvas = el( 'canvas', 'mbn-pdf-viewer__canvas' );
				canvas.width = Math.floor( vp.width * dpr );
				canvas.height = Math.floor( vp.height * dpr );
				canvas.setAttribute( 'aria-hidden', 'true' );

				p.tarea = page.render( {
					canvas: canvas,
					viewport: vp,
					transform: 1 !== dpr ? [ dpr, 0, 0, dpr, 0, 0 ] : null
				} );

				return p.tarea.promise.then( function () {
					p.tarea = null;

					if ( version !== p.version ) {
						return;
					}

					if ( p.canvas ) {
						p.canvas.width = 0;
						p.canvas.remove();
					}

					p.el.insertBefore( canvas, p.el.firstChild );
					p.canvas = canvas;
					p.pintada = true;

					// La capa de texto: transparente sobre el canvas, para
					// seleccionar y para el lector de pantalla.
					var capa = el( 'div', 'mbn-pdf-viewer__text' );

					new estado.lib.TextLayer( {
						textContentSource: page.streamTextContent(),
						container: capa,
						viewport: vp
					} ).render().catch( function () {} );

					if ( p.capa ) {
						p.capa.remove();
					}

					p.el.appendChild( capa );
					p.capa = capa;
				} );
			} ).catch( function ( error ) {
				p.tarea = null;

				// Cancelar al hacer zoom o al alejarse no es un error.
				if ( ! error || 'RenderingCancelledException' !== error.name ) {
					p.pintada = false;
				}
			} );
		}

		function actualizaBarra() {
			nivel.textContent = formato( TEXTOS.zoom, Math.round( ZOOMS[ estado.zoom ] * 100 ) + ' %' );
			menos.setAttribute( 'aria-disabled', 0 === estado.zoom ? 'true' : 'false' );
			mas.setAttribute( 'aria-disabled', ZOOMS.length - 1 === estado.zoom ? 'true' : 'false' );
		}

		function actualizaContador() {
			var tope  = hoja.scrollTop + hoja.clientHeight / 3;
			var vista = 0;

			for ( var i = 0; i < estado.paginas.length; i++ ) {
				if ( estado.paginas[ i ].el.offsetTop <= tope ) {
					vista = i;
				} else {
					break;
				}
			}

			if ( vista !== estado.actual || ! contador.textContent ) {
				estado.actual = vista;
				contador.textContent = formato( TEXTOS.page, vista + 1, estado.paginas.length );
			}
		}

		/**
		 * Recoloca todas las páginas a la escala actual conservando la
		 * posición relativa del desplazamiento, y repinta las que se ven.
		 */
		function recoloca() {
			var proporcion = hoja.scrollHeight > 0 ? hoja.scrollTop / hoja.scrollHeight : 0;

			estado.paginas.forEach( function ( p ) {
				p.version++;

				if ( p.tarea ) {
					p.tarea.cancel();
					p.tarea = null;
				}

				p.pintada = false;
				coloca( p );

				if ( ! p.visible ) {
					suelta( p );
				}
			} );

			hoja.scrollTop = proporcion * hoja.scrollHeight;

			estado.paginas.forEach( function ( p ) {
				if ( p.visible ) {
					pinta( p );
				}
			} );

			actualizaBarra();
			actualizaContador();
		}

		function ajusta() {
			var ancho = anchoUtil();

			if ( ! estado.pdf || ancho < 1 || Math.abs( ancho - estado.ancho ) < 1 ) {
				return;
			}

			estado.ancho = ancho;
			recoloca();
		}

		function cambiaZoom( paso ) {
			var nuevo = Math.min( ZOOMS.length - 1, Math.max( 0, estado.zoom + paso ) );

			if ( nuevo !== estado.zoom ) {
				estado.zoom = nuevo;
				recoloca();
			}
		}

		menos.addEventListener( 'click', function () {
			cambiaZoom( -1 );
		} );

		mas.addEventListener( 'click', function () {
			cambiaZoom( 1 );
		} );

		var pendiente = false;

		hoja.addEventListener( 'scroll', function () {
			if ( pendiente ) {
				return;
			}

			pendiente = true;
			window.requestAnimationFrame( function () {
				pendiente = false;
				actualizaContador();
			} );
		}, { passive: true } );

		function arranca( pdf, primera ) {
			var natural = primera.getViewport( { scale: 1 } );

			estado.pdf = pdf;
			estado.base = { w: natural.width, h: natural.height };
			estado.ancho = anchoUtil();
			hoja.textContent = '';

			var observador = 'IntersectionObserver' in window
				? new IntersectionObserver( function ( entradas ) {
					entradas.forEach( function ( entrada ) {
						var p = entrada.target.mbnPagina;

						p.visible = entrada.isIntersecting;

						if ( p.visible ) {
							pinta( p );
						} else {
							suelta( p );
						}
					} );
				}, { root: hoja, rootMargin: '100% 0px' } )
				: null;

			for ( var n = 1; n <= pdf.numPages; n++ ) {
				var nodo = el( 'div', 'mbn-pdf-viewer__page' );
				var p = {
					n: n,
					el: nodo,
					w: estado.base.w,
					h: estado.base.h,
					version: 0,
					visible: ! observador,
					pintada: false
				};

				nodo.mbnPagina = p;
				nodo.setAttribute( 'role', 'group' );
				nodo.setAttribute( 'aria-label', formato( TEXTOS.page, n, pdf.numPages ) );
				coloca( p );
				hoja.appendChild( nodo );
				estado.paginas.push( p );

				if ( observador ) {
					observador.observe( nodo );
				} else {
					pinta( p );
				}
			}

			barra.hidden = false;
			actualizaBarra();
			actualizaContador();

			// Girar el teléfono, abrir un panel que estaba oculto: cualquier
			// cambio del ancho vuelve a ajustar las páginas.
			if ( 'ResizeObserver' in window ) {
				new ResizeObserver( function () {
					ajusta();
				} ).observe( hoja );
			} else {
				window.addEventListener( 'resize', ajusta );
			}
		}

		if ( ! url || ! BASE ) {
			fallo();
		} else {
			cargaLibreria().then( function ( lib ) {
				estado.lib = lib;

				return lib.getDocument( {
					url: url,
					standardFontDataUrl: BASE + 'standard_fonts/',
					wasmUrl: BASE + 'wasm/',
					iccUrl: BASE + 'iccs/',
					isEvalSupported: false,
					enableXfa: false
				} ).promise;
			} ).then( function ( pdf ) {
				return pdf.getPage( 1 ).then( function ( primera ) {
					arranca( pdf, primera );
				} );
			} ).catch( fallo );
		}

		raiz.mbnPdf = { ajusta: ajusta };

		return raiz;
	}

	/* ---------------------------------------------------------------------
	 * Enganches.
	 * ------------------------------------------------------------------ */

	/**
	 * URL que le toca al visor nativo según el ancho de la ventana.
	 *
	 * @param {Element} frame El `<object>` del visor.
	 * @return {string} URL con sus parámetros de apertura.
	 */
	function fuente( frame ) {
		var estrecha = frame.getAttribute( 'data-mbn-pdf-src-narrow' );

		if ( estrecha && window.matchMedia && window.matchMedia( ESTRECHO ).matches ) {
			return estrecha;
		}

		return frame.getAttribute( 'data-mbn-pdf-src' );
	}

	// Al abrir el modal: el visor nativo recibe su URL; para PDF.js se
	// adelanta la descarga de la librería mientras dura la animación.
	document.addEventListener( 'show.bs.modal', function ( event ) {
		var modal = event.target;

		if ( ! modal || ! modal.querySelectorAll ) {
			return;
		}

		var visores = modal.querySelectorAll( 'object[data-mbn-pdf-src]' );

		if ( ! visores.length ) {
			return;
		}

		if ( ! usaVisorNativo() ) {
			cargaLibreria().catch( function () {} );

			return;
		}

		Array.prototype.forEach.call( visores, function ( frame ) {
			if ( ! frame.hasAttribute( 'data' ) ) {
				frame.setAttribute( 'data', fuente( frame ) );
			}
		} );
	} );

	// PDF.js necesita el ancho real, que el modal solo tiene ya abierto.
	document.addEventListener( 'shown.bs.modal', function ( event ) {
		var modal = event.target;

		if ( ! modal || ! modal.querySelectorAll || usaVisorNativo() ) {
			return;
		}

		Array.prototype.forEach.call( modal.querySelectorAll( 'object[data-mbn-pdf-src]' ), montaDocumento );

		Array.prototype.forEach.call( modal.querySelectorAll( '.mbn-pdf-viewer__doc' ), function ( raiz ) {
			if ( raiz.mbnPdf ) {
				raiz.mbnPdf.ajusta();
			}
		} );
	} );

	// Los visores sueltos —«Código de Ética»— se cambian al cargar la página.
	function init() {
		if ( usaVisorNativo() ) {
			return;
		}

		Array.prototype.forEach.call(
			document.querySelectorAll( 'object.mbn-pdf-viewer__frame:not([data-mbn-pdf-src])' ),
			function ( frame ) {
				if ( ! frame.closest( '.modal' ) ) {
					montaDocumento( frame );
				}
			}
		);
	}

	if ( 'loading' === document.readyState ) {
		document.addEventListener( 'DOMContentLoaded', init );
	} else {
		init();
	}
} )();
