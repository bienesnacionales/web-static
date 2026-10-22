/**
 * Componente global — Archivo de trámites.
 *
 * El bloque funciona sin este archivo: los filtros son enlaces y el buscador un
 * formulario GET, así que navegar da el mismo resultado. Lo que añade el script
 * es sustituir solo la región de resultados en lugar de recargar la página, y
 * mantener la URL en sintonía con lo que se está viendo.
 *
 * Es el gemelo de `news-search.js` y sostiene las mismas tres reglas:
 *
 *   1. **La URL es el estado.** Cada petición se arma a partir del `href` que el
 *      servidor ya escribió en el enlace, no de un objeto de estado paralelo. Al
 *      responder, `pushState` deja esa misma URL en la barra: copiarla y abrirla
 *      en otra pestaña reproduce exactamente la vista.
 *   2. **Una petición a la vez.** `AbortController` cancela la anterior, de modo
 *      que dos clics rápidos en dos tipos nunca dejan en pantalla la respuesta
 *      de la primera.
 *   3. **Si algo falla, navega.** Cualquier error deja que el enlace o el
 *      formulario hagan lo suyo: la degradación es la navegación normal, no una
 *      pantalla rota.
 *
 * Lo único que cambia respecto al listado de noticias es el vocabulario del
 * estado (`tipo` en vez de `categoria`) y que la petición lleva además el
 * `context`, porque la URL base puede ser el archivo del CPT o la página que
 * monta el bloque.
 *
 * @package mbn
 */

