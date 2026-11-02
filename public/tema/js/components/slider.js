/* gestiona las interacciones de carruseles de portada */
( function () {
	'use strict';

	if ( typeof window === 'undefined' || ! window.document ) {
		return;
	}

	// devuelve la instancia de Carousel de Bootstrap, o null si no está disponible
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

	// crea la región de estado y anuncia los cambios de diapositiva
	function initLiveRegion( el ) {
		var live = document.createElement( 'div' );

		live.setAttribute( 'aria-live', 'polite' );
		live.setAttribute( 'aria-atomic', 'true' );
		live.className = 'visually-hidden';
		el.appendChild( live );

		el.addEventListener( 'slid.bs.carousel', function ( event ) {
			var total = el.querySelectorAll( '.carousel-item' ).length;
			var index = ( typeof event.to === 'number' ? event.to : 0 ) + 1;

			// restablece la región de estado antes de repetir un anuncio
			live.textContent = '';

			window.setTimeout( function () {
				live.textContent = 'Diapositiva ' + index + ' de ' + total + '.';
			}, 80 );
		} );
	}

	// conecta el botón de pausa/reproducción con el ciclo del carrusel
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

		// bootstrap reanuda el ciclo al salir el puntero o el foco cuando data-bs-pause="hover"
		[ 'mouseleave', 'focusout' ].forEach( function ( eventName ) {
			el.addEventListener( eventName, function () {
				if ( paused ) {
					carousel.pause();
				}
			} );
		} );

		// detiene el carrusel cuando está activa la preferencia de movimiento reducido
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
