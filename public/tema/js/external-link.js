/* gestiona las interacciones de avisos de enlaces externos */
// inicializa el diálogo de navegación externa

( function () {
	'use strict';

	if ( typeof window === 'undefined' || ! window.document ) {
		return;
	}

	var SELECTOR = '[data-mbn-external-modal]';

	// normaliza el dominio para compararlo con la configuración del servidor
	function normalizaHost( host ) {
		host = String( host || '' ).toLowerCase();

		return 0 === host.indexOf( 'www.' ) ? host.slice( 4 ) : host;
	}

	// obtiene los dominios exentos del aviso de salida
	function hostsPropios( modal ) {
		var lista = [];

		try {
			lista = JSON.parse( modal.getAttribute( 'data-mbn-external-hosts' ) || '[]' );
		} catch ( e ) {
			lista = [];
		}

		if ( ! Array.isArray( lista ) ) {
			lista = [];
		}

		var salida = [ normalizaHost( window.location.hostname ) ];

		for ( var i = 0; i < lista.length; i++ ) {
			var host = normalizaHost( lista[ i ] );

			if ( host && -1 === salida.indexOf( host ) ) {
				salida.push( host );
			}
		}

		return salida;
	}

	// obtiene la lista de enlaces de confianza
	function enlacesDeConfianza( modal ) {
		var lista = [];

		try {
			lista = JSON.parse( modal.getAttribute( 'data-mbn-external-trusted' ) || '[]' );
		} catch ( e ) {
			lista = [];
		}

		if ( ! Array.isArray( lista ) ) {
			return [];
		}

		var salida = [];

		for ( var i = 0; i < lista.length; i++ ) {
			var host = lista[ i ] && normalizaHost( lista[ i ].host );

			if ( host ) {
				salida.push( {
					host: host,
					path: String( lista[ i ].path || '' ).replace( /\/+$/, '' )
				} );
			}
		}

		return salida;
	}

	// indica si un enlace está cubierto por la lista de confianza
	function esDeConfianza( enlace, confianza ) {
		var host = normalizaHost( enlace.hostname );
		var ruta = enlace.pathname || '/';

		for ( var i = 0; i < confianza.length; i++ ) {
			var entrada = confianza[ i ];
			var mismoHost = host === entrada.host ||
				( host.length > entrada.host.length &&
					host.slice( -( entrada.host.length + 1 ) ) === '.' + entrada.host );

			if ( ! mismoHost ) {
				continue;
			}

			if ( ! entrada.path || ruta === entrada.path || 0 === ruta.indexOf( entrada.path + '/' ) ) {
				return true;
			}
		}

		return false;
	}

	// indica si el enlace abriría una pestaña o ventana nueva
	function abrePestanaNueva( enlace ) {
		var destino = ( enlace.getAttribute( 'target' ) || '' ).toLowerCase();

		return '_blank' === destino || '_new' === destino;
	}

	// navega hacia la dirección pendiente de confirmación
	function ir( destino ) {
		if ( ! destino.nueva ) {
			window.location.href = destino.url;
			return;
		}

		var ventana = window.open( destino.url, '_blank' );

		if ( ventana ) {
			// impide el acceso a la ventana de origen al abrir un destino externo
			try {
				ventana.opener = null;
			} catch ( e ) {}

			return;
		}

		window.location.href = destino.url;
	}

	function start() {
		var modal = document.querySelector( SELECTOR );

		if ( ! modal || ! window.bootstrap || ! window.bootstrap.Modal ) {
			return;
		}

		var confirmar = modal.querySelector( '[data-mbn-external-confirm]' );

		if ( ! confirmar ) {
			return;
		}

		var dialogo    = window.bootstrap.Modal.getOrCreateInstance( modal );
		var anuncio    = modal.querySelector( '[data-mbn-external-destination]' );
		var plantilla  = modal.getAttribute( 'data-mbn-external-destination-template' ) || '%s';
		var propios    = hostsPropios( modal );
		var confianza  = enlacesDeConfianza( modal );
		var pendiente  = null;
		var disparador = null;

		document.addEventListener( 'click', function ( ev ) {
			// respeta los eventos de navegación procesados por otros controladores
			if ( ev.defaultPrevented || 0 !== ev.button ) {
				return;
			}

			if ( ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey ) {
				return;
			}

			var enlace = ev.target && ev.target.closest ? ev.target.closest( 'a[href]' ) : null;

			if ( ! enlace || enlace.hasAttribute( 'download' ) ) {
				return;
			}

			// comprueba las exclusiones configuradas en el enlace o sus elementos ascendientes
			if ( enlace.closest( '[data-mbn-external-skip]' ) ) {
				return;
			}

			// excluye los protocolos locales y los enlaces a anclas del documento
			if ( 'http:' !== enlace.protocol && 'https:' !== enlace.protocol ) {
				return;
			}

			if ( ! abrePestanaNueva( enlace ) ) {
				return;
			}

			if ( -1 !== propios.indexOf( normalizaHost( enlace.hostname ) ) ) {
				return;
			}

			if ( esDeConfianza( enlace, confianza ) ) {
				return;
			}

			ev.preventDefault();

			pendiente  = { url: enlace.href, nueva: true };
			disparador = enlace;

			if ( anuncio ) {
				anuncio.textContent = plantilla.replace( '%s', enlace.hostname );
			}

			dialogo.show();
		} );

		confirmar.addEventListener( 'click', function () {
			var destino = pendiente;

			pendiente = null;

			if ( ! destino ) {
				return;
			}

			ir( destino );
			document.dispatchEvent( new CustomEvent( 'mbn:external-opened', { detail: { url: destino.url } } ) );
			dialogo.hide();
		} );

		// restablece el destino pendiente y devuelve el foco al enlace al cerrar el diálogo
		modal.addEventListener( 'hidden.bs.modal', function () {
			pendiente = null;

			if ( anuncio ) {
				anuncio.textContent = '';
			}

			if ( disparador && document.contains( disparador ) && 'function' === typeof disparador.focus ) {
				disparador.focus();
			}

			disparador = null;
		} );
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', start );
	} else {
		start();
	}
}() );
