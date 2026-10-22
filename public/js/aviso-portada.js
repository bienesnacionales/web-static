/**
 * Aviso emergente de la portada («Juntos Chile se cuida»).
 *
 * Reproduce lo que hacía Popup Maker con este aviso, sin cargar el plugin ni
 * jQuery: se abre solo a los 500 ms, se cierra con su botón y, una vez cerrado,
 * no vuelve a salir durante una hora. La cookie es la misma del plugin
 * (`pum-55289`). El centrado lo resuelven sus propias hojas de estilo.
 */
( function () {
	'use strict';

	var COOKIE = 'pum-55289';
	var overlay = document.getElementById( 'pum-55289' );

	if ( ! overlay ) {
		return;
	}

	var yaCerrado = document.cookie.split( '; ' ).some( function ( par ) {
		return par.indexOf( COOKIE + '=' ) === 0;
	} );

	if ( yaCerrado ) {
		return;
	}

	var cerrar = overlay.querySelector( '.pum-close' );
	var raiz = document.documentElement;

	function abrir() {
		/*
		  Las hojas del plugin bloquean el desplazamiento y con eso desaparece la
		  barra: la página se ensancharía de golpe. Se compensa con un relleno del
		  mismo ancho, como hace Bootstrap con la encuesta. Se divide por el zoom
		  del body (`large-screen.js`), que también amplía el relleno.
		*/
		var barra = window.innerWidth - raiz.clientWidth;
		var zoom = parseFloat( window.getComputedStyle( document.body ).zoom ) || 1;

		overlay.style.opacity = '0';
		overlay.style.display = 'block';
		overlay.classList.add( 'pum-active' );
		raiz.classList.add( 'pum-open', 'pum-open-overlay' );
		if ( barra > 0 ) {
			document.body.style.paddingRight = ( barra / zoom ) + 'px';
		}
		// Fundido de 350 ms, como lo tenía configurado el aviso.
		overlay.style.transition = 'opacity .35s ease-in-out';
		window.requestAnimationFrame( function () {
			overlay.style.opacity = '1';
		} );
		var contenido = overlay.querySelector( '.pum-content' );
		if ( contenido ) {
			contenido.focus( { preventScroll: true } );
		}
	}

	function cierra() {
		overlay.style.display = 'none';
		overlay.classList.remove( 'pum-active' );
		raiz.classList.remove( 'pum-open', 'pum-open-overlay' );
		document.body.style.paddingRight = '';
		document.cookie = COOKIE + '=true; max-age=3600; path=/; SameSite=Lax';
	}

	if ( cerrar ) {
		cerrar.addEventListener( 'click', cierra );
	}

	window.setTimeout( abrir, 500 );
} )();
