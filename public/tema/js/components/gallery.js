/**
 * Componente global — Galería en carrusel.
 *
 * El carrusel funciona sin este archivo: el viewport es una zona desplazable
 * nativa con scroll-snap, así que el gesto táctil, la rueda y las flechas del
 * teclado ya recorren las fotografías. Lo que añade el script es la capa de
 * control explícito —flechas, indicadores y contador—, que nace oculta en el
 * HTML y se revela aquí: un botón que no hace nada es peor que ningún botón.
 *
 * La caja de luz NO se toca: la implementa WordPress (core/image + core/gallery
 * con el atributo `lightbox`) mediante su API de interactividad. Ver
 * `inc/components/gallery.php`.
 *
 * @package mbn
 */

( function () {
	'use strict';

	var SELECTOR = '[data-mbn-gallery]';

	/**
	 * Indica si el usuario pidió reducir el movimiento.
	 *
	 * @return {boolean} true si hay que evitar el desplazamiento animado.
	 */
	function prefersReducedMotion() {
		return (
			window.matchMedia &&
			window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches
		);
	}

	/**
	 * Cablea una galería.
	 *
	 * @param {HTMLElement} gallery Raíz del componente.
	 * @return {void}
	 */
	function setupGallery( gallery ) {
		var viewport = gallery.querySelector( '[data-mbn-gallery-viewport]' );
		var controls = gallery.querySelector( '[data-mbn-gallery-controls]' );

		if ( ! viewport || ! controls ) {
			return;
		}

		// Las diapositivas son las figures que genera core/gallery. Se leen del
		// DOM y no de un dato de PHP: si core cambiara el número de figures
		// (por ejemplo al descartar un adjunto), los controles siguen cuadrando.
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

		/**
		 * Desplaza el viewport hasta una diapositiva.
		 *
		 * @param {number} index Índice de destino.
		 * @return {void}
		 */
		function goTo( index ) {
			if ( index < 0 || index >= slides.length ) {
				return;
			}

			viewport.scrollTo( {
				left: slides[ index ].offsetLeft - viewport.offsetLeft,
				behavior: prefersReducedMotion() ? 'auto' : 'smooth',
			} );
		}

		/**
		 * Refleja el índice visible en los controles.
		 *
		 * @param {number} index Índice visible.
		 * @return {void}
		 */
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
				// El texto de PHP ya viene traducido y con el total correcto:
				// solo hay que sustituir el número de la fotografía actual.
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

		// El estado se deriva de lo que está a la vista, no de quién pulsó qué:
		// así queda igual de correcto tras un gesto táctil, un scroll con la
		// rueda o un salto con las flechas del teclado.
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

	/**
	 * Inicializa todas las galerías del documento.
	 *
	 * @return {void}
	 */
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
