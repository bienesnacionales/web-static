/* gestiona las interacciones de búsqueda de trámites */
( function () {
	'use strict';

	var SELECTOR = '[data-mbn-procedure-search]';

	// inicializa un archivo de trámites
	function setupProcedureSearch( root ) {
		var endpoint = root.getAttribute( 'data-mbn-procedure-search-endpoint' );
		var action = root.getAttribute( 'data-mbn-procedure-search-action' );
		var results = root.querySelector( '[data-mbn-procedure-search-results]' );

		if ( ! endpoint || ! action || ! results ) {
			return;
		}

		// conserva la navegación completa cuando las API de filtrado no están disponibles
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

		// lee los parámetros del listado de una URL
		function stateFromUrl( url ) {
			var parsed = new URL( url, window.location.href );

			return {
				tipo: parsed.searchParams.get( 'tipo' ) || parsed.searchParams.get( 'tipo-de-tramite' ) || '',
				buscar: parsed.searchParams.get( 'buscar' ) || parsed.searchParams.get( 's' ) || '',
				pagina: parsed.searchParams.get( 'pagina' ) || parsed.searchParams.get( 'paged' ) || '',
			};
		}

		// construye la dirección de consulta para el estado seleccionado
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

		// reescribe los enlaces de los filtros para el estado vigente
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

		// consulta el listado y actualiza la región de resultados
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

					// traslada el foco al paginar y lo conserva en el filtro durante la selección
					if ( moveFocus ) {
						results.focus();
					}
				} )
				.catch( function ( error ) {
					if ( error && 'AbortError' === error.name ) {
						return;
					}

					// utiliza la navegación completa cuando la respuesta no contiene una vista válida
					results.setAttribute( 'aria-busy', 'false' );
					root.classList.remove( 'mbn-procedure-search--loading' );
					window.location.assign( url );
				} );
		}

		root.addEventListener( 'click', function ( event ) {
			// conserva el comportamiento nativo de los clics modificados o secundarios
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

		// restaura el listado desde la dirección al navegar por el historial
		window.addEventListener( 'popstate', function () {
			load( window.location.href, false );
		} );
	}

	// inicializa todos los archivos de trámites presentes en la página
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
