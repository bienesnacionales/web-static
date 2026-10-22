/**
 * Componente global — Autoridades (pestañas).
 *
 * El cambio de panel, el foco y las flechas los resuelve el plugin `tab` de
 * Bootstrap: este archivo solo añade el enlace profundo, que es lo que el
 * plugin no trae.
 *
 *   1. Al cargar, si la URL termina en el id de un panel o de una pestaña, se
 *      abre esa pestaña. Permite enlazar desde el menú del header a
 *      `/ministerio/#<id>-panel-2` y aterrizar en «Autoridades» directamente.
 *   2. Al cambiar de pestaña, el hash se actualiza con `replaceState`, de modo
 *      que copiar la URL de la barra comparte lo que se está viendo. Se usa
 *      `replaceState` y no `pushState` a propósito: cada pestaña abierta no es
 *      un paso atrás en el historial, y con `pushState` salir de la página
 *      exigiría tantos «atrás» como pestañas se hubieran mirado.
 *   3. **Un enlace a una pestaña de esta misma página se resuelve sin recargar**
 *      (2026-10-07). Los submenús «Autoridades», «Seremi Regionales» y
 *      «Divisiones» del header apuntan a `/ministerio/#<id>-panel-N`. Estando ya
 *      en /ministerio, el navegador no recarga ante un enlace que solo cambia el
 *      ancla, así que el paso 1 no se ejecutaba y la pestaña no cambiaba; y si
 *      el ancla era la misma que ya había en la barra —el paso 2 la deja ahí—,
 *      no ocurría absolutamente nada. En móvil, además, el menú lateral se
 *      quedaba abierto encima de la página. Ahora el clic se intercepta: abre la
 *      pestaña, cierra el menú lateral si el enlace venía de él, lleva la vista
 *      al bloque y deja el foco en la pestaña, que es lo que haría una
 *      navegación de verdad. `hashchange` cubre el resto —atrás, adelante, un
 *      ancla escrita a mano—.
 *
 * El script es no-op si no hay bloque en la página o si Bootstrap no cargó: el
 * bloque ya viene con una pestaña activa desde el servidor.
 *
 * @package mbn
 */

