/* gestiona las interacciones de visualización de documentos PDF */
( function () {
	'use strict';

	var ESTRECHO = '(max-width: 767.98px)';

	// niveles de zoom, relativos al ajuste al ancho (1 = «100 %»)
	var ZOOMS = [ 0.5, 0.75, 1, 1.25, 1.5, 2, 3 ];
	var ZOOM_INICIAL = 2;

	// define el relleno de las páginas conforme a los estilos del visor
	var RELLENO = 16;

	// limita la cantidad de píxeles del lienzo de renderizado
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

	// carpeta de PDF.js
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

	// comprueba la compatibilidad del visor PDF integrado del navegador
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

	// carga PDF.js bajo demanda y reutiliza la instancia disponible

	var libreria = null;

	function cargaLibreria() {
		if ( ! libreria ) {
			libreria = import( BASE + 'pdf.min.js' ).then( function ( lib ) {
				lib.GlobalWorkerOptions.workerSrc = BASE + 'pdf.worker.min.js';

				return lib;
			} );

			// permite reintentar la carga de la biblioteca después de un error de red
			libreria.catch( function () {
				libreria = null;
			} );
		}

		return libreria;
	}

	// inicializa el visor PDF del componente

	// sustituye el objeto PDF por las páginas renderizadas con PDF.js
	function montaDocumento( frame ) {
		var url      = ( frame.getAttribute( 'data-mbn-pdf-src' ) || frame.getAttribute( 'data' ) || '' ).split( '#' )[ 0 ];
		var etiqueta = frame.getAttribute( 'title' ) || '';
		var reserva  = frame.querySelector( '.mbn-notice' );
		var enModal  = !! frame.closest( '.mbn-pdf-modal' );

		// conserva las clases del panel y configura la distribución vertical del visor
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

		// anuncia los cambios del porcentaje de ampliación en la región de estado
		var nivel = el( 'span', 'mbn-pdf-viewer__scale' );
		nivel.setAttribute( 'role', 'status' );

		var contador = el( 'span', 'mbn-pdf-viewer__count' );

		barra.appendChild( menos );
		barra.appendChild( nivel );
		barra.appendChild( mas );
		barra.appendChild( contador );

		// reutiliza el enlace de descarga disponible en la cabecera del diálogo
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

				// ajusta individualmente las dimensiones de cada página del documento
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

				// renderiza en un lienzo nuevo y conserva la página visible hasta completar la sustitución
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

					// superpone la capa de texto para permitir selección y lectura accesible
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

				// descarta las tareas de renderizado canceladas por cambios de escala o visibilidad
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

		// ajusta las páginas a la escala actual y conserva la posición relativa del documento
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

			// recalcula el tamaño de las páginas cuando cambia el ancho del visor
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



	// selecciona la dirección del visor nativo según el ancho disponible
	function fuente( frame ) {
		var estrecha = frame.getAttribute( 'data-mbn-pdf-src-narrow' );

		if ( estrecha && window.matchMedia && window.matchMedia( ESTRECHO ).matches ) {
			return estrecha;
		}

		return frame.getAttribute( 'data-mbn-pdf-src' );
	}

	// prepara la dirección o la biblioteca PDF durante la apertura del diálogo
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

	// calcula el ancho de PDF.js después de completar la apertura del diálogo
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

	// inicializa los visores integrados directamente en el contenido de la página
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
