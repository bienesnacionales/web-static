/* gestiona las interacciones de autoridades */
( function () {
	'use strict';

	// botón de pestaña asociado a un id de panel o de botón
	function findTrigger( id ) {
		if ( ! id ) {
			return null;
		}

		var target = document.getElementById( id );

		if ( ! target ) {
			return null;
		}

		// el hash puede apuntar al panel o al propio botón
		var trigger = target.classList.contains( 'mbn-authorities__tab' )
			? target
			: document.querySelector( '[data-bs-target="#' + CSS.escape( id ) + '"]' );

		if ( ! trigger || ! trigger.closest( '.mbn-authorities' ) ) {
			return null;
		}

		return trigger;
	}

	// activa la pestaña asociada a un id de panel o de botón
	function activateFromId( id ) {
		var trigger = findTrigger( id );

		if ( ! trigger || ! window.bootstrap || ! window.bootstrap.Tab ) {
			return false;
		}

		window.bootstrap.Tab.getOrCreateInstance( trigger ).show();

		// mantiene visible la pestaña activa dentro de la navegación horizontal
		if ( trigger.scrollIntoView ) {
			trigger.scrollIntoView( { block: 'nearest', inline: 'nearest' } );
		}

		return true;
	}

	// inicializa los eventos del bloque de pestañas
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

	// obtiene el identificador del ancla de un enlace interno
	function samePageHash( link ) {
		var url;

		try {
			url = new URL( link.href, window.location.href );
		} catch ( e ) {
			return '';
		}

		// /ministerio y /ministerio/ son la misma página
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

	// activa la pestaña indicada por los enlaces internos del documento
	function onDocumentClick( event ) {
		// conserva el comportamiento nativo de las nuevas ventanas y las descargas
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

		// sincroniza el ancla aunque la pestaña seleccionada ya esté activa
		var panelId = ( trigger.getAttribute( 'data-bs-target' ) || '' ).replace( '#', '' );

		if ( panelId && window.history && window.history.replaceState ) {
			window.history.replaceState( null, '', '#' + panelId );
		}

		// desplaza la vista al bloque y establece el foco en la pestaña activa
		var land = function () {
			var block = trigger.closest( '.mbn-authorities' );

			if ( block && block.scrollIntoView ) {
				block.scrollIntoView( { block: 'start' } );
			}

			trigger.focus( { preventScroll: true } );
		};

		// cierra el menú lateral antes de activar la pestaña de destino
		var offcanvas = link.closest( '.offcanvas' );
		var instance  = offcanvas && window.bootstrap.Offcanvas ? window.bootstrap.Offcanvas.getInstance( offcanvas ) : null;

		if ( instance && offcanvas.classList.contains( 'show' ) ) {
			offcanvas.addEventListener( 'hidden.bs.offcanvas', land, { once: true } );
			instance.hide();
			return;
		}

		land();
	}

	// inicializa todos los bloques de la página
	function init() {
		var blocks = document.querySelectorAll( '.mbn-authorities' );

		if ( ! blocks.length ) {
			return;
		}

		Array.prototype.forEach.call( blocks, setupBlock );

		document.addEventListener( 'click', onDocumentClick );

		// sincroniza la pestaña activa con los cambios del historial y del ancla
		window.addEventListener( 'hashchange', function () {
			activateFromId( window.location.hash.slice( 1 ) );
		} );

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
