/* gestiona las interacciones de enlaces frecuentes */
( function () {
	'use strict';

	if ( typeof window === 'undefined' || ! window.document ) {
		return;
	}

	var SELECTOR = '[data-mbn-icon-links]';


	function prefersReducedMotion() {
		return !! (
			window.matchMedia &&
			window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches
		);
	}

	// inicializa una sección
	function init( root ) {
		var viewport = root.querySelector( '[data-mbn-icon-links-viewport]' );
		var controls = root.querySelector( '[data-mbn-icon-links-controls]' );

		if ( ! viewport || ! controls ) {
			return;
		}

		var prev   = controls.querySelector( '[data-mbn-icon-links-prev]' );
		var next   = controls.querySelector( '[data-mbn-icon-links-next]' );
		var status = controls.querySelector( '[data-mbn-icon-links-status]' );
		var items  = Array.prototype.slice.call(
			viewport.querySelectorAll( '.mbn-icon-links__item' )
		);

		if ( ! prev || ! next || items.length < 2 ) {
			return;
		}

		// habilita los controles de navegación de la pista
		controls.hidden = false;

		var total = items.length;

		// ordena los enlaces según su posición visible en la pista
		var orden = items;

		// mantiene el destino activo durante el desplazamiento programado
		var animando = false;
		var reposo = 0;

		// conserva el índice del último enlace presentado
		var indice = 0;

		// reordena la lista según la posición horizontal de cada enlace
		function refrescarOrden() {
			orden = items.slice().sort( function ( a, b ) {
				return a.offsetLeft - b.offsetLeft;
			} );
		}

		// indica si la pista está en modo carrusel
		function esCarrusel() {
			return viewport.scrollWidth > viewport.clientWidth + 1;
		}

		// devuelve el índice del enlace más cercano al centro de la pista
		function indiceActual() {
			var centro = viewport.scrollLeft + ( viewport.clientWidth / 2 );
			var mejor = 0;
			var menor = Infinity;

			for ( var i = 0; i < total; i++ ) {
				var el = orden[ i ];
				var medio = el.offsetLeft + ( el.offsetWidth / 2 );
				var dist = Math.abs( medio - centro );

				if ( dist < menor ) {
					menor = dist;
					mejor = i;
				}
			}

			return mejor;
		}

		// desplaza la pista hasta el enlace seleccionado
		function irA( pedido ) {
			var destino = Math.max( 0, Math.min( total - 1, pedido ) );
			var el = orden[ destino ];

			if ( ! el ) {
				return;
			}


			var izquierda = el.offsetLeft - ( ( viewport.clientWidth - el.offsetWidth ) / 2 );

			viewport.scrollTo( {
				left: izquierda,
				behavior: prefersReducedMotion() ? 'auto' : 'smooth'
			} );

			// actualiza el contador al seleccionar el enlace de destino
			animando = true;
			window.clearTimeout( reposo );
			reposo = window.setTimeout( soltar, 800 );

			pintar( destino );
		}

		// sincroniza el estado con la posición actual de la pista
		function soltar() {
			if ( ! animando ) {
				return;
			}

			window.clearTimeout( reposo );
			animando = false;
			sincronizar();
		}

		// actualiza el contador y las flechas según el índice seleccionado
		function pintar( actual ) {
			indice = actual;

			if ( status ) {
				var texto = ( actual + 1 ) + ' de ' + total;

				// actualiza la región de estado únicamente cuando cambia el enlace activo
				if ( status.textContent.trim() !== texto ) {
					status.textContent = texto;
				}
			}

			// deshabilita las flechas en los extremos y conserva el espacio de los controles
			prev.disabled = 0 === actual;
			next.disabled = actual >= total - 1;
		}

		// refresca los controles a partir de la posición real de la pista
		function sincronizar() {
			refrescarOrden();

			if ( ! esCarrusel() ) {
				controls.hidden = true;
				return;
			}

			controls.hidden = false;
			pintar( indiceActual() );
		}

		prev.addEventListener( 'click', function () {
			irA( indice - 1 );
		} );

		next.addEventListener( 'click', function () {
			irA( indice + 1 );
		} );

		// agrupa las actualizaciones de desplazamiento por fotograma de animación
		var frame = 0;

		viewport.addEventListener( 'scroll', function () {
			if ( animando ) {
				return;
			}

			if ( frame ) {
				window.cancelAnimationFrame( frame );
			}

			frame = window.requestAnimationFrame( function () {
				frame = 0;
				sincronizar();
			} );
		}, { passive: true } );

		viewport.addEventListener( 'scrollend', soltar );

		window.addEventListener( 'resize', sincronizar, { passive: true } );

		sincronizar();
	}

	function start() {
		var secciones = document.querySelectorAll( SELECTOR );

		for ( var i = 0; i < secciones.length; i++ ) {
			init( secciones[ i ] );
		}
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', start );
	} else {
		start();
	}
}() );