( function () {
	'use strict';

	var SELECTOR = '[data-mbn-procedure-search]';

	/**
	 * Cablea un archivo de trámites.
	 *
	 * @param {HTMLElement} root Raíz del componente.
	 * @return {void}
	 */
	function setupProcedureSearch( root ) {
		var endpoint = root.getAttribute( 'data-mbn-procedure-search-endpoint' );
		var action = root.getAttribute( 'data-mbn-procedure-search-action' );
		var results = root.querySelector( '[data-mbn-procedure-search-results]' );

		if ( ! endpoint || ! action || ! results ) {
			return;
		}

		// Sin `fetch`, `AbortController` o `history.pushState` no se degrada a
		// una versión peor del filtrado: se deja la navegación completa, que ya
		// funciona.
		if ( ! window.fetch || ! window.AbortController || ! window.history || ! window.history.pushState ) {
			return;
		}

		var status = root.querySelector( '[data-mbn-procedure-search-status]' );
		var filters = root.querySelector( '[data-mbn-procedure-search-filters]' );
		var form = root.querySelector( '[data-mbn-procedure-search-form]' );
		var input = root.querySelector( '[data-mbn-procedure-search-input]' );
		var typeField = root.querySelector( '[data-mbn-procedure-search-type]' );
		var context = root.getAttribute( 'data-mbn-procedure-search-context' ) || 'page';
		var pageId = root.getAttribute( 'data-mbn-procedure-search-page-id' ) || '0';
		var perPage = root.getAttribute( 'data-mbn-procedure-search-per-page' ) || '';
		var columns = root.getAttribute( 'data-mbn-procedure-search-columns' ) || '';
		var description = root.getAttribute( 'data-mbn-procedure-search-description' ) || '1';
		var baseUrl = root.getAttribute( 'data-mbn-procedure-search-base' ) || window.location.href;
		var controller = null;

		/**
		 * Lee los parámetros del listado de una URL.
		 *
		 * @param {string} url URL absoluta o relativa.
		 * @return {Object} Estado: { tipo, buscar, pagina }.
		 */
		function stateFromUrl( url ) {
			var parsed = new URL( url, window.location.href );

			return {
				tipo: parsed.searchParams.get( 'tipo' ) || parsed.searchParams.get( 'tipo-de-tramite' ) || '',
				buscar: parsed.searchParams.get( 'buscar' ) || parsed.searchParams.get( 's' ) || '',
				pagina: parsed.searchParams.get( 'pagina' ) || parsed.searchParams.get( 'paged' ) || '',
			};
		}

		/**
		 * Compone la URL del endpoint para un estado.
		 *
		 * @param {Object} state Estado del listado.
		 * @return {string} URL de la petición.
		 */
		function endpointUrl( state ) {
			var url = new URL( endpoint, window.location.href );

			url.searchParams.set( 'action', action );
			url.searchParams.set( 'context', context );
			url.searchParams.set( 'page_id', pageId );
			url.searchParams.set( 'description', description );

			if ( perPage ) {
				url.searchParams.set( 'per_page', perPage );
			}

			if ( columns ) {
				url.searchParams.set( 'columns', columns );
			}

			if ( state.tipo ) {
				url.searchParams.set( 'tipo', state.tipo );
			}

			if ( state.buscar ) {
				url.searchParams.set( 'buscar', state.buscar );
			}

			if ( state.pagina ) {
				url.searchParams.set( 'pagina', state.pagina );
			}

			return url.toString();
		}

		/**
		 * Reescribe los enlaces de los filtros para el estado vigente.
		 *
		 * Los chips viven fuera de la región que se reemplaza —así el foco del
		 * chip pulsado sobrevive al filtrado—, de modo que hay que actualizarlos
		 * a mano: la marca de activo y el término de búsqueda que arrastran.
		 *
		 * @param {Object} state Estado del listado.
		 * @return {void}
		 */
		function syncFilters( state ) {
			if ( ! filters ) {
				return;
			}

			var chips = filters.querySelectorAll( '[data-mbn-procedure-search-chip]' );

			Array.prototype.forEach.call( chips, function ( chip ) {
				var slug = chip.getAttribute( 'data-mbn-procedure-search-chip' ) || '';
				var isCurrent = slug === state.tipo;
				var url = new URL( baseUrl, window.location.href );

				if ( slug ) {
					url.searchParams.set( 'tipo', slug );
				}

				if ( state.buscar ) {
					url.searchParams.set( 'buscar', state.buscar );
				}

				chip.setAttribute( 'href', url.toString() );
				chip.classList.toggle( 'mbn-procedure-search__chip--current', isCurrent );

				if ( isCurrent ) {
					chip.setAttribute( 'aria-current', 'true' );
				} else {
					chip.removeAttribute( 'aria-current' );
				}
			} );

			if ( typeField ) {
				typeField.value = state.tipo;
			}
		}

		/**
		 * Pide una vista del listado y sustituye los resultados.
		 *
		 * @param {string}  url       URL pública de la vista pedida.
		 * @param {boolean} moveFocus Si hay que llevar el foco a los resultados.
		 * @return {void}
		 */
		function load( url, moveFocus ) {
			var state = stateFromUrl( url );

			if ( controller ) {
				controller.abort();
			}

			controller = new window.AbortController();
			results.setAttribute( 'aria-busy', 'true' );
			root.classList.add( 'mbn-procedure-search--loading' );

			window
				.fetch( endpointUrl( state ), {
					signal: controller.signal,
					credentials: 'same-origin',
					headers: { 'X-Requested-With': 'XMLHttpRequest' },
				} )
				.then( function ( response ) {
					if ( ! response.ok ) {
						throw new Error( 'HTTP ' + response.status );
					}

					return response.json();
				} )
				.then( function ( payload ) {
					if ( ! payload || ! payload.success || ! payload.data ) {
						throw new Error( 'respuesta inesperada' );
					}

					results.innerHTML = payload.data.html;
					results.setAttribute( 'aria-busy', 'false' );
					root.classList.remove( 'mbn-procedure-search--loading' );

					var publicUrl = payload.data.url || url;

					syncFilters( stateFromUrl( publicUrl ) );
					window.history.pushState( { mbnProcedureSearch: true }, '', publicUrl );

					if ( status && payload.data.announce ) {
						status.textContent = payload.data.announce;
					}

					// El foco solo se mueve al paginar: al filtrar, el chip
					// pulsado sigue siendo el punto de referencia y quitárselo
					// al teclado desorienta más de lo que ayuda.
					if ( moveFocus ) {
						results.focus();
					}
				} )
				.catch( function ( error ) {
					if ( error && 'AbortError' === error.name ) {
						return;
					}

					// Sin resultados que mostrar, la navegación completa es la
					// respuesta correcta: la misma URL devuelve la misma vista.
					results.setAttribute( 'aria-busy', 'false' );
					root.classList.remove( 'mbn-procedure-search--loading' );
					window.location.assign( url );
				} );
		}

		root.addEventListener( 'click', function ( event ) {
			// Clic con modificador o botón secundario: es una petición explícita
			// de abrir en otra pestaña, y el navegador ya sabe hacerla.
			if ( event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || 0 !== event.button ) {
				return;
			}

			var link = event.target.closest( '[data-mbn-procedure-search-chip], [data-mbn-procedure-search-page]' );

			if ( ! link || ! root.contains( link ) ) {
				return;
			}

			event.preventDefault();
			load( link.href, link.hasAttribute( 'data-mbn-procedure-search-page' ) );
		} );

		if ( form ) {
			form.addEventListener( 'submit', function ( event ) {
				event.preventDefault();

				var url = new URL( baseUrl, window.location.href );
				var term = input ? input.value.trim() : '';
				var type = typeField ? typeField.value : '';

				if ( type ) {
					url.searchParams.set( 'tipo', type );
				}

				if ( term ) {
					url.searchParams.set( 'buscar', term );
				}

				load( url.toString(), false );
			} );
		}

		// Atrás y adelante del navegador: la vista se rehace desde la URL, que
		// es justo lo que `pushState` dejó ahí.
		window.addEventListener( 'popstate', function () {
			load( window.location.href, false );
		} );
	}

	/**
	 * Inicializa todos los archivos de trámites presentes en la página.
	 *
	 * @return {void}
	 */
	function init() {
		var blocks = document.querySelectorAll( SELECTOR );

		Array.prototype.forEach.call( blocks, setupProcedureSearch );
	}

	if ( 'loading' === document.readyState ) {
		document.addEventListener( 'DOMContentLoaded', init );
	} else {
		init();
	}
}() );
