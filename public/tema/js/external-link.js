/**
 * Shell — Aviso de salida a un sitio externo.
 *
 * Intercepta el clic sobre cualquier enlace del documento que cumpla las dos
 * condiciones del encargo —**abre pestaña nueva** y **apunta a otro dominio**—
 * y, en su lugar, abre el diálogo de `template-parts/external-link-modal.php`.
 * Si se confirma, el destino se abre como lo habría hecho el enlace.
 *
 * Decisiones:
 *
 * - **Delegación en `document`, no un listener por enlace.** El contenido llega
 *   del editor y de veintiún componentes, y varias regiones se repintan por
 *   AJAX (`news-search`, `procedure-search`): un listener por enlace habría que
 *   volver a colocarlo en cada repintado.
 * - **El clic con modificador o con el botón central se deja pasar.** Ahí el
 *   navegador abre la pestaña por su cuenta y el enlace ya es explícito: un
 *   diálogo que aparece cuando la pestaña ya se abrió sólo estorba.
 * - **`preventDefault()` sólo cuando el diálogo se va a abrir de verdad.** Si
 *   Bootstrap no está cargado el script no engancha nada y los enlaces navegan
 *   como siempre: el aviso es una capa encima, no un requisito para navegar.
 * - **Al confirmar se usa `window.open` sin el `noopener` de `features`.** Con
 *   esa opción el navegador devuelve `null` siempre y sería imposible
 *   distinguir el bloqueo de ventanas emergentes; el `opener` se corta a mano
 *   justo después, que protege igual. Si aun así no hay ventana —bloqueo
 *   estricto—, se navega en la misma pestaña: quedarse sin ir a ningún sitio
 *   tras pulsar «Continuar» es peor que perder la pestaña nueva.
 *
 * Los **enlaces de confianza** de las opciones del sitio llegan en
 * `data-mbn-external-trusted` como pares host + ruta, ya normalizados en PHP
 * (`mbn_external_link_trusted()`). Un enlace cubierto por alguno navega sin
 * diálogo.
 *
 * El foco vuelve al enlace que abrió el diálogo: Bootstrap sólo lo devuelve
 * cuando la apertura vino de un `data-bs-toggle`, y aquí viene del interceptor.
 *
 * @package mbn
 */

( function () {
	'use strict';

	if ( typeof window === 'undefined' || ! window.document ) {
		return;
	}

	var SELECTOR = '[data-mbn-external-modal]';

	/**
	 * Normaliza un host para compararlo (igual que en PHP).
	 *
	 * @param {string} host Host de una URL.
	 * @return {string} Host en minúsculas y sin el `www.` de cabecera.
	 */
	function normalizaHost( host ) {
		host = String( host || '' ).toLowerCase();

		return 0 === host.indexOf( 'www.' ) ? host.slice( 4 ) : host;
	}

	/**
	 * Los hosts que no disparan el aviso.
	 *
	 * A los que declara PHP se suma el de la ventana: en un entorno servido por
	 * IP o por un túnel de pruebas, el host real no coincide con la opción de
	 * WordPress y el sitio entero pasaría por externo.
	 *
	 * @param {HTMLElement} modal El diálogo.
	 * @return {string[]} Hosts normalizados.
	 */
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

	/**
	 * La lista de enlaces de confianza.
	 *
	 * Se descarta cualquier entrada sin host: un JSON manipulado o un filtro
	 * mal escrito no pueden convertirse en «todo es de confianza».
	 *
	 * @param {HTMLElement} modal El diálogo.
	 * @return {{host: string, path: string}[]} Entradas válidas.
	 */
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

	/**
	 * Indica si un enlace está cubierto por la lista de confianza.
	 *
	 * El host tiene que ser el de la entrada o un subdominio suyo, comparando
	 * por etiquetas completas: `gob.cl` cubre `datos.gob.cl` y no
	 * `gob.cl.ejemplo.com` ni `nogob.cl`. Con ruta, la del enlace tiene que ser
	 * esa o colgar de ella por un `/`: `/tramites` cubre `/tramites/arriendo` y
	 * no `/tramites-antiguos`.
	 *
	 * @param {HTMLAnchorElement}             enlace    Enlace pulsado.
	 * @param {{host: string, path: string}[]} confianza Lista normalizada.
	 * @return {boolean}
	 */
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

	/**
	 * Indica si el enlace abriría una pestaña o ventana nueva.
	 *
	 * @param {HTMLAnchorElement} enlace Enlace pulsado.
	 * @return {boolean}
	 */
	function abrePestanaNueva( enlace ) {
		var destino = ( enlace.getAttribute( 'target' ) || '' ).toLowerCase();

		return '_blank' === destino || '_new' === destino;
	}

	/**
	 * Lleva al destino guardado.
	 *
	 * @param {{url: string, nueva: boolean}} destino Destino del enlace pulsado.
	 */
	function ir( destino ) {
		if ( ! destino.nueva ) {
			window.location.href = destino.url;
			return;
		}

		var ventana = window.open( destino.url, '_blank' );

		if ( ventana ) {
			// El `rel="noopener"` del enlace no viaja en `window.open`: se corta
			// aquí para que el sitio de destino no pueda tocar esta pestaña.
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
			// Otro script ya decidió qué hacer con este clic.
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

			// Exención explícita, propia o heredada de un ancestro.
			if ( enlace.closest( '[data-mbn-external-skip]' ) ) {
				return;
			}

			// `mailto:`, `tel:`, `javascript:` y los anclas no salen a ningún sitio.
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
			dialogo.hide();
		} );

		// Se cierre como se cierre —aspa, «Cancelar», Escape, telón o confirmando
		// en una pestaña nueva—, el diálogo queda sin destino y el foco vuelve al
		// enlace. Con navegación en la misma pestaña este documento ya se va, así
		// que devolver el foco ahí no molesta.
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
