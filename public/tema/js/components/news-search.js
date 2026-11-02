/* gestiona las interacciones de búsqueda de noticias */
( function () {
	'use strict';

	var SELECTOR = '[data-mbn-news-search]';

	// inicializa un buscador de noticias
	function setupNewsSearch( root ) {
		var endpoint = root.getAttribute( 'data-mbn-news-search-endpoint' );
		var action = root.getAttribute( 'data-mbn-news-search-action' );
		var results = root.querySelector( '[data-mbn-news-search-results]' );

		if ( ! endpoint || ! action || ! results ) {
			return;
		}

		// conserva la navegación completa cuando las API de filtrado no están disponibles
		if ( ! window.fetch || ! window.AbortController || ! window.history || ! window.history.pushState ) {
			return;
		}

		var status = root.querySelector( '[data-mbn-news-search-status]' );
		var filters = root.querySelector( '[data-mbn-news-search-filters]' );
		var form = root.querySelector( '[data-mbn-news-search-form]' );
		var input = root.querySelector( '[data-mbn-news-search-input]' );
		var categoryField = root.querySelector( '[data-mbn-news-search-category]' );
		var pageId = root.getAttribute( 'data-mbn-news-search-page-id' ) || '0';
		var perPage = root.getAttribute( 'data-mbn-news-search-per-page' ) || '';
		var columns = root.getAttribute( 'data-mbn-news-search-columns' ) || '';
		var excerpt = root.getAttribute( 'data-mbn-news-search-excerpt' ) || '1';
		var baseUrl = root.getAttribute( 'data-mbn-news-search-base' ) || window.location.href;
		var controller = null;

		// lee los parámetros del listado de una URL
		function stateFromUrl( url ) {
			var parsed = new URL( url, window.location.href );

			return {
				categoria: parsed.searchParams.get( 'categoria' ) || parsed.searchParams.get( 'category' ) || '',
				buscar: parsed.searchParams.get( 'buscar' ) || parsed.searchParams.get( 's' ) || '',
				pagina: parsed.searchParams.get( 'pagina' ) || parsed.searchParams.get( 'paged' ) || '',
			};
		}

		// construye la dirección de consulta para el estado seleccionado
		function endpointUrl( state ) {
			var url = new URL( endpoint, window.location.href );

			url.searchParams.set( 'action', action );
			url.searchParams.set( 'page_id', pageId );
			url.searchParams.set( 'excerpt', excerpt );

			if ( perPage ) {
				url.searchParams.set( 'per_page', perPage );
			}

			if ( columns ) {
				url.searchParams.set( 'columns', columns );
			}

			if ( state.categoria ) {
				url.searchParams.set( 'categoria', state.categoria );
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

			var chips = filters.querySelectorAll( '[data-mbn-news-search-chip]' );

			Array.prototype.forEach.call( chips, function ( chip ) {
				var slug = chip.getAttribute( 'data-mbn-news-search-chip' ) || '';
				var isCurrent = slug === state.categoria;
				var url = new URL( baseUrl, window.location.href );

				if ( slug ) {
					url.searchParams.set( 'categoria', slug );
				}

				if ( state.buscar ) {
					url.searchParams.set( 'buscar', state.buscar );
				}

				chip.setAttribute( 'href', url.toString() );
				chip.classList.toggle( 'mbn-news-search__chip--current', isCurrent );

				if ( isCurrent ) {
					chip.setAttribute( 'aria-current', 'true' );
				} else {
					chip.removeAttribute( 'aria-current' );
				}
			} );

			if ( categoryField ) {
				categoryField.value = state.categoria;
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
			root.classList.add( 'mbn-news-search--loading' );

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
					root.classList.remove( 'mbn-news-search--loading' );

					var publicUrl = payload.data.url || url;

					syncFilters( stateFromUrl( publicUrl ) );
					window.history.pushState( { mbnNewsSearch: true }, '', publicUrl );

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
					root.classList.remove( 'mbn-news-search--loading' );
					window.location.assign( url );
				} );
		}

		root.addEventListener( 'click', function ( event ) {
			// conserva el comportamiento nativo de los clics modificados o secundarios
			if ( event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || 0 !== event.button ) {
				return;
			}

			var link = event.target.closest( '[data-mbn-news-search-chip], [data-mbn-news-search-page]' );

			if ( ! link || ! root.contains( link ) ) {
				return;
			}

			event.preventDefault();
			load( link.href, link.hasAttribute( 'data-mbn-news-search-page' ) );
		} );

		if ( form ) {
			form.addEventListener( 'submit', function ( event ) {
				event.preventDefault();

				var url = new URL( baseUrl, window.location.href );
				var term = input ? input.value.trim() : '';
				var category = categoryField ? categoryField.value : '';

				if ( category ) {
					url.searchParams.set( 'categoria', category );
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

	// inicializa todos los buscadores presentes en la página
	function init() {
		var blocks = document.querySelectorAll( SELECTOR );

		Array.prototype.forEach.call( blocks, setupNewsSearch );
	}

	if ( 'loading' === document.readyState ) {
		document.addEventListener( 'DOMContentLoaded', init );
	} else {
		init();
	}
}() );
