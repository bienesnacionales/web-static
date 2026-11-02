/* gestiona las interacciones de pestañas de contenido */
( function () {
	'use strict';


	var EPSILON = 2;

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
		var trigger = target.classList.contains( 'mbn-content-tabs__tab' )
			? target
			: document.querySelector( '[data-bs-target="#' + CSS.escape( id ) + '"]' );

		if ( ! trigger || ! trigger.classList.contains( 'mbn-content-tabs__tab' ) ) {
			return false;
		}

		if ( ! window.bootstrap || ! window.bootstrap.Tab ) {
			return false;
		}

		window.bootstrap.Tab.getOrCreateInstance( trigger ).show();


		if ( trigger.scrollIntoView ) {
			trigger.scrollIntoView( { block: 'nearest', inline: 'nearest' } );
		}

		return true;
	}

	// inicializa las flechas de desplazamiento de las pestañas
	function setupScrollers( block ) {
		var viewport = block.querySelector( '.mbn-content-tabs__nav-viewport' );
		var prev = block.querySelector( '[data-mbn-scroll="prev"]' );
		var next = block.querySelector( '[data-mbn-scroll="next"]' );

		if ( ! viewport || ! prev || ! next ) {
			return;
		}

		// ajusta la visibilidad y el estado de las dos flechas
		function sync() {
			var overflows = viewport.scrollWidth - viewport.clientWidth > EPSILON;

			prev.hidden = ! overflows;
			next.hidden = ! overflows;
			block.classList.toggle( 'mbn-content-tabs--js', overflows );

			if ( ! overflows ) {
				return;
			}

			var max = viewport.scrollWidth - viewport.clientWidth;

			// utiliza aria-disabled para conservar el foco del teclado en los controles
			prev.setAttribute( 'aria-disabled', viewport.scrollLeft <= EPSILON ? 'true' : 'false' );
			next.setAttribute( 'aria-disabled', viewport.scrollLeft >= max - EPSILON ? 'true' : 'false' );
		}

		// desplaza parcialmente la fila para conservar la referencia de las pestañas visibles
		function scrollTabs( direction ) {
			var quiet = window.matchMedia
				&& window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;

			viewport.scrollBy( {
				left: direction * Math.round( viewport.clientWidth * 0.8 ),
				behavior: quiet ? 'auto' : 'smooth',
			} );
		}

		// desplaza y vuelve a sincronizar el estado de las flechas
		function handleScrollClick( button, direction ) {
			if ( 'true' === button.getAttribute( 'aria-disabled' ) ) {
				return;
			}

			scrollTabs( direction );

			if ( window.requestAnimationFrame ) {
				window.requestAnimationFrame( sync );
			}
		}

		prev.addEventListener( 'click', function () {
			handleScrollClick( prev, -1 );
		} );

		next.addEventListener( 'click', function () {
			handleScrollClick( next, 1 );
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

	// inicializa los eventos del bloque de pestañas
	function setupBlock( block ) {
		var triggers = block.querySelectorAll( '[data-bs-toggle="tab"]' );

		Array.prototype.forEach.call( triggers, function ( trigger ) {
			trigger.addEventListener( 'shown.bs.tab', function ( event ) {
				var panelId = ( event.target.getAttribute( 'data-bs-target' ) || '' ).replace( '#', '' );

				if ( panelId && window.history && window.history.replaceState ) {
					window.history.replaceState( null, '', '#' + panelId );
				}

				// ajusta la posición de la navegación para mantener visible la pestaña enfocada
				if ( event.target.scrollIntoView ) {
					event.target.scrollIntoView( { block: 'nearest', inline: 'nearest' } );
				}
			} );
		} );

		setupScrollers( block );
	}

	// inicializa todos los bloques de la página
	function init() {
		var blocks = document.querySelectorAll( '.mbn-content-tabs' );

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
