/**
 * Componente global — Enviar por mensaje directo.
 *
 * Solo actúa sobre las redes que no admiten un mensaje prellenado por URL
 * (Instagram y Facebook, marcadas con `data-mbn-share-dm`). WhatsApp es un
 * enlace normal a `wa.me/?text=` y no pasa por aquí.
 *
 * Al pulsar una de esas redes:
 *
 *   1. En un dispositivo táctil con Web Share API se abre la hoja de compartir
 *      del sistema con el mensaje y el enlace. Ahí la persona elige Instagram o
 *      Messenger y el contacto. Si la cierra sin compartir, no pasa nada más.
 *   2. En cualquier otro caso se copia al portapapeles el mensaje completo, con
 *      el enlace; se avisa en la región de estado y el enlace sigue su curso
 *      normal: abre la bandeja de mensajes de la red en una pestaña nueva.
 *
 * El criterio del punto 1 es `pointer: coarse` y no solo la existencia de
 * `navigator.share`: Chrome y Edge en Windows también la exponen, pero su hoja
 * no ofrece Instagram ni Messenger, y quien pulsó el ícono de Instagram
 * acabaría ante una lista sin Instagram.
 *
 * @package mbn
 */

( function () {
	'use strict';

	var NOTICE_MS = 8000;

	/**
	 * Indica si conviene usar la hoja de compartir del sistema.
	 *
	 * @param {Object} data Datos que se compartirían.
	 * @return {boolean}
	 */
	function canUseShareSheet( data ) {
		if ( typeof navigator.share !== 'function' ) {
			return false;
		}

		if ( ! window.matchMedia || ! window.matchMedia( '(pointer: coarse)' ).matches ) {
			return false;
		}

		if ( typeof navigator.canShare === 'function' ) {
			try {
				return navigator.canShare( data );
			} catch ( e ) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Copia un texto con la API del portapapeles y, si no está, con execCommand.
	 *
	 * Se llama dentro del propio evento de clic: los navegadores exigen un gesto
	 * del usuario para escribir en el portapapeles.
	 *
	 * @param {string} text Texto a copiar.
	 * @return {Promise<void>}
	 */
	function copyText( text ) {
		if ( navigator.clipboard && typeof navigator.clipboard.writeText === 'function' ) {
			return navigator.clipboard.writeText( text ).catch( function () {
				return legacyCopy( text );
			} );
		}

		return legacyCopy( text );
	}

	/**
	 * Copia mediante un textarea temporal (contextos sin Clipboard API).
	 *
	 * @param {string} text Texto a copiar.
	 * @return {Promise<void>}
	 */
	function legacyCopy( text ) {
		return new Promise( function ( resolve, reject ) {
			var area = document.createElement( 'textarea' );
			var ok = false;

			area.value = text;
			area.setAttribute( 'readonly', '' );
			area.style.position = 'fixed';
			area.style.top = '-1000px';
			area.style.opacity = '0';
			document.body.appendChild( area );
			area.select();

			try {
				ok = document.execCommand( 'copy' );
			} catch ( e ) {
				ok = false;
			}

			document.body.removeChild( area );

			if ( ok ) {
				resolve();
			} else {
				reject( new Error( 'copy' ) );
			}
		} );
	}

	/**
	 * Muestra un aviso en la región de estado del componente.
	 *
	 * @param {HTMLElement|null} notice Región de estado.
	 * @param {string}           text   Texto del aviso.
	 * @return {void}
	 */
	function announce( notice, text ) {
		if ( ! notice ) {
			return;
		}

		window.clearTimeout( notice.mbnTimer );

		// Vaciar y volver a escribir en otro tick hace que un lector de pantalla
		// repita el aviso aunque el texto sea el mismo que la vez anterior.
		notice.textContent = '';

		window.setTimeout( function () {
			notice.textContent = text;
		}, 50 );

		notice.mbnTimer = window.setTimeout( function () {
			notice.textContent = '';
		}, NOTICE_MS );
	}

	/**
	 * Gestiona el clic en una red de mensaje directo.
	 *
	 * @param {MouseEvent} event Evento de clic.
	 * @return {void}
	 */
	function onClick( event ) {
		var link = event.target.closest( '[data-mbn-share-dm]' );

		if ( ! link ) {
			return;
		}

		var root = link.closest( '[data-mbn-share]' );
		var notice = root ? root.querySelector( '[data-mbn-share-notice]' ) : null;
		var text = link.getAttribute( 'data-mbn-share-text' ) || '';
		var message = link.getAttribute( 'data-mbn-share-message' ) || '';
		var url = link.getAttribute( 'data-mbn-share-url' ) || '';
		var title = link.getAttribute( 'data-mbn-share-title' ) || '';

		// Con el enlace dentro del texto (marcador {enlace}) se comparte solo el
		// texto: pasar además `url` lo duplicaría en las apps que concatenan.
		var data = url ? { title: title, text: message, url: url } : { title: title, text: text };

		if ( canUseShareSheet( data ) ) {
			event.preventDefault();

			navigator.share( data ).catch( function ( error ) {
				if ( error && error.name === 'AbortError' ) {
					return;
				}

				// La hoja falló por otro motivo: se cae al portapapeles. No se abre
				// la bandeja con window.open: fuera del gesto del usuario el
				// bloqueador de ventanas emergentes lo impediría en silencio, y el
				// aviso ya indica dónde pegar el mensaje.
				copyText( text ).then( function () {
					announce( notice, link.getAttribute( 'data-mbn-share-copied' ) || '' );
				} );
			} );

			return;
		}

		// Escritorio: no se cancela la navegación. El enlace abre la bandeja en
		// una pestaña nueva y, a la vez, el mensaje queda en el portapapeles.
		copyText( text ).then(
			function () {
				announce( notice, link.getAttribute( 'data-mbn-share-copied' ) || '' );
			},
			function () {
				announce( notice, root && root.getAttribute( 'data-mbn-share-error' ) || 'No se pudo copiar el mensaje. Copia el enlace de esta página.' );
			}
		);
	}

	/**
	 * Inicializa el componente con delegación de eventos.
	 *
	 * @return {void}
	 */
	function init() {
		if ( ! document.querySelector( '[data-mbn-share]' ) ) {
			return;
		}

		document.addEventListener( 'click', onClick );
	}

	if ( 'loading' === document.readyState ) {
		document.addEventListener( 'DOMContentLoaded', init );
	} else {
		init();
	}
} )();
