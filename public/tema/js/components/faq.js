/* gestiona las interacciones de preguntas frecuentes */
( function () {
	'use strict';


	var EPSILON = 2;

	// muestra la pestaña indicada, sea de grupo o de categoría
	function show( trigger ) {
		if ( ! trigger || ! window.bootstrap || ! window.bootstrap.Tab ) {
			return false;
		}

		window.bootstrap.Tab.getOrCreateInstance( trigger ).show();


		if ( trigger.scrollIntoView ) {
			trigger.scrollIntoView( { block: 'nearest', inline: 'nearest' } );
		}

		return true;
	}

	// activa la pestaña asociada a un id de panel o de botón
	function activateFromId( id ) {
		if ( ! id ) {
			return false;
		}

		var target = document.getElementById( id );

		if ( ! target ) {
			return false;
		}

		// el hash puede apuntar al panel o al propio botón
		var trigger = target.matches( '[data-bs-toggle="tab"]' )
			? target
			: document.querySelector( '[data-bs-target="#' + CSS.escape( id ) + '"]' );

		if ( ! trigger || ! trigger.closest( '.mbn-faq' ) ) {
			return false;
		}

		var group = trigger.closest( '.mbn-faq__group' );

		if ( group ) {
			show( document.querySelector( '[data-bs-target="#' + CSS.escape( group.id ) + '"]' ) );
		}

		return show( trigger );
	}

	// inicializa las flechas del contenedor desplazable
	function setupScrollers( wrap, jsClass ) {
		var viewport = wrap.querySelector( '[data-mbn-viewport]' );
		var prev = wrap.querySelector( '[data-mbn-scroll="prev"]' );
		var next = wrap.querySelector( '[data-mbn-scroll="next"]' );

		if ( ! viewport || ! prev || ! next ) {
			return;
		}

		// ajusta la visibilidad y el estado de las dos flechas
		function sync() {
			var overflows = viewport.scrollWidth - viewport.clientWidth > EPSILON;

			prev.hidden = ! overflows;
			next.hidden = ! overflows;
			wrap.classList.toggle( jsClass, overflows );

			if ( ! overflows ) {
				return;
			}

			var max = viewport.scrollWidth - viewport.clientWidth;

			// utiliza aria-disabled para conservar el foco del teclado en los controles
			prev.setAttribute( 'aria-disabled', viewport.scrollLeft <= EPSILON ? 'true' : 'false' );
			next.setAttribute( 'aria-disabled', viewport.scrollLeft >= max - EPSILON ? 'true' : 'false' );
		}

		// desplaza parcialmente la fila para conservar la referencia de las pestañas visibles
		function handleClick( button, direction ) {
			if ( 'true' === button.getAttribute( 'aria-disabled' ) ) {
				return;
			}

			var quiet = window.matchMedia
				&& window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;

			viewport.scrollBy( {
				left: direction * Math.round( viewport.clientWidth * 0.8 ),
				behavior: quiet ? 'auto' : 'smooth',
			} );


			if ( window.requestAnimationFrame ) {
				window.requestAnimationFrame( sync );
			}
		}

		prev.addEventListener( 'click', function () {
			handleClick( prev, -1 );
		} );

		next.addEventListener( 'click', function () {
			handleClick( next, 1 );
		} );

		viewport.addEventListener( 'scroll', sync, { passive: true } );

		// actualiza los controles cuando cambia el ancho disponible del componente
		if ( window.ResizeObserver ) {
			new window.ResizeObserver( sync ).observe( viewport );
		} else {
			window.addEventListener( 'resize', sync );
		}

		sync();
	}

	// inicializa los eventos del bloque de preguntas frecuentes
	function setupBlock( block ) {
		var navWrap = block.querySelector( '.mbn-faq__nav-wrap' );

		if ( navWrap ) {
			setupScrollers( navWrap, 'mbn-faq--js' );
		}

		Array.prototype.forEach.call(
			block.querySelectorAll( '.mbn-faq__side' ),
			function ( side ) {
				setupScrollers( side, 'mbn-faq__side--js' );
			}
		);

		Array.prototype.forEach.call(
			block.querySelectorAll( '[data-bs-toggle="tab"]' ),
			function ( trigger ) {
				trigger.addEventListener( 'shown.bs.tab', function ( event ) {
					var panelId = ( event.target.getAttribute( 'data-bs-target' ) || '' ).replace( '#', '' );

					// actualiza el ancla sin añadir entradas al historial de navegación
					if ( panelId && window.history && window.history.replaceState ) {
						window.history.replaceState( null, '', '#' + panelId );
					}

					if ( event.target.scrollIntoView ) {
						event.target.scrollIntoView( { block: 'nearest', inline: 'nearest' } );
					}
				} );
			}
		);
	}

	// inicializa todos los bloques de la página
	function init() {
		var blocks = document.querySelectorAll( '.mbn-faq' );

		if ( ! blocks.length ) {
			return;
		}

		Array.prototype.forEach.call( blocks, setupBlock );

		// activa el panel asociado al ancla sin modificar la posición de desplazamiento
		if ( window.location.hash.length > 1 ) {
			activateFromId( window.location.hash.slice( 1 ) );
		}
	}

	if ( 'loading' === document.readyState ) {
		document.addEventListener( 'DOMContentLoaded', init );
	} else {
		init();
	}
} )();
