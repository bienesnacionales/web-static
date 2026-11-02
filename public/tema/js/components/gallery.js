/* gestiona las interacciones de galerías de imágenes */
( function () {
	'use strict';

	var SELECTOR = '[data-mbn-gallery]';


	function prefersReducedMotion() {
		return (
			window.matchMedia &&
			window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches
		);
	}

	// inicializa una galería
	function setupGallery( gallery ) {
		var viewport = gallery.querySelector( '[data-mbn-gallery-viewport]' );
		var controls = gallery.querySelector( '[data-mbn-gallery-controls]' );

		if ( ! viewport || ! controls ) {
			return;
		}

		// obtiene las diapositivas renderizadas por core/gallery
		var slides = viewport.querySelectorAll( '.wp-block-gallery > figure' );

		if ( slides.length < 2 ) {
			return;
		}

		var prev = controls.querySelector( '[data-mbn-gallery-prev]' );
		var next = controls.querySelector( '[data-mbn-gallery-next]' );
		var status = controls.querySelector( '[data-mbn-gallery-status]' );
		var indicators = controls.querySelectorAll( '[data-mbn-gallery-goto]' );
		var statusTemplate = status ? status.textContent : '';
		var current = 0;

		controls.removeAttribute( 'hidden' );

		// desplaza el contenedor hasta la diapositiva seleccionada
		function goTo( index ) {
			if ( index < 0 || index >= slides.length ) {
				return;
			}

			viewport.scrollTo( {
				left: slides[ index ].offsetLeft - viewport.offsetLeft,
				behavior: prefersReducedMotion() ? 'auto' : 'smooth',
			} );
		}

		// refleja el índice visible en los controles
		function render( index ) {
			current = index;

			for ( var i = 0; i < indicators.length; i++ ) {
				if ( i === index ) {
					indicators[ i ].setAttribute( 'aria-current', 'true' );
				} else {
					indicators[ i ].removeAttribute( 'aria-current' );
				}
			}

			if ( prev ) {
				prev.setAttribute( 'aria-disabled', 0 === index ? 'true' : 'false' );
			}

			if ( next ) {
				next.setAttribute(
					'aria-disabled',
					index === slides.length - 1 ? 'true' : 'false'
				);
			}

			if ( status && statusTemplate ) {
				// actualiza el número de fotografía y conserva el texto traducido del contador
				status.textContent = statusTemplate.replace(
					/\d+/,
					String( index + 1 )
				);
			}
		}

		if ( prev ) {
			prev.addEventListener( 'click', function () {
				goTo( current - 1 );
			} );
		}

		if ( next ) {
			next.addEventListener( 'click', function () {
				goTo( current + 1 );
			} );
		}

		for ( var i = 0; i < indicators.length; i++ ) {
			indicators[ i ].addEventListener( 'click', function ( event ) {
				goTo(
					parseInt(
						event.currentTarget.getAttribute( 'data-mbn-gallery-goto' ),
						10
					)
				);
			} );
		}


		if ( 'IntersectionObserver' in window ) {
			var observer = new IntersectionObserver(
				function ( entries ) {
					var best = null;

					entries.forEach( function ( entry ) {
						if (
							entry.isIntersecting &&
							( ! best || entry.intersectionRatio > best.intersectionRatio )
						) {
							best = entry;
						}
					} );

					if ( ! best ) {
						return;
					}

					render( Array.prototype.indexOf.call( slides, best.target ) );
				},
				{
					root: viewport,
					threshold: [ 0.5, 0.75, 1 ],
				}
			);

			for ( var s = 0; s < slides.length; s++ ) {
				observer.observe( slides[ s ] );
			}
		}

		render( 0 );
	}

	// inicializa todas las galerías del documento
	function init() {
		var galleries = document.querySelectorAll( SELECTOR );

		for ( var i = 0; i < galleries.length; i++ ) {
			setupGallery( galleries[ i ] );
		}
	}

	if ( 'loading' === document.readyState ) {
		document.addEventListener( 'DOMContentLoaded', init );
	} else {
		init();
	}
} )();
