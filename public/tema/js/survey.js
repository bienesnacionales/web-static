/**
 * Shell — Encuesta de satisfacción.
 *
 * Gobierna el botón flotante y el diálogo que imprime
 * `inc/survey-frontend.php`: el paso a paso, la escala de estrellas, el
 * progreso guardado y el envío.
 *
 * Decisiones:
 *
 * - **El marcado ya viene hecho desde PHP.** Este script no construye pasos ni
 *   pide el cuestionario al servidor: sólo muestra uno y oculta el resto. Un
 *   error de red no puede dejar el diálogo vacío, y las respuestas marcadas
 *   siguen en el DOM aunque el envío falle.
 * - **La escala es un `radiogroup` con «roving tabindex»**: un solo punto de
 *   entrada con el tabulador y las flechas para moverse dentro, que es lo que
 *   un lector de pantalla espera de un grupo de opciones excluyentes.
 * - **El almacenamiento local es opcional y desechable.** Guarda versión, paso,
 *   valoraciones y marca de tiempo —nada personal— y se descarta solo a las 24
 *   horas o en cuanto cambia la versión del cuestionario. Si el navegador lo
 *   impide (modo privado) o el sitio no lo permite, la encuesta funciona igual
 *   con el progreso en memoria.
 * - **La apertura automática cuenta tiempo de navegación, no de reloj.** Sólo
 *   suma con la pestaña a la vista, se acumula de una página a otra dentro de
 *   la misma visita y abre el diálogo **una sola vez**: después, el botón
 *   flotante sigue siendo la única vía.
 * - **El bloqueo por frecuencia lo decide el servidor.** Aquí sólo se oculta el
 *   botón —apariencia— con lo último que el servidor respondió; el envío se
 *   comprueba de nuevo del otro lado.
 * - **El foco vuelve al botón flotante al cerrar**: Bootstrap sólo lo devuelve
 *   cuando la apertura vino de un `data-bs-toggle`, y aquí viene de un clic
 *   interceptado (mismo caso que `external-link.js`).
 *
 * @package mbn
 */

