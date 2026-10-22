/**
 * Listados de noticias y de trámites sin servidor.
 *
 * El tema pide cada vista de estos listados (filtro, búsqueda, página) a
 * `admin-ajax.php`. Este sitio es estático, así que aquí se intercepta esa
 * petición y se responde en el navegador, con el mismo formato que devolvía
 * WordPress, a partir de los índices de `/datos/`. Los scripts del tema
 * (`news-search.js` y `procedure-search.js`) quedan intactos: siguen
 * manejando historial, foco, chips y cancelaciones como antes.
 *
 * Lo único que añade este archivo es la vista inicial: si la página se abre
 * con filtros en la URL (`/noticias/?categoria=cultura&pagina=3`), la pinta al
 * cargar, porque un servidor estático entrega siempre la página 1.
 *
 * Tiene que cargarse antes que los scripts del tema.
 */
( function () {
	'use strict';

	var POR_PAGINA = 12;

	var LISTADOS = {
		noticias: {
			raiz: '[data-mbn-news-search]',
			prefijo: 'mbn-news-search',
			filtro: 'categoria',
			datos: '/datos/noticias.json',
			plural: 'noticias',
			vacio: function ( termino ) {
				return termino
					? 'No encontramos noticias para «' + termino + '». Prueba con otras palabras o quita el filtro de categoría.'
					: 'No encontramos noticias en esta categoría.';
			},
			aviso: function ( total ) {
				return total === 1 ? '1 noticia encontrada.' : total + ' noticias encontradas.';
			},
		},
		tramites: {
			raiz: '[data-mbn-procedure-search]',
			prefijo: 'mbn-procedure-search',
			filtro: 'tipo',
			datos: '/datos/tramites.json',
			plural: 'trámites',
			vacio: function ( termino ) {
				return termino
					? 'No encontramos trámites para «' + termino + '». Prueba con otras palabras o quita el filtro de tipo.'
					: 'No encontramos trámites de este tipo.';
			},
			aviso: function ( total ) {
				return total === 1 ? '1 trámite encontrado.' : total + ' trámites encontrados.';
			},
		},
	};

	var cache = {};

	function datos( cfg ) {
		if ( ! cache[ cfg.datos ] ) {
			cache[ cfg.datos ] = window.fetch( cfg.datos ).then( function ( r ) {
				if ( ! r.ok ) {
					throw new Error( 'HTTP ' + r.status );
				}
				return r.json();
			} );
		}
		return cache[ cfg.datos ];
	}

	/** Minúsculas y sin tildes: «Títulos» y «titulos» son la misma búsqueda. */
	function normaliza( texto ) {
		return String( texto || '' ).toLowerCase().normalize( 'NFD' ).replace( /[̀-ͯ]/g, '' );
	}

	function escapa( texto ) {
		return String( texto ).replace( /[&<>"]/g, function ( c ) {
			return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ c ];
		} );
	}

	/** URL pública de una vista: la base del listado más sus parámetros. */
	function urlPublica( base, cfg, estado, pagina ) {
		var url = new URL( base, window.location.href );
		if ( estado.filtro ) {
			url.searchParams.set( cfg.filtro, estado.filtro );
		}
		if ( pagina > 1 ) {
			url.searchParams.set( 'pagina', String( pagina ) );
		}
		if ( estado.buscar ) {
			url.searchParams.set( 'buscar', estado.buscar );
		}
		return url.pathname + url.search;
	}

	/** Paginación con el mismo marcado que el tema: primera, vecinas, última. */
	function paginacion( base, cfg, estado, total ) {
		var p = cfg.prefijo;
		var paginas = Math.ceil( total / POR_PAGINA );
		var actual = estado.pagina;

		if ( paginas <= 1 ) {
			return '';
		}

		function item( contenido ) {
			return '<li class="' + p + '__page-item">' + contenido + '</li>';
		}
		function chevron( lado ) {
			return '<img src="/tema/images/components/icon-chevron-' + lado + '.svg" alt="" aria-hidden="true" focusable="false" width="24" height="24" />';
		}
		function enlace( clase, destino, contenido ) {
			return '<a class="' + p + '__page ' + p + '__page--' + clase + '" href="' + escapa( urlPublica( base, cfg, estado, destino ) ) + '" data-' + p + '-page="' + destino + '">' + contenido + '</a>';
		}
		function inactivo( clase, contenido ) {
			return '<span class="' + p + '__page ' + p + '__page--' + clase + ' ' + p + '__page--disabled" aria-hidden="true">' + contenido + '</span>';
		}

		var html = '<nav class="' + p + '__pages-nav" aria-label="Paginación de ' + cfg.plural + '"><ul class="' + p + '__pages" role="list">';

		html += item( actual > 1
			? enlace( 'prev', actual - 1, chevron( 'left' ) + '<span class="visually-hidden">Anterior</span>' )
			: inactivo( 'prev', chevron( 'left' ) ) );

		var numeros = [ 1 ];
		for ( var k = actual - 1; k <= actual + 1; k++ ) {
			if ( k > 1 && k < paginas ) {
				numeros.push( k );
			}
		}
		numeros.push( paginas );

		var previo = 0;
		numeros.forEach( function ( n ) {
			if ( n - previo > 1 ) {
				html += item( inactivo( 'dots', '…' ) );
			}
			html += item( n === actual
				? '<span class="' + p + '__page ' + p + '__page--page ' + p + '__page--current" aria-current="page">' + n + '<span class="visually-hidden"> (página actual de ' + paginas + ')</span></span>'
				: enlace( 'page', n, n + '<span class="visually-hidden"> (ir a la página ' + n + ')</span>' ) );
			previo = n;
		} );

		html += item( actual < paginas
			? enlace( 'next', actual + 1, chevron( 'right' ) + '<span class="visually-hidden">Siguiente</span>' )
			: inactivo( 'next', chevron( 'right' ) ) );

		return html + '</ul></nav>';
	}

	/** Calcula una vista: lo mismo que devolvía `admin-ajax.php` en `data`. */
	function vista( cfg, raiz, estado ) {
		var base = raiz.getAttribute( 'data-' + cfg.prefijo + '-base' ) || window.location.pathname;
		var columnas = raiz.getAttribute( 'data-' + cfg.prefijo + '-columns' ) || '3';

		return datos( cfg ).then( function ( items ) {
			var terminos = normaliza( estado.buscar ).split( /\s+/ ).filter( Boolean );
			var lista = items.filter( function ( item ) {
				if ( estado.filtro && item[ cfg.filtro ].indexOf( estado.filtro ) === -1 ) {
					return false;
				}
				if ( ! terminos.length ) {
					return true;
				}
				var texto = normaliza( item.titulo + ' ' + item.texto );
				return terminos.every( function ( t ) {
					return texto.indexOf( t ) !== -1;
				} );
			} );

			var paginas = Math.max( 1, Math.ceil( lista.length / POR_PAGINA ) );
			estado.pagina = Math.min( Math.max( 1, estado.pagina ), paginas );

			var html;
			if ( ! lista.length ) {
				html = '<p class="' + cfg.prefijo + '__empty">' + escapa( cfg.vacio( estado.buscar ) ) + '</p>';
			} else {
				var desde = ( estado.pagina - 1 ) * POR_PAGINA;
				html = '<ul class="' + cfg.prefijo + '__grid ' + cfg.prefijo + '__grid--cols-' + columnas + '" role="list">' +
					lista.slice( desde, desde + POR_PAGINA ).map( function ( item ) {
						return item.html;
					} ).join( '' ) +
					'</ul>' + paginacion( base, cfg, estado, lista.length );
			}

			return {
				html: html,
				url: urlPublica( base, cfg, estado, estado.pagina ),
				announce: cfg.aviso( lista.length ),
			};
		} );
	}

	function estadoDe( cfg, params ) {
		return {
			filtro: params.get( cfg.filtro ) || '',
			buscar: params.get( 'buscar' ) || params.get( 's' ) || '',
			pagina: parseInt( params.get( 'pagina' ), 10 ) || 1,
		};
	}

	function listadoDe( pathname ) {
		var m = pathname.match( /^\/api\/listados\/(noticias|tramites)$/ );
		return m ? LISTADOS[ m[ 1 ] ] : null;
	}

	// --- Interceptor: responde las peticiones de los scripts del tema. -------
	var fetchOriginal = window.fetch.bind( window );

	window.fetch = function ( recurso, opciones ) {
		var url = new URL( typeof recurso === 'string' ? recurso : recurso.url, window.location.href );
		var cfg = url.origin === window.location.origin ? listadoDe( url.pathname ) : null;

		if ( ! cfg ) {
			return fetchOriginal( recurso, opciones );
		}

		var raiz = document.querySelector( cfg.raiz );
		var senal = opciones && opciones.signal;

		return vista( cfg, raiz, estadoDe( cfg, url.searchParams ) ).then( function ( data ) {
			if ( senal && senal.aborted ) {
				throw new DOMException( 'Petición cancelada', 'AbortError' );
			}
			return new Response( JSON.stringify( { success: true, data: data } ), {
				headers: { 'Content-Type': 'application/json' },
			} );
		} );
	};

	// --- Vista inicial cuando la URL ya trae filtros. ---------------------------
	function sincroniza( raiz, cfg, estado, base ) {
		var p = cfg.prefijo;

		raiz.querySelectorAll( '[data-' + p + '-chip]' ).forEach( function ( chip ) {
			var slug = chip.getAttribute( 'data-' + p + '-chip' ) || '';
			var actual = slug === estado.filtro;
			chip.setAttribute( 'href', urlPublica( base, cfg, { filtro: slug, buscar: estado.buscar }, 1 ) );
			chip.classList.toggle( p + '__chip--current', actual );
			if ( actual ) {
				chip.setAttribute( 'aria-current', 'true' );
			} else {
				chip.removeAttribute( 'aria-current' );
			}
		} );

		var campoFiltro = raiz.querySelector( 'input[name="' + cfg.filtro + '"]' );
		if ( campoFiltro ) {
			campoFiltro.value = estado.filtro;
		}
		var campoBusqueda = raiz.querySelector( 'input[name="buscar"]' );
		if ( campoBusqueda ) {
			campoBusqueda.value = estado.buscar;
		}
	}

	Object.keys( LISTADOS ).forEach( function ( clave ) {
		var cfg = LISTADOS[ clave ];
		var raiz = document.querySelector( cfg.raiz );
		var params = new URLSearchParams( window.location.search );

		if ( ! raiz || ! ( params.has( cfg.filtro ) || params.has( 'buscar' ) || params.has( 's' ) || params.has( 'pagina' ) ) ) {
			return;
		}

		var resultados = raiz.querySelector( '[data-' + cfg.prefijo + '-results]' );
		var base = raiz.getAttribute( 'data-' + cfg.prefijo + '-base' ) || window.location.pathname;
		var estado = estadoDe( cfg, params );

		resultados.setAttribute( 'aria-busy', 'true' );
		vista( cfg, raiz, estado ).then( function ( data ) {
			resultados.innerHTML = data.html;
			resultados.setAttribute( 'aria-busy', 'false' );
			sincroniza( raiz, cfg, estado, base );
		} ).catch( function () {
			// Sin índice se queda la página 1 que vino en el HTML.
			resultados.setAttribute( 'aria-busy', 'false' );
		} );
	} );
} )();
