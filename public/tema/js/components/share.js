/* gestiona las interacciones de enlaces para compartir contenidos */
( function () {
	'use strict';

	var NOTICE_MS = 8000;

	// comprueba la disponibilidad del diálogo de compartir del sistema
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

	// copia el texto mediante la API disponible del portapapeles
	function copyText( text ) {
		if ( navigator.clipboard && typeof navigator.clipboard.writeText === 'function' ) {
			return navigator.clipboard.writeText( text ).catch( function () {
				return legacyCopy( text );
			} );
		}

		return legacyCopy( text );
	}

	// utiliza un campo temporal cuando la API del portapapeles no está disponible
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

	// muestra un aviso en la región de estado del componente
	function announce( notice, text ) {
		if ( ! notice ) {
			return;
		}

		window.clearTimeout( notice.mbnTimer );

		// restablece la región de estado para permitir anuncios consecutivos del mismo mensaje
		notice.textContent = '';

		window.setTimeout( function () {
			notice.textContent = text;
		}, 50 );

		notice.mbnTimer = window.setTimeout( function () {
			notice.textContent = '';
		}, NOTICE_MS );
	}

	// gestiona el clic en una red de mensaje directo
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

		// evita duplicar la dirección cuando el mensaje ya contiene el enlace
		var data = url ? { title: title, text: message, url: url } : { title: title, text: text };

		if ( canUseShareSheet( data ) ) {
			event.preventDefault();

			navigator.share( data ).catch( function ( error ) {
				if ( error && error.name === 'AbortError' ) {
					return;
				}

				// copia el mensaje al portapapeles cuando falla el diálogo del sistema
				copyText( text ).then( function () {
					announce( notice, link.getAttribute( 'data-mbn-share-copied' ) || '' );
				} );
			} );

			return;
		}

		// escritorio: no se cancela la navegación
		copyText( text ).then(
			function () {
				announce( notice, link.getAttribute( 'data-mbn-share-copied' ) || '' );
			},
			function () {
				announce( notice, root && root.getAttribute( 'data-mbn-share-error' ) || 'No se pudo copiar el mensaje. Copia el enlace de esta página.' );
			}
		);
	}

	// inicializa el componente con delegación de eventos
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
