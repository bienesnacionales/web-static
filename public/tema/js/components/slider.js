/* Componente global — Slider.
 *
 * Enhancement sobre el Carousel de Bootstrap 5.3.3. Bootstrap ya resuelve la
 * transición, el teclado, el swipe y el autoplay; aquí solo se añade lo que no
 * trae:
 *
 *   1. Live region polite que anuncia la diapositiva activa (WCAG 4.1.3).
 *   2. Control de pausa/reanudación del autoplay (WCAG 2.2.2).
 *   3. Respeto de `prefers-reduced-motion`: el autoplay arranca detenido.
 *
 * Vanilla, sin jQuery. No-op si no hay ningún slider en el DOM.
 *
 * @package mbn
 */

( function () {
	'use strict';

	if ( typeof window === 'undefined' || ! window.document ) {
		return;
	}

	/**
	 * Devuelve la instancia de Carousel de Bootstrap, o null si no está disponible.
	 *
	 * @param {HTMLElement} el Elemento .carousel.
	 * @return {Object|null} Instancia.
	 */
	function getCarousel( el ) {
		if ( ! window.bootstrap || ! window.bootstrap.Carousel ) {
			return null;
		}

		try {
			return window.bootstrap.Carousel.getOrCreateInstance( el );
		} catch ( e ) {
			return null;
		}
	}

	/**
	 * Inserta la live region y anuncia cada cambio de diapositiva.
	 *
	 * @param {HTMLElement} el Elemento .carousel.
	 */
	function initLiveRegion( el ) {
		var live = document.createElement( 'div' );

		live.setAttribute( 'aria-live', 'polite' );
		live.setAttribute( 'aria-atomic', 'true' );
		live.className = 'visually-hidden';
		el.appendChild( live );

		el.addEventListener( 'slid.bs.carousel', function ( event ) {
			var total = el.querySelectorAll( '.carousel-item' ).length;
			var index = ( typeof event.to === 'number' ? event.to : 0 ) + 1;

			// Se limpia primero para forzar el reanuncio cuando el texto no cambia.
			live.textContent = '';

			window.setTimeout( function () {
				live.textContent = 'Diapositiva ' + index + ' de ' + total + '.';
			}, 80 );
		} );
	}

	/**
	 * Conecta el botón de pausa/reproducción con el ciclo del carrusel.
	 *
	 * @param {HTMLElement} el      Elemento .carousel.
	 * @param {Object}      carousel Instancia de Bootstrap.
	 */
	function initPlayPause( el, carousel ) {
		var button = el.querySelector( '[data-mbn-slider-playpause]' );

		if ( ! button || ! carousel ) {
			return;
		}

		var paused = false;

		function setState( isPaused ) {
			paused = isPaused;
			button.classList.toggle( 'is-playing', ! isPaused );

			var label = isPaused
				? button.getAttribute( 'data-mbn-label-play' )
				: button.getAttribute( 'data-mbn-label-pause' );

			if ( label ) {
				button.setAttribute( 'aria-label', label );
			}
		}

		button.addEventListener( 'click', function () {
			if ( paused ) {
				carousel.cycle();
				setState( false );
			} else {
				carousel.pause();
				setState( true );
			}
		} );

		// Bootstrap reanuda el ciclo al salir el puntero o el foco cuando
		// data-bs-pause="hover". Si el usuario pausó de forma explícita, esa
		// reanudación automática tiene que anularse: estos listeners se
		// registran después de los de Bootstrap, así que corren a continuación.
		[ 'mouseleave', 'focusout' ].forEach( function ( eventName ) {
			el.addEventListener( eventName, function () {
				if ( paused ) {
					carousel.pause();
				}
			} );
		} );

		// Movimiento reducido: el slider queda detenido de entrada, con el
		// control reflejando el estado real para poder reanudarlo a voluntad.
		var reduced = window.matchMedia && window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;

		if ( reduced ) {
			carousel.pause();
			setState( true );
		}
	}

	function init() {
		var carousels = document.querySelectorAll( '.mbn-slider__carousel.carousel' );

		for ( var i = 0; i < carousels.length; i++ ) {
			var el = carousels[ i ];

			initLiveRegion( el );
			initPlayPause( el, getCarousel( el ) );
		}
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', init );
	} else {
		init();
	}
}() );
