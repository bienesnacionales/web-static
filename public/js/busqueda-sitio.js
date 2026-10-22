/**
 * Búsqueda del sitio con Pagefind, pintada con el marcado de la búsqueda del
 * tema original: contador, leyenda, lista de resultados con su etiqueta
 * (Noticia, Trámite, Página) y paginación de 10 en 10.
 *
 * El índice lo genera `pagefind --site dist` al final de `npm run build`.
 */
( function () {
	'use strict';

	var POR_PAGINA = 10;
	var params = new URLSearchParams( window.location.search );
	var termino = ( params.get( 's' ) || '' ).trim();
	var pagina = parseInt( params.get( 'pagina' ), 10 ) || 1;

	var total = document.querySelector( '[data-busqueda-total]' );
	var leyenda = document.querySelector( '[data-busqueda-leyenda]' );
	var contenedor = document.querySelector( '[data-busqueda-resultados]' );
	var campo = document.getElementById( 'mbn-search-field' );

	if ( campo ) {
		campo.value = termino;
	}

	if ( ! termino || ! contenedor ) {
		return;
	}

	function escapa( texto ) {
		return String( texto ).replace( /[&<>"]/g, function ( c ) {
			return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ c ];
		} );
	}

	function urlPagina( n ) {
		var url = new URL( '/buscar/', window.location.href );
		url.searchParams.set( 's', termino );
		if ( n > 1 ) {
			url.searchParams.set( 'pagina', String( n ) );
		}
		return url.pathname + url.search;
	}

	/** Números al estilo de `paginate_links`: extremos, vecinas y «…». */
	function paginacion( paginas ) {
		if ( paginas <= 1 ) {
			return '';
		}
		var html = '<nav class="mbn-search__pagination" aria-label="Páginas de resultados"><ul class="mbn-search__pages">';
		var previo = 0;
		for ( var n = 1; n <= paginas; n++ ) {
			var visible = n === 1 || n === paginas || Math.abs( n - pagina ) <= 2;
			if ( ! visible ) {
				continue;
			}
			if ( n - previo > 1 ) {
				html += '<li class="mbn-search__page"><span class="page-numbers dots">…</span></li>';
			}
			html += '<li class="mbn-search__page">' + ( n === pagina
				? '<span aria-current="page" class="page-numbers current"><span class="visually-hidden">Página </span>' + n + '</span>'
				: '<a class="page-numbers" href="' + escapa( urlPagina( n ) ) + '"><span class="visually-hidden">Página </span>' + n + '</a>' ) + '</li>';
			previo = n;
		}
		return html + '</ul></nav>';
	}

	function resultado( dato ) {
		var tipo = ( dato.meta.tipo || 'Página' ).trim();
		var clase = tipo === 'Noticia' ? 'post' : tipo === 'Trámite' ? 'tramites' : 'page';
		var titulo = dato.meta.title || '';
		return '<li class="mbn-search__item"><article class="mbn-search__result mbn-search__result--' + clase + '">' +
			'<span class="mbn-search__chip">' + escapa( tipo ) + '</span>' +
			'<h2 class="mbn-search__result-title">' + escapa( titulo ) + '</h2>' +
			( dato.meta.resumen ? '<p class="mbn-search__result-text">' + escapa( dato.meta.resumen ) + '</p>' : '' ) +
			'<a class="mbn-search__more stretched-link" href="' + escapa( dato.url ) + '">Conocer más<span class="visually-hidden">: ' + escapa( titulo ) + '</span><span class="mbn-search__more-icon" aria-hidden="true"></span></a>' +
			'</article></li>';
	}

	import( '/pagefind/pagefind.js' )
		.then( function ( pagefind ) {
			return pagefind.search( termino );
		} )
		.then( function ( busqueda ) {
			var resultados = busqueda.results;
			var paginas = Math.max( 1, Math.ceil( resultados.length / POR_PAGINA ) );
			pagina = Math.min( pagina, paginas );
			var desde = ( pagina - 1 ) * POR_PAGINA;

			return Promise.all( resultados.slice( desde, desde + POR_PAGINA ).map( function ( r ) {
				return r.data();
			} ) ).then( function ( datos ) {
				total.textContent = resultados.length + ( resultados.length === 1 ? ' resultado' : ' resultados' );
				total.hidden = false;

				if ( ! resultados.length ) {
					contenedor.innerHTML = '<p class="mbn-search__empty">No encontramos resultados para «' + escapa( termino ) + '». Prueba con otras palabras o con una búsqueda más corta.</p>';
					return;
				}

				leyenda.textContent = 'Resultados encontrados para «' + termino + '»';
				leyenda.hidden = false;
				contenedor.innerHTML = '<ol class="mbn-search__list">' + datos.map( resultado ).join( '' ) + '</ol>' + paginacion( paginas );
			} );
		} )
		.catch( function () {
			contenedor.innerHTML = '<p class="mbn-search__empty">La búsqueda no está disponible en este momento.</p>';
		} );
} )();
