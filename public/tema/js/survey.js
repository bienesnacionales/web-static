/* gestiona las interacciones de encuesta de satisfacción */
// inicializa el diálogo de la encuesta de satisfacción

( function () {
	'use strict';

	if ( typeof window === 'undefined' || ! window.document ) {
		return;
	}

	var STORAGE_PROGRESS = 'mbn-survey-progress';
	var STORAGE_VISITOR  = 'mbn-survey-visitor';
	var STORAGE_BLOCKED  = 'mbn-survey-blocked';


	var SESION_TIEMPO = 'mbn-survey-browsing';
	var SESION_AUTO   = 'mbn-survey-auto';
	var SESION_CIERRE = 'mbn-survey-close-notice';

	// gestiona el acceso al almacenamiento del navegador y sus restricciones
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

	// el identificador anónimo del visitante
	function identificador() {
		var guardado = almacen.lee( STORAGE_VISITOR );

		if ( guardado && /^[a-f0-9]{32}$/.test( guardado ) ) {
			return guardado;
		}

		var bytes = new Uint8Array( 16 );

		if ( window.crypto && window.crypto.getRandomValues ) {
			window.crypto.getRandomValues( bytes );
		} else {
			// genera el identificador local de visita y conserva la validación de frecuencia del servidor
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

	// el tabindex que corresponde a una estrella
	function tabindexDe( propio, elegido ) {
		if ( ! elegido ) {
			return 1 === propio ? '0' : '-1';
		}

		return propio === elegido ? '0' : '-1';
	}

	// inicializa la encuesta del documento
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
		this.openClose  = '1' === modal.getAttribute( 'data-mbn-survey-open-close' );
		this.openTop    = '1' === modal.getAttribute( 'data-mbn-survey-open-top' );
		this.openExternal = '1' === modal.getAttribute( 'data-mbn-survey-open-external' );
		this.abriendo   = false;
		this.externoPendiente = false;
		this.omiteCierreHasta = 0;
		this.salida     = modal.querySelector( '[data-mbn-survey-external]' );
		this.continuar  = modal.querySelector( '[data-mbn-survey-external-continue]' );
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
		this.programaActivadores();
	}

	// obtiene los mensajes configurados por el servidor
	Encuesta.prototype.leeTextos = function () {
		try {
			var crudo = JSON.parse( this.modal.getAttribute( 'data-mbn-survey-messages' ) || '{}' );

			return ( crudo && typeof crudo === 'object' ) ? crudo : {};
		} catch ( e ) {
			return {};
		}
	};

	// registra los controladores de eventos de la encuesta
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

			// presenta una vista previa de la valoración sin modificar la respuesta guardada
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

		// restaura el foco cuando el diálogo se abre mediante un evento personalizado
		this.modal.addEventListener( 'hidden.bs.modal', function () {
			self.abriendo = false;
			if ( self.salida ) self.salida.hidden = true;
			if ( self.continuar ) self.continuar.removeAttribute( 'href' );
			if ( self.lanzador && ! self.lanzador.hidden ) {
				self.lanzador.focus();
			}
		} );
	};

	// presenta el botón flotante según el estado de participación
	Encuesta.prototype.revelaLanzador = function () {
		if ( ! this.lanzador ) {
			return;
		}

		if ( this.oculta && this.bloqueoVigente() ) {
			return;
		}

		this.lanzador.hidden = false;
	};

	// comprueba el bloqueo de participación indicado por el servidor
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

	// abre el diálogo y confirma con el servidor que se puede responder
	Encuesta.prototype.abre = function () {
		var self = this;

		if ( ! window.bootstrap || ! window.bootstrap.Modal || this.abriendo ) {
			return false;
		}
		this.abriendo = true;

		// limita la apertura automática a una vez por visita
		sesion.escribe( SESION_AUTO, '1' );
		this.detieneReloj();
		if ( this.onBeforeUnload ) window.removeEventListener( 'beforeunload', this.onBeforeUnload );

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

			// comprueba si la versión del cuestionario visible continúa vigente
			if ( estado.version_id && estado.version_id !== self.version ) {
				self.cierraFormulario( self.textos.stale );
			}
		} );
		return true;
	};

	// inicia el temporizador de apertura automática configurado
	Encuesta.prototype.programaApertura = function () {
		var self = this;

		if ( ! this.auto || this.autoDelay < 1 ) {
			return;
		}

		// comprueba la apertura previa y el estado de participación de la visita
		if ( sesion.lee( SESION_AUTO ) || this.bloqueoVigente() ) {
			return;
		}

		var acumulado = parseInt( sesion.lee( SESION_TIEMPO ), 10 ) || 0;
		var anterior  = Date.now();

		this.reloj = window.setInterval( function () {
			var ahora = Date.now();
			var delta = ahora - anterior;

			anterior = ahora;

			// excluye el tiempo de permanencia en pestañas inactivas
			if ( 'visible' !== document.visibilityState || delta > 5000 ) {
				return;
			}

			acumulado += delta;
			sesion.escribe( SESION_TIEMPO, String( acumulado ) );

			// reprograma la apertura hasta que se cumplan las condiciones configuradas
			if ( acumulado < self.autoDelay || ! self.puedeAbrirSola() ) {
				return;
			}

			self.abre();
		}, 1000 );
	};

	// comprueba las condiciones de apertura automática del diálogo
	Encuesta.prototype.puedeAbrirSola = function ( cierre ) {
		if ( ! window.bootstrap || ! window.bootstrap.Modal || this.abriendo || sesion.lee( SESION_AUTO ) || this.bloqueado || this.bloqueoVigente() || document.visibilityState !== 'visible' ) {
			return false;
		}

		// evita la apertura automática mientras existe otro diálogo activo
		if ( document.querySelector( '.modal.show, .modal.showing, .offcanvas.show, .offcanvas.showing, [aria-modal="true"], .pum-active' ) ) {
			return false;
		}

		// pospone la apertura automática durante la edición de campos del formulario
		var activo = document.activeElement;

		if ( ! cierre && activo && ( activo.isContentEditable || /^(?:INPUT|TEXTAREA|SELECT)$/.test( activo.tagName ) ) ) {
			return false;
		}

		return true;
	};

	// detiene el temporizador de apertura automática
	Encuesta.prototype.detieneReloj = function () {
		if ( this.reloj ) {
			window.clearInterval( this.reloj );
			this.reloj = 0;
		}
	};

	// activadores compatibles: todos comparten la apertura única de esta visita
	Encuesta.prototype.programaActivadores = function () {
		var self = this;
		var armado = false;
		var ultimoY = null;

		if ( this.openTop ) {
			document.addEventListener( 'mousemove', function ( evento ) {
				if ( ! window.matchMedia( '(any-hover: hover) and (any-pointer: fine)' ).matches ) return;
				if ( evento.clientY > 80 ) armado = true;
				if ( armado && null !== ultimoY && evento.clientY < ultimoY && evento.clientY <= 24 ) self.abreAutomaticamente();
				ultimoY = evento.clientY;
			}, { passive: true } );
			document.addEventListener( 'mouseout', function ( evento ) {
				if ( armado && ! evento.relatedTarget && evento.clientY <= 0 ) self.abreAutomaticamente();
			} );
		}

		if ( this.openClose ) {
			// navegar mediante un enlace o formulario no equivale a cerrar la pestaña
			document.addEventListener( 'click', function ( evento ) {
				var enlace = evento.target && evento.target.closest ? evento.target.closest( 'a[href]' ) : null;
				if ( enlace && ! evento.ctrlKey && ! evento.metaKey && ! evento.shiftKey && ! evento.altKey && 0 === evento.button && '_blank' !== enlace.target.toLowerCase() ) {
					self.omiteCierreHasta = Date.now() + 2000;
				}
			}, true );
			document.addEventListener( 'submit', function () { self.omiteCierreHasta = Date.now() + 2000; }, true );
			this.onBeforeUnload = function ( evento ) {
				if ( sesion.lee( SESION_CIERRE ) || Date.now() < self.omiteCierreHasta || ! self.puedeAbrirSola( true ) ) return;
				if ( navigator.userActivation && ! navigator.userActivation.hasBeenActive ) return;
				evento.preventDefault();
				evento.returnValue = true;
				sesion.escribe( SESION_CIERRE, '1' );
				// continúa la comprobación cuando el navegador permite reanudar el controlador
				window.setTimeout( function () { self.abreAutomaticamente( true ); }, 0 );
			};
			if ( ! sesion.lee( SESION_AUTO ) && ! sesion.lee( SESION_CIERRE ) && ! this.bloqueoVigente() ) {
				window.addEventListener( 'beforeunload', this.onBeforeUnload );
			}
		}

		if ( this.openExternal ) {
			document.addEventListener( 'click', function ( evento ) {
				if ( evento.defaultPrevented || evento.button !== 0 || evento.ctrlKey || evento.metaKey || evento.shiftKey || evento.altKey ) return;
				var enlace = evento.target && evento.target.closest ? evento.target.closest( 'a[href]' ) : null;
				if ( ! self.esEnlaceExterno( enlace ) || sesion.lee( SESION_AUTO ) || self.bloqueoVigente() ) return;
				var target = ( enlace.target || '_self' ).toLowerCase();
				if ( '_self' === target || '_top' === target || '_parent' === target ) {
					if ( ! self.puedeAbrirSola() ) return;
					if ( self.salida && self.continuar ) {
						self.continuar.href = enlace.href;
						self.continuar.target = '_self';
						self.salida.hidden = false;
						if ( self.abreAutomaticamente() ) evento.preventDefault();
					}
				} else {
					// la navegación normal ocurre primero; la encuesta queda en la pestaña de origen
					window.setTimeout( function () { self.encolaExterno(); }, 0 );
				}
			} );
			// este evento se emite solo después de confirmar el aviso de salida existente
			document.addEventListener( 'mbn:external-opened', function () { self.encolaExterno(); } );
			document.addEventListener( 'hidden.bs.modal', function () { self.reintentaExterno(); } );
			document.addEventListener( 'hidden.bs.offcanvas', function () { self.reintentaExterno(); } );
			document.addEventListener( 'visibilitychange', function () { self.reintentaExterno(); } );
			window.addEventListener( 'focus', function () { window.setTimeout( function () { self.reintentaExterno(); }, 0 ); } );
		}
	};

	Encuesta.prototype.abreAutomaticamente = function ( cierre ) {
		if ( ! this.puedeAbrirSola( cierre ) ) return false;
		return this.abre();
	};

	Encuesta.prototype.esEnlaceExterno = function ( enlace ) {
		if ( ! enlace || enlace.hasAttribute( 'download' ) || enlace.closest( '[data-mbn-survey], [data-mbn-external-modal], [data-mbn-survey-skip]' ) ) return false;
		if ( enlace.protocol !== 'https:' && enlace.protocol !== 'http:' ) return false;
		function host( value ) { return String( value || '' ).toLowerCase().replace( /^www\./, '' ); }
		var propios = [ host( window.location.hostname ) ];
		var aviso = document.querySelector( '[data-mbn-external-modal]' );
		try {
			var otros = aviso ? JSON.parse( aviso.getAttribute( 'data-mbn-external-hosts' ) || '[]' ) : [];
			if ( Array.isArray( otros ) ) propios = propios.concat( otros.map( host ) );
		} catch ( e ) {}
		return propios.indexOf( host( enlace.hostname ) ) === -1;
	};

	Encuesta.prototype.encolaExterno = function () {
		if ( sesion.lee( SESION_AUTO ) || this.bloqueado || this.bloqueoVigente() ) return;
		this.externoPendiente = true;
		this.reintentaExterno();
	};

	Encuesta.prototype.reintentaExterno = function () {
		if ( sesion.lee( SESION_AUTO ) ) { this.externoPendiente = false; return; }
		if ( this.externoPendiente && this.abreAutomaticamente() ) this.externoPendiente = false;
	};


	// consulta la disponibilidad de participación en el servidor
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
			// conserva el estado local cuando no se recibe respuesta del servidor
			return null;
		} );
	};

	// presenta el mensaje de estado sin el formulario de respuestas
	Encuesta.prototype.cierraFormulario = function ( mensaje ) {
		this.bloqueado = true;
		this.formulario.hidden = true;

		var pasos = this.modal.querySelector( '[data-mbn-survey-steps]' );

		if ( pasos ) {
			pasos.hidden = true;
		}

		this.avisa( mensaje );
	};

	// muestra un paso y ajusta indicador, botones y anuncio
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

		// establece el foco en el enunciado al cambiar de paso
		if ( this.modal.classList.contains( 'show' ) ) {
			this.enfocaPregunta();
		}

		this.guardaProgreso();
	};

	// lleva el foco al enunciado del paso visible
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

	// el elemento de un paso
	Encuesta.prototype.pasoDe = function ( numero ) {
		for ( var i = 0; i < this.pasos.length; i++ ) {
			if ( parseInt( this.pasos[ i ].getAttribute( 'data-mbn-survey-step' ), 10 ) === numero ) {
				return this.pasos[ i ];
			}
		}

		return null;
	};

	// el valor elegido en un paso
	Encuesta.prototype.valorDe = function ( paso ) {
		var id = paso.getAttribute( 'data-mbn-survey-question' );

		return this.respuestas[ id ] || 0;
	};

	// registra la valoración de un paso
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

	// presenta la escala de un paso
	Encuesta.prototype.pinta = function ( paso, valor, anticipo ) {
		var elegido = this.valorDe( paso );
		var estrellas = paso.querySelectorAll( '[data-mbn-survey-value]' );

		Array.prototype.forEach.call( estrellas, function ( estrella ) {
			var propio = parseInt( estrella.getAttribute( 'data-mbn-survey-value' ), 10 );
			var lleno  = propio <= valor;

			estrella.classList.toggle( 'is-filled', lleno && ! anticipo );
			estrella.classList.toggle( 'is-preview', lleno && anticipo );

			// sincroniza los atributos accesibles con la respuesta guardada
			estrella.setAttribute( 'aria-checked', propio === elegido ? 'true' : 'false' );
			estrella.setAttribute( 'tabindex', tabindexDe( propio, elegido ) );
		} );
	};

	// teclado dentro de la escala
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

	// habilita o deshabilita el botón principal según haya respuesta
	Encuesta.prototype.actualizaSiguiente = function () {
		var paso = this.pasoDe( this.pasoActual );

		this.siguiente.disabled = this.enviando || ! paso || ! this.valorDe( paso );
	};

	// anuncia el paso actual mediante la región de estado accesible
	Encuesta.prototype.anuncia = function ( numero ) {
		if ( ! this.progreso || ! this.textos.step ) {
			return;
		}

		this.progreso.textContent = this.textos.step
			.replace( '%1$s', String( numero ) )
			.replace( '%2$s', String( this.total ) );
	};

	// actualiza la visibilidad del mensaje de error
	Encuesta.prototype.avisa = function ( mensaje ) {
		if ( ! this.aviso ) {
			return;
		}

		this.aviso.textContent = mensaje || '';
		this.aviso.hidden = ! mensaje;
	};

	// guarda las respuestas parciales de la encuesta
	Encuesta.prototype.guardaProgreso = function () {
		// almacena el progreso únicamente cuando existen valoraciones
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

	// recupera el progreso si sigue siendo válido
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

			// descarta las respuestas incompatibles y conserva el progreso válido
			if ( valor >= 1 && valor <= 7 ) {
				valido[ id ] = valor;
			}
		} );

		// actualiza las respuestas antes de sincronizar la presentación de la escala
		this.respuestas = valido;
		this.pasoActual = Math.min( Math.max( parseInt( datos.s, 10 ) || 1, 1 ), this.total );

		this.pasos.forEach( function ( paso ) {
			self.pinta( paso, self.valorDe( paso ), false );
		} );
	};

	// guarda la fecha de finalización del bloqueo indicado por el servidor
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

	// envía las respuestas
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
			// error de red: las respuestas siguen en pantalla y el botón vuelve a estar disponible para reintentar
			self.enviando = false;
			self.restauraBoton();
			self.avisa( self.textos.network || '' );
		} );
	};

	// restablece el estado del botón después del envío
	Encuesta.prototype.restauraBoton = function () {
		this.siguiente.textContent = ( this.pasoActual >= this.total )
			? ( this.textos.submit || '' )
			: ( this.textos.next || '' );

		this.actualizaSiguiente();
	};

	// presenta la confirmación de recepción de respuestas
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

	// presenta el error del servidor y conserva las respuestas introducidas
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
