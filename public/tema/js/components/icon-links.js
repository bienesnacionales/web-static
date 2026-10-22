/**
 * Componente global — Enlaces con ícono.
 *
 * El carrusel móvil funciona sin este archivo: por debajo de `md` la lista es
 * una pista desplazable con scroll-snap, así que el gesto táctil, la rueda y
 * las flechas del teclado ya la recorren. Lo que añade el script es la capa de
 * control explícito —las dos flechas y el contador—, que nace oculta en el HTML
 * y se revela aquí: un botón que no hace nada es peor que ningún botón.
 *
 * Por encima de `md` la sección vuelve a ser una rejilla. El script lo detecta
 * y deja de gobernar nada: no hay desplazamiento que controlar.
 *
 * @package mbn
 */

( function () {
	'use strict';

	if ( typeof window === 'undefined' || ! window.document ) {
		return;
	}

	var SELECTOR = '[data-mbn-icon-links]';

	/**
	 * Indica si el usuario pidió reducir el movimiento.
	 *
	 * @return {boolean} true si hay que evitar el desplazamiento animado.
	 */
	function prefersReducedMotion() {
		return !! (
			window.matchMedia &&
			window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches
		);
	}

	/**
	 * Inicializa una sección.
	 *
	 * @param {HTMLElement} root Elemento con [data-mbn-icon-links].
	 */
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

		// A partir de aquí el script puede gobernar la pista: se revelan.
		controls.hidden = false;

		var total = items.length;

		// Los enlaces se recorren en el orden en que se ven, que se recalcula desde
		// la posición real. El orden del DOM sería lo natural y hoy coincide, pero
		// basta un `order` de CSS —propio o del kit heredado— para que deje de
		// hacerlo, y entonces el contador y las flechas irían por su cuenta: «2 de
		// 10» sobre el enlace equivocado y saltos a mitad de la pista.
		var orden = items;

		// Desplazamiento programado en curso: mientras dura, manda el destino y no
		// la posición intermedia de la pista.
		var animando = false;
		var reposo = 0;

		// Enlace en curso según lo último pintado. Los botones parten de aquí y no
		// de la posición de la pista: dos pulsaciones seguidas tienen que avanzar
		// dos enlaces, y a media animación la pista todavía está en el anterior.
		var indice = 0;

		/**
		 * Reordena la lista según la posición horizontal de cada enlace.
		 */
		function refrescarOrden() {
			orden = items.slice().sort( function ( a, b ) {
				return a.offsetLeft - b.offsetLeft;
			} );
		}

		/**
		 * Indica si la pista está en modo carrusel.
		 *
		 * Se pregunta al layout en vez de repetir el breakpoint en JS: si el CSS
		 * cambia de idea, el script lo sigue sin tocar nada. Una rejilla no
		 * desborda horizontalmente; una pista, sí.
		 *
		 * @return {boolean} true si hay desplazamiento que gobernar.
		 */
		function esCarrusel() {
			return viewport.scrollWidth > viewport.clientWidth + 1;
		}

		/**
		 * Devuelve el índice del enlace más cercano al centro de la pista.
		 *
		 * @return {number} Índice de base cero.
		 */
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

		/**
		 * Lleva la pista hasta un enlace concreto.
		 *
		 * @param {number} pedido Índice de destino.
		 */
		function irA( pedido ) {
			var destino = Math.max( 0, Math.min( total - 1, pedido ) );
			var el = orden[ destino ];

			if ( ! el ) {
				return;
			}

			// Se centra el enlace en la pista. `scrollTo` sobre el contenedor y no
			// `scrollIntoView` sobre el enlace: este último desplazaría también la
			// página cuando la sección no está completamente a la vista.
			var izquierda = el.offsetLeft - ( ( viewport.clientWidth - el.offsetWidth ) / 2 );

			viewport.scrollTo( {
				left: izquierda,
				behavior: prefersReducedMotion() ? 'auto' : 'smooth'
			} );

			// El contador no espera a que termine el desplazamiento: en cuanto se
			// pulsa, el destino ya es el enlace actual. Mientras dura la animación
			// se ignora el scroll, porque a media transición el enlace más cercano
			// al centro sigue siendo el de partida y el contador retrocedería —en
			// una live region, además, se anunciaría dos veces.
			animando = true;
			window.clearTimeout( reposo );
			reposo = window.setTimeout( soltar, 800 );

			pintar( destino );
		}

		/**
		 * Devuelve el mando a la posición real de la pista.
		 *
		 * Lo llama `scrollend` en cuanto el desplazamiento se detiene, y un
		 * temporizador de respaldo allí donde ese evento todavía no existe. El
		 * respaldo por sí solo no bastaría: sería un número fijo compitiendo contra
		 * una animación cuya duración decide el navegador.
		 */
		function soltar() {
			if ( ! animando ) {
				return;
			}

			window.clearTimeout( reposo );
			animando = false;
			sincronizar();
		}

		/**
		 * Escribe el contador y el estado de las flechas para un índice dado.
		 *
		 * @param {number} actual Índice de base cero del enlace en curso.
		 */
		function pintar( actual ) {
			indice = actual;

			if ( status ) {
				var texto = ( actual + 1 ) + ' de ' + total;

				// Solo se escribe cuando cambia: reasignar el mismo texto en una
				// live region hace que el lector lo repita en cada scroll.
				if ( status.textContent.trim() !== texto ) {
					status.textContent = texto;
				}
			}

			// En los extremos las flechas se deshabilitan en lugar de ocultarse,
			// para que la fila de controles no cambie de tamaño.
			prev.disabled = 0 === actual;
			next.disabled = actual >= total - 1;
		}

		/**
		 * Refresca los controles a partir de la posición real de la pista.
		 */
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

		// El scroll dispara muy seguido: se agrupa en un frame de animación. Se
		// cancela y reprograma en vez de descartar con un flag: así siempre queda
		// un frame pendiente y el último scroll se atiende aunque el navegador se
		// haya saltado frames —con un flag, un frame perdido dejaba el contador
		// congelado para el resto de la sesión.
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