( function () {
	'use strict';

	if ( typeof window === 'undefined' || ! window.document ) {
		return;
	}

	var STORAGE_PROGRESS = 'mbn-survey-progress';
	var STORAGE_VISITOR  = 'mbn-survey-visitor';
	var STORAGE_BLOCKED  = 'mbn-survey-blocked';

	// Las dos de la apertura automática viven en `sessionStorage`: el tiempo de
	// navegación es de ESTA visita, y guardarlo en `localStorage` haría que la
	// siguiente empezara con el contador ya vencido.
	var SESION_TIEMPO = 'mbn-survey-browsing';
	var SESION_AUTO   = 'mbn-survey-auto';

	/**
	 * Acceso a un almacén del navegador que nunca lanza.
	 *
	 * En modo privado, con las cookies bloqueadas o si el sitio veta el
	 * almacenamiento (`window.mbnSurveyStorageAllowed === false`, el gancho para
	 * el gestor de consentimiento), se cae a un objeto en memoria: el progreso
	 * dura lo que la pestaña, que es exactamente lo que se espera.
	 *
	 * @param {string} tipo 'localStorage' o 'sessionStorage'.
	 * @return {Object} Las tres operaciones, a prueba de excepciones.
	 */
	function crearAlmacen( tipo ) {
		var memoria = {};
		var permitido = window.mbnSurveyStorageAllowed !== false;

		function disponible() {
			if ( ! permitido ) {
				return false;
			}

			try {
				window[ tipo ].setItem( 'mbn-survey-test', '1' );
				window[ tipo ].removeItem( 'mbn-survey-test' );

				return true;
			} catch ( e ) {
				return false;
			}
		}

		var nativo = disponible();

		return {
			lee: function ( clave ) {
				if ( ! nativo ) {
					return Object.prototype.hasOwnProperty.call( memoria, clave ) ? memoria[ clave ] : null;
				}

				try {
					return window[ tipo ].getItem( clave );
				} catch ( e ) {
					return null;
				}
			},
			escribe: function ( clave, valor ) {
				if ( ! nativo ) {
					memoria[ clave ] = valor;

					return;
				}

				try {
					window[ tipo ].setItem( clave, valor );
				} catch ( e ) {
					memoria[ clave ] = valor;
				}
			},
			borra: function ( clave ) {
				delete memoria[ clave ];

				if ( ! nativo ) {
					return;
				}

				try {
					window[ tipo ].removeItem( clave );
				} catch ( e ) {}
			}
		};
	}

	var almacen = crearAlmacen( 'localStorage' );
	var sesion  = crearAlmacen( 'sessionStorage' );

	/**
	 * El identificador anónimo del visitante.
	 *
	 * Aleatorio de verdad (`crypto.getRandomValues`) y sin ninguna relación con
	 * el equipo, el navegador ni la persona: no es una huella, es un número que
	 * sólo sirve para que el servidor sepa que ya respondió.
	 *
	 * @return {string} 32 caracteres hexadecimales.
	 */
	function identificador() {
		var guardado = almacen.lee( STORAGE_VISITOR );

		if ( guardado && /^[a-f0-9]{32}$/.test( guardado ) ) {
			return guardado;
		}

		var bytes = new Uint8Array( 16 );

		if ( window.crypto && window.crypto.getRandomValues ) {
			window.crypto.getRandomValues( bytes );
		} else {
			// Sin `crypto` no hay forma de generar algo imprevisible; el valor
			// sirve igual para distinguir visitas, y el bloqueo real lo decide
			// el servidor.
			for ( var i = 0; i < bytes.length; i++ ) {
				bytes[ i ] = Math.floor( Math.random() * 256 );
			}
		}

		var salida = '';

		for ( var j = 0; j < bytes.length; j++ ) {
			salida += ( '0' + bytes[ j ].toString( 16 ) ).slice( -2 );
		}

		almacen.escribe( STORAGE_VISITOR, salida );

		return salida;
	}

	/**
	 * El tabindex que corresponde a una estrella.
	 *
	 * «Roving tabindex»: sólo una estrella del grupo entra con el tabulador —la
	 * elegida, o la primera si aún no hay respuesta— y dentro se circula con las
	 * flechas.
	 *
	 * @param {number} propio  Valor de la estrella.
	 * @param {number} elegido Valor elegido en el paso.
	 * @return {string}
	 */
	function tabindexDe( propio, elegido ) {
		if ( ! elegido ) {
			return 1 === propio ? '0' : '-1';
		}

		return propio === elegido ? '0' : '-1';
	}

	/**
	 * Arranca la encuesta de un documento.
	 *
	 * @param {HTMLElement} modal El diálogo.
	 * @param {HTMLElement} lanzador El botón flotante.
	 */
	function Encuesta( modal, lanzador ) {
		var self = this;

		this.modal     = modal;
		this.lanzador  = lanzador;
		this.formulario = modal.querySelector( '[data-mbn-survey-form]' );
		this.pasos     = Array.prototype.slice.call( modal.querySelectorAll( '[data-mbn-survey-step]' ) );
		this.puntos    = Array.prototype.slice.call( modal.querySelectorAll( '[data-mbn-survey-dot]' ) );
		this.atras     = modal.querySelector( '[data-mbn-survey-back]' );
		this.siguiente = modal.querySelector( '[data-mbn-survey-next]' );
		this.aviso     = modal.querySelector( '[data-mbn-survey-alert]' );
		this.progreso  = modal.querySelector( '[data-mbn-survey-progress]' );
		this.gracias   = modal.querySelector( '[data-mbn-survey-done]' );
		this.cabecera  = modal.querySelector( '[data-mbn-survey-header]' );
		this.privacidad = modal.querySelector( '[data-mbn-survey-privacy]' );

		this.endpoint   = modal.getAttribute( 'data-mbn-survey-endpoint' ) || '';
		this.accionEnvio = modal.getAttribute( 'data-mbn-survey-action-submit' ) || '';
		this.accionEstado = modal.getAttribute( 'data-mbn-survey-action-status' ) || '';
		this.nonce      = modal.getAttribute( 'data-mbn-survey-nonce' ) || '';
		this.version    = parseInt( modal.getAttribute( 'data-mbn-survey-version' ), 10 ) || 0;
		this.total      = parseInt( modal.getAttribute( 'data-mbn-survey-total' ), 10 ) || this.pasos.length;
		this.ttl        = ( parseInt( modal.getAttribute( 'data-mbn-survey-ttl' ), 10 ) || 0 ) * 1000;
		this.oculta     = '1' === modal.getAttribute( 'data-mbn-survey-hide' );
		this.auto       = '1' === modal.getAttribute( 'data-mbn-survey-auto' );
		this.autoDelay  = ( parseInt( modal.getAttribute( 'data-mbn-survey-auto-delay' ), 10 ) || 0 ) * 1000;
		this.reloj      = 0;
		this.textos     = self.leeTextos();

		this.respuestas = {};
		this.pasoActual = 1;
		this.enviando   = false;
		this.bloqueado  = false;

		if ( ! this.formulario || ! this.pasos.length || ! this.siguiente ) {
			return;
		}

		this.restauraProgreso();
		this.conecta();
		this.muestraPaso( this.pasoActual );
		this.revelaLanzador();
		this.programaApertura();
	}

	/**
	 * Los mensajes que imprimió PHP.
	 *
	 * @return {Object} Mapa de textos; vacío si el atributo no es JSON válido.
	 */
	Encuesta.prototype.leeTextos = function () {
		try {
			var crudo = JSON.parse( this.modal.getAttribute( 'data-mbn-survey-messages' ) || '{}' );

			return ( crudo && typeof crudo === 'object' ) ? crudo : {};
		} catch ( e ) {
			return {};
		}
	};

	/**
	 * Engancha todos los escuchadores.
	 */
	Encuesta.prototype.conecta = function () {
		var self = this;

		if ( this.lanzador ) {
			this.lanzador.addEventListener( 'click', function () {
				self.abre();
			} );
		}

		this.pasos.forEach( function ( paso ) {
			var escala = paso.querySelector( '[data-mbn-survey-scale]' );

			if ( ! escala ) {
				return;
			}

			escala.addEventListener( 'click', function ( evento ) {
				var estrella = evento.target.closest( '[data-mbn-survey-value]' );

				if ( estrella ) {
					self.elige( paso, parseInt( estrella.getAttribute( 'data-mbn-survey-value' ), 10 ) );
				}
			} );

			escala.addEventListener( 'keydown', function ( evento ) {
				self.teclado( paso, evento );
			} );

			// Anticipo visual: al recorrer la escala con el ratón se pintan las
			// estrellas hasta la de debajo del cursor, sin tocar el valor.
			escala.addEventListener( 'mouseover', function ( evento ) {
				var estrella = evento.target.closest( '[data-mbn-survey-value]' );

				if ( estrella ) {
					self.pinta( paso, parseInt( estrella.getAttribute( 'data-mbn-survey-value' ), 10 ), true );
				}
			} );

			escala.addEventListener( 'mouseleave', function () {
				self.pinta( paso, self.valorDe( paso ), false );
			} );
		} );

		if ( this.atras ) {
			this.atras.addEventListener( 'click', function () {
				self.muestraPaso( self.pasoActual - 1 );
			} );
		}

		this.formulario.addEventListener( 'submit', function ( evento ) {
			evento.preventDefault();

			if ( self.pasoActual < self.total ) {
				self.muestraPaso( self.pasoActual + 1 );

				return;
			}

			self.envia();
		} );

		this.modal.addEventListener( 'shown.bs.modal', function () {
			if ( ! self.bloqueado ) {
				self.enfocaPregunta();
			}
		} );

		// Bootstrap sólo devuelve el foco cuando la apertura vino de un
		// `data-bs-toggle`; esta viene de un clic interceptado.
		this.modal.addEventListener( 'hidden.bs.modal', function () {
			if ( self.lanzador && ! self.lanzador.hidden ) {
				self.lanzador.focus();
			}
		} );
	};

	/**
	 * Enseña el botón flotante salvo que el bloqueo lo desaconseje.
	 */
	Encuesta.prototype.revelaLanzador = function () {
		if ( ! this.lanzador ) {
			return;
		}

		if ( this.oculta && this.bloqueoVigente() ) {
			return;
		}

		this.lanzador.hidden = false;
	};

	/**
	 * ¿Queda bloqueo de los que respondió el servidor la última vez?
	 *
	 * @return {boolean}
	 */
	Encuesta.prototype.bloqueoVigente = function () {
		var hasta = parseInt( almacen.lee( STORAGE_BLOCKED ), 10 );

		if ( ! hasta ) {
			return false;
		}

		if ( hasta <= Date.now() ) {
			almacen.borra( STORAGE_BLOCKED );

			return false;
		}

		return true;
	};

	/**
	 * Abre el diálogo y confirma con el servidor que se puede responder.
	 */
	Encuesta.prototype.abre = function () {
		var self = this;

		if ( ! window.bootstrap || ! window.bootstrap.Modal ) {
			return;
		}

		// Abierta una vez —por el botón o por el reloj—, no vuelve a abrirse sola
		// en esta visita: insistir es lo que convierte un aviso en una molestia.
		sesion.escribe( SESION_AUTO, '1' );
		this.detieneReloj();

		window.bootstrap.Modal.getOrCreateInstance( this.modal ).show();

		this.consultaEstado().then( function ( estado ) {
			if ( ! estado ) {
				return;
			}

			if ( ! estado.available ) {
				self.cierraFormulario( self.textos.closed );

				return;
			}

			if ( estado.blocked ) {
				self.marcaBloqueo( estado.blocked_until );
				self.cierraFormulario( self.textos.blocked );

				return;
			}

			// El cuestionario cambió desde que se pintó esta página: lo que hay
			// en pantalla ya no es la versión vigente.
			if ( estado.version_id && estado.version_id !== self.version ) {
				self.cierraFormulario( self.textos.stale );
			}
		} );
	};

	/**
	 * Arranca el reloj de la apertura automática, si está configurada.
	 *
	 * Late cada segundo en vez de programar un único `setTimeout` porque lo que
	 * se mide no es tiempo de reloj: cada latido decide si ese segundo cuenta.
	 */
	Encuesta.prototype.programaApertura = function () {
		var self = this;

		if ( ! this.auto || this.autoDelay < 1 ) {
			return;
		}

		// Ya se abrió en esta visita, o el visitante ya respondió.
		if ( sesion.lee( SESION_AUTO ) || this.bloqueoVigente() ) {
			return;
		}

		var acumulado = parseInt( sesion.lee( SESION_TIEMPO ), 10 ) || 0;
		var anterior  = Date.now();

		this.reloj = window.setInterval( function () {
			var ahora = Date.now();
			var delta = ahora - anterior;

			anterior = ahora;

			/*
			 * Una pestaña en segundo plano no es navegación. Y un salto largo
			 * entre dos latidos —el equipo suspendido, el navegador frenando
			 * los temporizadores de una pestaña oculta— tampoco es tiempo que
			 * nadie pasara leyendo el sitio.
			 */
			if ( 'visible' !== document.visibilityState || delta > 5000 ) {
				return;
			}

			acumulado += delta;
			sesion.escribe( SESION_TIEMPO, String( acumulado ) );

			// Si todavía no toca, o toca pero el momento es malo, se reintenta
			// en el siguiente latido.
			if ( acumulado < self.autoDelay || ! self.puedeAbrirSola() ) {
				return;
			}

			self.abre();
		}, 1000 );
	};

	/**
	 * ¿Es buen momento para abrir el diálogo sin que nadie lo haya pedido?
	 *
	 * @return {boolean}
	 */
	Encuesta.prototype.puedeAbrirSola = function () {
		if ( this.bloqueado || this.bloqueoVigente() ) {
			return false;
		}

		// Dos diálogos superpuestos dejan el telón y el desplazamiento del
		// cuerpo en un estado del que Bootstrap no sale solo.
		if ( document.querySelector( '.modal.show' ) ) {
			return false;
		}

		// Nadie debería perder lo que está escribiendo —un buscador, un
		// formulario— porque encima se abra una encuesta.
		var activo = document.activeElement;

		if ( activo && ( activo.isContentEditable || /^(?:INPUT|TEXTAREA|SELECT)$/.test( activo.tagName ) ) ) {
			return false;
		}

		return true;
	};

	/**
	 * Para el reloj de la apertura automática.
	 */
	Encuesta.prototype.detieneReloj = function () {
		if ( this.reloj ) {
			window.clearInterval( this.reloj );
			this.reloj = 0;
		}
	};

	/**
	 * Pregunta al servidor si la encuesta sigue abierta para este visitante.
	 *
	 * @return {Promise<Object|null>}
	 */
	Encuesta.prototype.consultaEstado = function () {
		if ( ! this.endpoint || ! this.accionEstado ) {
			return Promise.resolve( null );
		}

		var parametros = new URLSearchParams();

		parametros.set( 'action', this.accionEstado );
		parametros.set( 'nonce', this.nonce );
		parametros.set( 'visitor', identificador() );

		return window.fetch( this.endpoint + '?' + parametros.toString(), {
			credentials: 'same-origin'
		} ).then( function ( respuesta ) {
			return respuesta.json();
		} ).then( function ( cuerpo ) {
			return ( cuerpo && cuerpo.success ) ? cuerpo.data : null;
		} ).catch( function () {
			// Sin respuesta no se toca nada: el envío volverá a comprobarlo.
			return null;
		} );
	};

	/**
	 * Deja el diálogo con un único mensaje y sin formulario.
	 *
	 * @param {string} mensaje Texto que explica por qué no se puede responder.
	 */
	Encuesta.prototype.cierraFormulario = function ( mensaje ) {
		this.bloqueado = true;
		this.formulario.hidden = true;

		var pasos = this.modal.querySelector( '[data-mbn-survey-steps]' );

		if ( pasos ) {
			pasos.hidden = true;
		}

		this.avisa( mensaje );
	};

	/**
	 * Muestra un paso y ajusta indicador, botones y anuncio.
	 *
	 * @param {number} numero Paso, empezando en 1.
	 */
	Encuesta.prototype.muestraPaso = function ( numero ) {
		var self = this;

		numero = Math.min( Math.max( numero, 1 ), this.total );
		this.pasoActual = numero;

		this.pasos.forEach( function ( paso ) {
			var propio = parseInt( paso.getAttribute( 'data-mbn-survey-step' ), 10 );

			paso.hidden = propio !== numero;
		} );

		this.puntos.forEach( function ( punto ) {
			var propio = parseInt( punto.getAttribute( 'data-mbn-survey-dot' ), 10 );

			punto.classList.toggle( 'is-current', propio === numero );
			punto.classList.toggle( 'is-done', propio < numero );
		} );

		if ( this.atras ) {
			this.atras.hidden = numero <= 1;
		}

		var ultimo = numero >= this.total;

		this.siguiente.textContent = ultimo ? ( this.textos.submit || '' ) : ( this.textos.next || '' );
		this.actualizaSiguiente();
		this.anuncia( numero );
		this.avisa( '' );

		// El foco viaja al enunciado del paso nuevo: es lo que un lector de
		// pantalla necesita oír antes que nada, y deja el tabulador justo encima
		// de la escala. Con el diálogo aún cerrado —el primer pintado— no se
		// toca el foco.
		if ( this.modal.classList.contains( 'show' ) ) {
			this.enfocaPregunta();
		}

		this.guardaProgreso();
	};

	/**
	 * Lleva el foco al enunciado del paso visible.
	 */
	Encuesta.prototype.enfocaPregunta = function () {
		var activo = this.pasoDe( this.pasoActual );

		if ( ! activo ) {
			return;
		}

		var titulo = activo.querySelector( '.mbn-survey__question' );

		if ( ! titulo ) {
			return;
		}

		titulo.setAttribute( 'tabindex', '-1' );

		window.setTimeout( function () {
			titulo.focus();
		}, 0 );
	};

	/**
	 * El elemento de un paso.
	 *
	 * @param {number} numero Paso.
	 * @return {HTMLElement|null}
	 */
	Encuesta.prototype.pasoDe = function ( numero ) {
		for ( var i = 0; i < this.pasos.length; i++ ) {
			if ( parseInt( this.pasos[ i ].getAttribute( 'data-mbn-survey-step' ), 10 ) === numero ) {
				return this.pasos[ i ];
			}
		}

		return null;
	};

	/**
	 * El valor elegido en un paso.
	 *
	 * @param {HTMLElement} paso El paso.
	 * @return {number} 0 si aún no hay respuesta.
	 */
	Encuesta.prototype.valorDe = function ( paso ) {
		var id = paso.getAttribute( 'data-mbn-survey-question' );

		return this.respuestas[ id ] || 0;
	};

	/**
	 * Registra la valoración de un paso.
	 *
	 * @param {HTMLElement} paso  El paso.
	 * @param {number}      valor Valoración de 1 a 7.
	 */
	Encuesta.prototype.elige = function ( paso, valor ) {
		if ( this.bloqueado || ! valor ) {
			return;
		}

		var id = paso.getAttribute( 'data-mbn-survey-question' );

		this.respuestas[ id ] = valor;

		this.pinta( paso, valor, false );
		this.actualizaSiguiente();
		this.guardaProgreso();
	};

	/**
	 * Pinta la escala de un paso.
	 *
	 * @param {HTMLElement} paso    El paso.
	 * @param {number}      valor   Hasta qué estrella se rellena.
	 * @param {boolean}     anticipo true si es el efecto del ratón.
	 */
	Encuesta.prototype.pinta = function ( paso, valor, anticipo ) {
		var elegido = this.valorDe( paso );
		var estrellas = paso.querySelectorAll( '[data-mbn-survey-value]' );

		Array.prototype.forEach.call( estrellas, function ( estrella ) {
			var propio = parseInt( estrella.getAttribute( 'data-mbn-survey-value' ), 10 );
			var lleno  = propio <= valor;

			estrella.classList.toggle( 'is-filled', lleno && ! anticipo );
			estrella.classList.toggle( 'is-preview', lleno && anticipo );

			// `aria-checked` y el tabindex describen la elección real, no el
			// anticipo del ratón.
			estrella.setAttribute( 'aria-checked', propio === elegido ? 'true' : 'false' );
			estrella.setAttribute( 'tabindex', tabindexDe( propio, elegido ) );
		} );
	};

	/**
	 * Teclado dentro de la escala.
	 *
	 * @param {HTMLElement} paso    El paso.
	 * @param {KeyboardEvent} evento El evento.
	 */
	Encuesta.prototype.teclado = function ( paso, evento ) {
		var total = paso.querySelectorAll( '[data-mbn-survey-value]' ).length;
		var actual = this.valorDe( paso );
		var destino = 0;

		switch ( evento.key ) {
			case 'ArrowRight':
			case 'ArrowDown':
				destino = actual ? Math.min( actual + 1, total ) : 1;
				break;
			case 'ArrowLeft':
			case 'ArrowUp':
				destino = actual ? Math.max( actual - 1, 1 ) : 1;
				break;
			case 'Home':
				destino = 1;
				break;
			case 'End':
				destino = total;
				break;
			default:
				return;
		}

		evento.preventDefault();
		this.elige( paso, destino );

		var estrella = paso.querySelector( '[data-mbn-survey-value="' + destino + '"]' );

		if ( estrella ) {
			estrella.focus();
		}
	};

	/**
	 * Habilita o deshabilita el botón principal según haya respuesta.
	 */
	Encuesta.prototype.actualizaSiguiente = function () {
		var paso = this.pasoDe( this.pasoActual );

		this.siguiente.disabled = this.enviando || ! paso || ! this.valorDe( paso );
	};

	/**
	 * Anuncia el paso a quien no ve el indicador.
	 *
	 * @param {number} numero Paso actual.
	 */
	Encuesta.prototype.anuncia = function ( numero ) {
		if ( ! this.progreso || ! this.textos.step ) {
			return;
		}

		this.progreso.textContent = this.textos.step
			.replace( '%1$s', String( numero ) )
			.replace( '%2$s', String( this.total ) );
	};

	/**
	 * Enseña u oculta el aviso de error.
	 *
	 * @param {string} mensaje Texto; vacío para ocultarlo.
	 */
	Encuesta.prototype.avisa = function ( mensaje ) {
		if ( ! this.aviso ) {
			return;
		}

		this.aviso.textContent = mensaje || '';
		this.aviso.hidden = ! mensaje;
	};

	/**
	 * Guarda el progreso a medias.
	 *
	 * Sólo versión, paso, valoraciones y marca de tiempo: nada que identifique a
	 * nadie.
	 */
	Encuesta.prototype.guardaProgreso = function () {
		// Sin valoraciones no hay progreso: abrir y cerrar el diálogo no deja
		// rastro en el navegador.
		if ( ! this.ttl || ! Object.keys( this.respuestas ).length ) {
			return;
		}

		almacen.escribe( STORAGE_PROGRESS, JSON.stringify( {
			v: this.version,
			s: this.pasoActual,
			a: this.respuestas,
			t: Date.now()
		} ) );
	};

	/**
	 * Recupera el progreso si sigue siendo válido.
	 *
	 * Se descarta cuando está corrupto, cuando pertenece a otra versión del
	 * cuestionario o cuando pasó el plazo.
	 */
	Encuesta.prototype.restauraProgreso = function () {
		var crudo = almacen.lee( STORAGE_PROGRESS );

		if ( ! crudo ) {
			return;
		}

		var datos;

		try {
			datos = JSON.parse( crudo );
		} catch ( e ) {
			almacen.borra( STORAGE_PROGRESS );

			return;
		}

		if ( ! datos || typeof datos !== 'object' || datos.v !== this.version ) {
			almacen.borra( STORAGE_PROGRESS );

			return;
		}

		if ( ! datos.t || ( Date.now() - datos.t ) > this.ttl ) {
			almacen.borra( STORAGE_PROGRESS );

			return;
		}

		var valido = {};
		var self   = this;

		this.pasos.forEach( function ( paso ) {
			var id = paso.getAttribute( 'data-mbn-survey-question' );
			var valor = ( datos.a && datos.a[ id ] ) ? parseInt( datos.a[ id ], 10 ) : 0;

			// Una valoración fuera de la escala, o de una pregunta que ya no
			// existe, se ignora: el resto del progreso sigue sirviendo.
			if ( valor >= 1 && valor <= 7 ) {
				valido[ id ] = valor;
			}
		} );

		// Primero el estado y después el pintado: `pinta()` lee las respuestas
		// para decidir el `aria-checked`.
		this.respuestas = valido;
		this.pasoActual = Math.min( Math.max( parseInt( datos.s, 10 ) || 1, 1 ), this.total );

		this.pasos.forEach( function ( paso ) {
			self.pinta( paso, self.valorDe( paso ), false );
		} );
	};

	/**
	 * Recuerda hasta cuándo dijo el servidor que no se puede volver a responder.
	 *
	 * @param {string} hasta Fecha MySQL en UTC.
	 */
	Encuesta.prototype.marcaBloqueo = function ( hasta ) {
		if ( ! hasta ) {
			return;
		}

		var fecha = Date.parse( String( hasta ).replace( ' ', 'T' ) + 'Z' );

		if ( ! isNaN( fecha ) ) {
			almacen.escribe( STORAGE_BLOCKED, String( fecha ) );
		}

		if ( this.oculta && this.lanzador ) {
			this.lanzador.hidden = true;
		}
	};

	/**
	 * Envía las respuestas.
	 *
	 * Un segundo clic mientras hay una petición en vuelo no hace nada: es lo que
	 * evita el envío duplicado del doble clic.
	 */
	Encuesta.prototype.envia = function () {
		var self = this;

		if ( this.enviando || this.bloqueado ) {
			return;
		}

		if ( Object.keys( this.respuestas ).length !== this.total ) {
			return;
		}

		this.enviando = true;
		this.siguiente.disabled = true;
		this.siguiente.textContent = this.textos.sending || this.textos.submit || '';
		this.avisa( '' );

		var cuerpo = new URLSearchParams();

		cuerpo.set( 'action', this.accionEnvio );
		cuerpo.set( 'nonce', this.nonce );
		cuerpo.set( 'visitor', identificador() );
		cuerpo.set( 'version_id', String( this.version ) );

		Object.keys( this.respuestas ).forEach( function ( id ) {
			cuerpo.set( 'answers[' + id + ']', String( self.respuestas[ id ] ) );
		} );

		window.fetch( this.endpoint, {
			method: 'POST',
			credentials: 'same-origin',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
			body: cuerpo.toString()
		} ).then( function ( respuesta ) {
			return respuesta.json().catch( function () {
				return null;
			} );
		} ).then( function ( datos ) {
			self.enviando = false;

			if ( datos && datos.success ) {
				self.termina( datos.data );

				return;
			}

			self.falla( datos && datos.data ? datos.data : null );
		} ).catch( function () {
			// Error de red: las respuestas siguen en pantalla y el botón vuelve
			// a estar disponible para reintentar.
			self.enviando = false;
			self.restauraBoton();
			self.avisa( self.textos.network || '' );
		} );
	};

	/**
	 * Deja el botón principal como estaba antes de enviar.
	 */
	Encuesta.prototype.restauraBoton = function () {
		this.siguiente.textContent = ( this.pasoActual >= this.total )
			? ( this.textos.submit || '' )
			: ( this.textos.next || '' );

		this.actualizaSiguiente();
	};

	/**
	 * Enseña la pantalla de agradecimiento. Sólo se llega aquí con la
	 * confirmación del servidor en la mano.
	 *
	 * @param {Object} datos Respuesta del endpoint.
	 */
	Encuesta.prototype.termina = function ( datos ) {
		almacen.borra( STORAGE_PROGRESS );

		if ( datos && datos.blocked_until ) {
			this.marcaBloqueo( datos.blocked_until );
		}

		this.formulario.hidden = true;

		var pasos = this.modal.querySelector( '[data-mbn-survey-steps]' );

		if ( pasos ) {
			pasos.hidden = true;
		}

		if ( this.privacidad ) {
			this.privacidad.hidden = true;
		}

		// El Figma no dibuja cabecera en la pantalla final, así que el rótulo y el
		// aspa se retiran y el nombre del diálogo pasa al título de gracias.
		if ( this.cabecera ) {
			this.cabecera.hidden = true;
		}

		if ( this.gracias ) {
			this.gracias.hidden = false;

			var titulo = this.gracias.querySelector( '.mbn-survey__done-title' );

			if ( titulo && titulo.id ) {
				this.modal.setAttribute( 'aria-labelledby', titulo.id );
			}

			var cerrar = this.gracias.querySelector( 'button' );

			if ( cerrar ) {
				cerrar.focus();
			}
		}
	};

	/**
	 * Traduce el error del servidor a un mensaje, sin perder lo respondido.
	 *
	 * @param {Object|null} datos Cuerpo del error.
	 */
	Encuesta.prototype.falla = function ( datos ) {
		var codigo = ( datos && datos.code ) ? datos.code : '';

		if ( 'blocked' === codigo ) {
			this.marcaBloqueo( datos.blocked_until );
			this.cierraFormulario( this.textos.blocked );

			return;
		}

		if ( 'stale' === codigo ) {
			this.cierraFormulario( this.textos.stale );

			return;
		}

		if ( 'closed' === codigo ) {
			this.cierraFormulario( this.textos.closed );

			return;
		}

		this.restauraBoton();
		this.avisa( this.textos.server || '' );
	};

	/**
	 * Arranque.
	 */
	function arranca() {
		var modal = document.querySelector( '[data-mbn-survey]' );

		if ( ! modal ) {
			return;
		}

		new Encuesta( modal, document.querySelector( '[data-mbn-survey-launcher]' ) );
	}

	if ( 'loading' === document.readyState ) {
		document.addEventListener( 'DOMContentLoaded', arranca );
	} else {
		arranca();
	}
}() );