( function () {
	'use strict';

	/**
	 * Botón de pestaña asociado a un id de panel o de botón.
	 *
	 * Solo devuelve pestañas de un bloque `.mbn-authorities`: un ancla a
	 * cualquier otra cosa de la página no es asunto de este script.
	 *
	 * @param {string} id Identificador sin almohadilla.
	 * @return {HTMLElement|null} El botón, o null.
	 */
	function findTrigger( id ) {
		if ( ! id ) {
			return null;
		}

		var target = document.getElementById( id );

		if ( ! target ) {
			return null;
		}

		// El hash puede apuntar al panel o al propio botón.
		var trigger = target.classList.contains( 'mbn-authorities__tab' )
			? target
			: document.querySelector( '[data-bs-target="#' + CSS.escape( id ) + '"]' );

		if ( ! trigger || ! trigger.closest( '.mbn-authorities' ) ) {
			return null;
		}

		return trigger;
	}

	/**
	 * Activa la pestaña asociada a un id de panel o de botón.
	 *
	 * @param {string} id Identificador sin almohadilla.
	 * @return {boolean} true si se activó alguna pestaña.
	 */
	function activateFromId( id ) {
		var trigger = findTrigger( id );

		if ( ! trigger || ! window.bootstrap || ! window.bootstrap.Tab ) {
			return false;
		}

		window.bootstrap.Tab.getOrCreateInstance( trigger ).show();

		// La botonera se desplaza en horizontal cuando no cabe (móvil), así que
		// una pestaña abierta por el hash puede quedar fuera de la vista. Solo
		// se desplaza el contenedor de la botonera, no la página: `block:
		// "nearest"` evita el salto vertical que daría el valor por defecto.
		if ( trigger.scrollIntoView ) {
			trigger.scrollIntoView( { block: 'nearest', inline: 'nearest' } );
		}

		return true;
	}

	/**
	 * Engancha un bloque de pestañas.
	 *
	 * @param {HTMLElement} block Contenedor `.mbn-authorities`.
	 * @return {void}
	 */
	function setupBlock( block ) {
		var triggers = block.querySelectorAll( '[data-bs-toggle="tab"]' );

		Array.prototype.forEach.call( triggers, function ( trigger ) {
			trigger.addEventListener( 'shown.bs.tab', function ( event ) {
				var panelId = ( event.target.getAttribute( 'data-bs-target' ) || '' ).replace( '#', '' );

				if ( ! panelId || ! window.history || ! window.history.replaceState ) {
					return;
				}

				window.history.replaceState( null, '', '#' + panelId );
			} );
		} );
	}

	/**
	 * Id del ancla si el enlace apunta a ESTA página.
	 *
	 * Solo cuenta una URL que difiera de la actual únicamente en el ancla: es el
	 * caso en que el navegador no recarga. Con otra ruta o con otra cadena de
	 * consulta hay recarga, y de eso ya se encarga el paso 1 al cargar.
	 *
	 * @param {HTMLAnchorElement} link Enlace pulsado.
	 * @return {string} Id sin almohadilla, o '' si no aplica.
	 */
	function samePageHash( link ) {
		var url;

		try {
			url = new URL( link.href, window.location.href );
		} catch ( e ) {
			return '';
		}

		// `/ministerio` y `/ministerio/` son la misma página.
		var clean = function ( path ) {
			return path.replace( /\/+$/, '' );
		};

		if (
			url.hash.length < 2 ||
			url.origin !== window.location.origin ||
			url.search !== window.location.search ||
			clean( url.pathname ) !== clean( window.location.pathname )
		) {
			return '';
		}

		try {
			return decodeURIComponent( url.hash.slice( 1 ) );
		} catch ( e ) {
			return url.hash.slice( 1 );
		}
	}

	/**
	 * Clic en cualquier enlace del documento que apunte a una pestaña de esta
	 * página: los submenús del header, sobre todo (ver el paso 3 del docblock).
	 *
	 * Se escucha en el documento, en fase de burbuja: el menú del header cierra
	 * su desplegable en el propio enlace, antes de llegar aquí.
	 *
	 * @param {MouseEvent} event Clic.
	 * @return {void}
	 */
	function onDocumentClick( event ) {
		// Lo que el navegador abre por su cuenta —pestaña nueva, ventana nueva,
		// descarga— no se toca.
		if ( event.defaultPrevented || 0 !== event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ) {
			return;
		}

		var link = event.target && event.target.closest ? event.target.closest( 'a[href]' ) : null;

		if ( ! link || ( link.target && '_self' !== link.target ) || link.hasAttribute( 'download' ) ) {
			return;
		}

		var id      = samePageHash( link );
		var trigger = findTrigger( id );

		if ( ! trigger || ! window.bootstrap || ! window.bootstrap.Tab ) {
			return;
		}

		event.preventDefault();
		activateFromId( id );

		// Si la pestaña ya estaba abierta, `shown.bs.tab` no salta y el ancla
		// de la barra no se actualizaría: se escribe aquí, la del panel.
		var panelId = ( trigger.getAttribute( 'data-bs-target' ) || '' ).replace( '#', '' );

		if ( panelId && window.history && window.history.replaceState ) {
			window.history.replaceState( null, '', '#' + panelId );
		}

		// Aterrizar como lo haría una navegación: la vista en el bloque y el
		// foco en su pestaña. El foco va sin desplazamiento propio para no
		// pelear con el `scrollIntoView`.
		var land = function () {
			var block = trigger.closest( '.mbn-authorities' );

			if ( block && block.scrollIntoView ) {
				block.scrollIntoView( { block: 'start' } );
			}

			trigger.focus( { preventScroll: true } );
		};

		// Desde el menú lateral (tablet y móvil): cerrarlo primero. Mientras
		// está abierto, Bootstrap bloquea el desplazamiento del cuerpo, así que
		// el aterrizaje espera a que termine de cerrarse. Ese listener se
		// registra después del de `header-nav.js`, que devuelve el foco a la
		// hamburguesa, y por eso el foco acaba en la pestaña.
		var offcanvas = link.closest( '.offcanvas' );
		var instance  = offcanvas && window.bootstrap.Offcanvas ? window.bootstrap.Offcanvas.getInstance( offcanvas ) : null;

		if ( instance && offcanvas.classList.contains( 'show' ) ) {
			offcanvas.addEventListener( 'hidden.bs.offcanvas', land, { once: true } );
			instance.hide();
			return;
		}

		land();
	}

	/**
	 * Inicializa todos los bloques de la página.
	 *
	 * @return {void}
	 */
	function init() {
		var blocks = document.querySelectorAll( '.mbn-authorities' );

		if ( ! blocks.length ) {
			return;
		}

		Array.prototype.forEach.call( blocks, setupBlock );

		document.addEventListener( 'click', onDocumentClick );

		// Atrás, adelante o un ancla escrita a mano en la barra. `replaceState`
		// no dispara `hashchange`, así que el paso 2 no entra en bucle.
		window.addEventListener( 'hashchange', function () {
			activateFromId( window.location.hash.slice( 1 ) );
		} );

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
