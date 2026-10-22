/**
 * Componente global — Preguntas frecuentes.
 *
 * El cambio de panel, el foco y las flechas del teclado los resuelve el plugin
 * `tab` de Bootstrap, en los dos niveles de pestañas. Este archivo añade lo que
 * el plugin no trae:
 *
 *   1. **El enlace profundo**, como en `authorities.js` y `content-tabs.js`,
 *      pero con un salto más: el hash puede apuntar a una categoría que vive
 *      dentro de un grupo cerrado, así que **primero se abre el grupo que la
 *      contiene y después la categoría**. Al revés no funciona: activar una
 *      pestaña dentro de un panel oculto no lo muestra.
 *   2. **Las flechas de las dos botoneras**, que nacen con `hidden` y solo se
 *      revelan cuando la fila desborda de verdad —una medida, no un
 *      breakpoint—. La columna de categorías es vertical desde `lg`, y ahí no
 *      hay desbordamiento horizontal que medir, así que el mismo cálculo la
 *      deja sin flechas sin necesidad de consultar el ancho de la ventana.
 *
 * El script es no-op si no hay bloque en la página: el bloque ya viene con una
 * pestaña activa en cada nivel desde el servidor y las filas se desplazan con
 * el gesto nativo.
 *
 * ⚠️ El desplazamiento de la botonera es **gemelo del de `content-tabs.js`**.
 * Está asumido y explicado en el docblock de `inc/components/faq.php` y en la
 * cabecera de `faq.css`: la extracción de una capa común se hará cuando toque
 * el bloque de pestañas por otro motivo, no de forma preventiva (§7.4).
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
	 * Muestra la pestaña indicada, sea de grupo o de categoría.
	 *
	 * @param {HTMLElement} trigger Botón con `data-bs-toggle="tab"`.
	 * @return {boolean} true si Bootstrap pudo activarla.
	 */
	function show( trigger ) {
		if ( ! trigger || ! window.bootstrap || ! window.bootstrap.Tab ) {
			return false;
		}

		window.bootstrap.Tab.getOrCreateInstance( trigger ).show();

		// Las botoneras se desplazan en horizontal cuando no caben, así que una
		// pestaña abierta por el hash puede quedar fuera de la vista.
		// `block: "nearest"` evita el salto vertical del valor por defecto.
		if ( trigger.scrollIntoView ) {
			trigger.scrollIntoView( { block: 'nearest', inline: 'nearest' } );
		}

		return true;
	}

	/**
	 * Activa la pestaña asociada a un id de panel o de botón.
	 *
	 * Antes de abrirla sube por el DOM buscando el panel de grupo que la
	 * contiene: una categoría dentro de un grupo cerrado no se ve por mucho que
	 * Bootstrap la marque como activa.
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

	/**
	 * Engancha un par de flechas a su viewport desplazable.
	 *
	 * @param {HTMLElement} wrap      Contenedor con las flechas y el viewport.
	 * @param {string}      jsClass   Clase que marca «las flechas están a la vista».
	 * @return {void}
	 */
	function setupScrollers( wrap, jsClass ) {
		var viewport = wrap.querySelector( '[data-mbn-viewport]' );
		var prev = wrap.querySelector( '[data-mbn-scroll="prev"]' );
		var next = wrap.querySelector( '[data-mbn-scroll="next"]' );

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
			wrap.classList.toggle( jsClass, overflows );

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
		 * abierta. Pasarlo explícito es obligatorio —un `behavior` en la
		 * llamada gana al `scroll-behavior` de la hoja, así que sin esto la
		 * animación seguiría corriendo bajo `prefers-reduced-motion: reduce`—.
		 *
		 * @param {HTMLElement} button    Flecha pulsada.
		 * @param {number}      direction -1 hacia atrás, 1 hacia delante.
		 * @return {void}
		 */
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

			// El `sync()` del fotograma siguiente no sobra: con `behavior:
			// 'auto'` la posición ya es la definitiva ahí, y así el estado queda
			// correcto aunque el navegador no llegue a emitir el evento
			// `scroll` —que es lo que pasa en Chrome headless (§10)—.
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
	 * Engancha un bloque de preguntas frecuentes.
	 *
	 * @param {HTMLElement} block Contenedor `.mbn-faq`.
	 * @return {void}
	 */
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

					// `replaceState` y no `pushState`: cada pestaña mirada no es
					// un paso atrás del historial, o salir de la página exigiría
					// tantos «atrás» como pestañas se hubieran abierto.
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

	/**
	 * Inicializa todos los bloques de la página.
	 *
	 * @return {void}
	 */
	function init() {
		var blocks = document.querySelectorAll( '.mbn-faq' );

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
