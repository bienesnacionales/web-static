/**
 * Componente global — Pestañas de contenido.
 *
 * El cambio de panel, el foco y las flechas del teclado los resuelve el plugin
 * `tab` de Bootstrap. Este archivo añade las dos cosas que el plugin no trae:
 *
 *   1. **El enlace profundo**, igual que `authorities.js`: si la URL termina en
 *      el id de un panel o de una pestaña se abre esa pestaña, y al cambiar de
 *      pestaña el hash se actualiza con `replaceState` —cada pestaña mirada no
 *      es un paso atrás del historial—.
 *   2. **Las flechas de la botonera** de la maqueta responsive (Figma
 *      442:34244). Nacen con `hidden` en el marcado y solo se revelan cuando la
 *      fila desborda de verdad, que es una medida y no un breakpoint: una
 *      pestaña con un rótulo largo puede desbordar también en desktop.
 *
 * El script es no-op si no hay bloque en la página: el bloque ya viene con una
 * pestaña activa desde el servidor y la fila se desplaza con el gesto nativo.
 *
 * ⚠️ El enlace profundo es **gemelo del de `authorities.js`**. Está asumido y
 * explicado en el docblock de `inc/components/content-tabs.php`.
 *
 * @package mbn
 */

( function () {
	'use strict';

	/* Margen de tolerancia del cálculo de desbordamiento: el ancho de scroll es
	   fraccionario con zoom o con escalado del sistema, y sin holgura las
	   flechas aparecerían y desaparecerían solas en una fila que sí cabe. */
	var EPSILON = 2;

	/**
	 * Activa la pestaña asociada a un id de panel o de botón.
	 *
	 * @param {string} id Identificador sin almohadilla.
	 * @return {boolean} true si se activó alguna pestaña.
	 */
	function activateFromId( id ) {
		if ( ! id ) {
			return false;
		}

		var target = document.getElementById( id );

		if ( ! target ) {
			return false;
		}

		// El hash puede apuntar al panel o al propio botón.
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

		// La botonera se desplaza en horizontal cuando no cabe, así que una
		// pestaña abierta por el hash puede quedar fuera de la vista. `block:
		// "nearest"` evita el salto vertical del valor por defecto.
		if ( trigger.scrollIntoView ) {
			trigger.scrollIntoView( { block: 'nearest', inline: 'nearest' } );
		}

		return true;
	}

	/**
	 * Engancha las flechas de desplazamiento de la botonera.
	 *
	 * @param {HTMLElement} block Contenedor `.mbn-content-tabs`.
	 * @return {void}
	 */
	function setupScrollers( block ) {
		var viewport = block.querySelector( '.mbn-content-tabs__nav-viewport' );
		var prev = block.querySelector( '[data-mbn-scroll="prev"]' );
		var next = block.querySelector( '[data-mbn-scroll="next"]' );

		if ( ! viewport || ! prev || ! next ) {
			return;
		}

		/**
		 * Ajusta la visibilidad y el estado de las dos flechas.
		 *
		 * @return {void}
		 */
		function sync() {
			var overflows = viewport.scrollWidth - viewport.clientWidth > EPSILON;

			prev.hidden = ! overflows;
			next.hidden = ! overflows;
			block.classList.toggle( 'mbn-content-tabs--js', overflows );

			if ( ! overflows ) {
				return;
			}

			var max = viewport.scrollWidth - viewport.clientWidth;

			// `aria-disabled` y no `disabled`: un `disabled` que aparece con el
			// foco puesto lo pierde y deja al teclado sin ancla.
			prev.setAttribute( 'aria-disabled', viewport.scrollLeft <= EPSILON ? 'true' : 'false' );
			next.setAttribute( 'aria-disabled', viewport.scrollLeft >= max - EPSILON ? 'true' : 'false' );
		}

		/**
		 * Desplaza la fila algo menos de una pantalla, para que la pestaña del
		 * borde siga a la vista y no se pierda la referencia.
		 *
		 * El `behavior` se consulta en cada pulsación y no una sola vez al
		 * arrancar: la preferencia del sistema puede cambiar con la página ya
		 * abierta. Pasarlo explícito es obligatorio —un `behavior` en la llamada
		 * gana al `scroll-behavior` de la hoja de estilos, así que sin esto la
		 * animación seguiría corriendo bajo `prefers-reduced-motion: reduce`—.
		 *
		 * @param {number} direction -1 hacia atrás, 1 hacia delante.
		 * @return {void}
		 */
		function scrollTabs( direction ) {
			var quiet = window.matchMedia
				&& window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;

			viewport.scrollBy( {
				left: direction * Math.round( viewport.clientWidth * 0.8 ),
				behavior: quiet ? 'auto' : 'smooth',
			} );
		}

		/**
		 * Desplaza y vuelve a sincronizar el estado de las flechas.
		 *
		 * El `sync()` del fotograma siguiente no sobra: con `behavior: 'auto'`
		 * la posición ya es la definitiva ahí, y así el estado queda correcto
		 * aunque el navegador agrupe o no llegue a emitir el evento `scroll`
		 * —que es justo lo que pasa en Chrome headless con
		 * `--virtual-time-budget` (§10)—. Con `smooth`, el evento va marcando
		 * las posiciones intermedias y la última manda igualmente.
		 *
		 * @param {HTMLElement} button    Flecha pulsada.
		 * @param {number}      direction -1 hacia atrás, 1 hacia delante.
		 * @return {void}
		 */
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

		// El desbordamiento depende del ancho disponible, no solo del de la
		// ventana: el bloque puede vivir dentro de una columna que cambie de
		// tamaño por su cuenta.
		if ( window.ResizeObserver ) {
			new window.ResizeObserver( sync ).observe( viewport );
		} else {
			window.addEventListener( 'resize', sync );
		}

		sync();
	}

	/**
	 * Engancha un bloque de pestañas.
	 *
	 * @param {HTMLElement} block Contenedor `.mbn-content-tabs`.
	 * @return {void}
	 */
	function setupBlock( block ) {
		var triggers = block.querySelectorAll( '[data-bs-toggle="tab"]' );

		Array.prototype.forEach.call( triggers, function ( trigger ) {
			trigger.addEventListener( 'shown.bs.tab', function ( event ) {
				var panelId = ( event.target.getAttribute( 'data-bs-target' ) || '' ).replace( '#', '' );

				if ( panelId && window.history && window.history.replaceState ) {
					window.history.replaceState( null, '', '#' + panelId );
				}

				// El panel que se abre puede ser más alto o más bajo que el
				// anterior; la botonera no cambia, pero el foco sí puede haber
				// llegado a una pestaña que estaba fuera de la vista.
				if ( event.target.scrollIntoView ) {
					event.target.scrollIntoView( { block: 'nearest', inline: 'nearest' } );
				}
			} );
		} );

		setupScrollers( block );
	}

	/**
	 * Inicializa todos los bloques de la página.
	 *
	 * @return {void}
	 */
	function init() {
		var blocks = document.querySelectorAll( '.mbn-content-tabs' );

		if ( ! blocks.length ) {
			return;
		}

		Array.prototype.forEach.call( blocks, setupBlock );

		// El salto del navegador al ancla ya ocurrió; activar la pestaña
		// después solo cambia qué panel se ve, no la posición del scroll.
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
