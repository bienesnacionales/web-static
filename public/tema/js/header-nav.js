/* Header nav interactions — dropdowns Desktop + offcanvas focus return + topbar ecosistema.
 *
 * Dropdowns Desktop:
 *   - open-on-click (no hover) [OPEN-Q-HF-004 resuelta por Leonardo 2026-08-25T05:01]
 *   - open también por focus / Enter / Space (visible focus)
 *   - close por Escape / click-fuera / Tab-out
 *
 * Offcanvas (mobile/tablet):
 *   - Bootstrap 5.3.3 Offcanvas provee backdrop, scrollLock, focusTrap, closeOnEsc
 *   - este script añade focusReturn al disparador (decisión humana).
 *
 * TopBar ecosistema button:
 *   - toggle del panel informativo.
 *
 * Botonera de accesibilidad (header desktop + offcanvas):
 *   - alto contraste y escala de texto de ±2 niveles, guardados en localStorage
 *     y restituidos por el arranque en línea de inc/a11y.php (§6).
 *
 * Sin dependencias externas (vanilla JS). Sin jQuery. Compatible con WP sin AMD.
 *
 * @package mbn
 */

( function () {
	'use strict';

	if ( typeof window === 'undefined' || ! window.document ) {
		return;
	}

	/**
	 * Helpers
	 */

	const $$ = ( selector, root ) => Array.prototype.slice.call( ( root || document ).querySelectorAll( selector ) );

	function closeAllDropdowns( exceptId ) {
		$$( '[data-mbn-dropdown-trigger]' ).forEach( ( trigger ) => {
			const targetId = trigger.getAttribute( 'data-mbn-dropdown-target' );
			if ( exceptId && targetId === exceptId ) {
				return;
			}
			const panel = targetId ? document.getElementById( targetId ) : null;
			if ( panel && ! panel.hasAttribute( 'hidden' ) ) {
				panel.setAttribute( 'hidden', '' );
			}
			trigger.setAttribute( 'aria-expanded', 'false' );
		} );
	}

	/**
	 * Dropdowns Desktop
	 */

	/*
	 * Ancho del panel: parte del de la plantilla (256px, dropdown.css) y una
	 * opción puede ocupar dos líneas, nunca tres. Si alguna llega a tres, se
	 * busca por bisección el ancho mínimo en que todas caben en dos, con la
	 * versión de una sola línea (max-content) como techo.
	 *
	 * Se mide al abrir y no al cargar: el [hidden] del panel no lo saca del
	 * layout —solo lo vuelve invisible—, y la escala de texto de la botonera de
	 * accesibilidad puede haber cambiado los renglones desde la última vez.
	 */
	const MAX_OPTION_LINES = 2;

	function screenScale() {
		return parseFloat( window.getComputedStyle( document.body ).zoom ) || 1;
	}

	function optionLines( option ) {
		const lineHeight = parseFloat( window.getComputedStyle( option ).lineHeight );
		if ( ! lineHeight ) {
			return 1;
		}
		const range = document.createRange();
		range.selectNodeContents( option );
		return Math.round( range.getBoundingClientRect().height / screenScale() / lineHeight );
	}

	function fitsInLines( options ) {
		return options.every( ( option ) => optionLines( option ) <= MAX_OPTION_LINES );
	}

	function sizeDropdown( panel ) {
		panel.style.width = '';
		const options = $$( '.mbn-dropdown__option', panel );
		if ( ! options.length || fitsInLines( options ) ) {
			return;
		}

		let low = panel.getBoundingClientRect().width / screenScale();
		panel.style.width = 'max-content';
		let high = Math.ceil( panel.getBoundingClientRect().width / screenScale() );

		while ( high - low > 1 ) {
			const mid = Math.floor( ( low + high ) / 2 );
			panel.style.width = mid + 'px';
			if ( fitsInLines( options ) ) {
				high = mid;
			} else {
				low = mid;
			}
		}
		panel.style.width = high + 'px';
	}

	/*
	 * Ensanchado, el panel del último ítem del menú puede salirse de la
	 * ventana: si desborda, se ancla por la derecha del botón.
	 */
	function alignDropdown( panel ) {
		sizeDropdown( panel );
		panel.classList.remove( 'mbn-dropdown--end' );
		const rect = panel.getBoundingClientRect();
		const limit = document.documentElement.clientWidth - 16 * screenScale();
		if ( rect.right > limit ) {
			panel.classList.add( 'mbn-dropdown--end' );
		}
	}

	function initDropdowns() {
		const triggers = $$( '[data-mbn-dropdown-trigger]' );
		if ( ! triggers.length ) {
			return;
		}

		triggers.forEach( ( trigger ) => {
			const targetId = trigger.getAttribute( 'data-mbn-dropdown-target' );
			const panel = targetId ? document.getElementById( targetId ) : null;
			if ( ! panel ) {
				return;
			}

			function openDropdown() {
				closeAllDropdowns( targetId );
				panel.removeAttribute( 'hidden' );
				alignDropdown( panel );
				trigger.setAttribute( 'aria-expanded', 'true' );
				const firstOption = panel.querySelector( '.mbn-dropdown__option' );
				if ( firstOption ) {
					firstOption.setAttribute( 'tabindex', '0' );
				}
			}

			function closeDropdown( returnFocus ) {
				if ( panel.hasAttribute( 'hidden' ) ) {
					return;
				}
				panel.setAttribute( 'hidden', '' );
				trigger.setAttribute( 'aria-expanded', 'false' );
				$$( '.mbn-dropdown__option', panel ).forEach( ( opt ) => {
					opt.setAttribute( 'tabindex', '-1' );
				} );
				if ( returnFocus && typeof trigger.focus === 'function' ) {
					trigger.focus();
				}
			}

			trigger.addEventListener( 'click', ( event ) => {
				event.preventDefault();
				if ( trigger.getAttribute( 'aria-expanded' ) === 'true' ) {
					closeDropdown( true );
				} else {
					openDropdown();
				}
			} );

			trigger.addEventListener( 'keydown', ( event ) => {
				const key = event.key;
				if ( key === 'Enter' || key === ' ' || key === 'Spacebar' ) {
					event.preventDefault();
					if ( trigger.getAttribute( 'aria-expanded' ) === 'true' ) {
						closeDropdown( true );
					} else {
						openDropdown();
						const firstOption = panel.querySelector( '.mbn-dropdown__option' );
						if ( firstOption ) {
							firstOption.focus();
						}
					}
				} else if ( key === 'Escape' ) {
					if ( trigger.getAttribute( 'aria-expanded' ) === 'true' ) {
						event.preventDefault();
						closeDropdown( true );
					}
				} else if ( key === 'ArrowDown' ) {
					event.preventDefault();
					openDropdown();
					const firstOpt = panel.querySelector( '.mbn-dropdown__option' );
					if ( firstOpt ) {
						firstOpt.focus();
					}
				}
			} );

			// Click en option: cerrar dropdown tras click (UX típica de menú).
			$$( '.mbn-dropdown__option', panel ).forEach( ( option ) => {
				option.addEventListener( 'click', () => {
					closeDropdown( true );
				} );
				option.addEventListener( 'keydown', ( event ) => {
					const key = event.key;
					const options = $$( '.mbn-dropdown__option', panel );
					const index = options.indexOf( option );
					if ( key === 'ArrowDown' ) {
						event.preventDefault();
						const next = options[ index + 1 ] || options[ 0 ];
						if ( next ) {
							next.focus();
						}
					} else if ( key === 'ArrowUp' ) {
						event.preventDefault();
						const prev = options[ index - 1 ] || options[ options.length - 1 ];
						if ( prev ) {
							prev.focus();
						}
					} else if ( key === 'Escape' ) {
						event.preventDefault();
						closeDropdown( true );
					} else if ( key === 'Tab' ) {
						closeDropdown( false );
					}
				} );
			} );
		} );

		// click-fuera y Escape global.
		document.addEventListener( 'click', ( event ) => {
			const target = event.target;
			if (
				target.closest( '[data-mbn-dropdown-trigger]' ) ||
				target.closest( '.mbn-dropdown' )
			) {
				return;
			}
			closeAllDropdowns();
		} );

		document.addEventListener( 'keydown', ( event ) => {
			if ( event.key === 'Escape' ) {
				closeAllDropdowns();
			}
		} );
	}

	/**
	 * Offcanvas (mobile/tablet) — focusReturn al disparador.
	 *
	 * Bootstrap 5.3.3 ya provee:
	 *   - backdrop, scrollLock, focusTrap, closeOnEsc
	 *   - aria-modal automático
	 * Este handler solo implementa la decisión humana de devolver foco al
	 * elemento que disparó la apertura.
	 */

	function initOffcanvasFocusReturn() {
		$$( '.offcanvas.mbn-offcanvas' ).forEach( ( offcanvas ) => {
			const id = offcanvas.id;
			if ( ! id ) {
				return;
			}

			offcanvas.addEventListener( 'show.bs.offcanvas', () => {
				document.body.classList.add( 'mbn-offcanvas-open' );
			} );

			offcanvas.addEventListener( 'hidden.bs.offcanvas', () => {
				document.body.classList.remove( 'mbn-offcanvas-open' );
				const triggers = $$( '[data-mbn-offcanvas-toggle="' + id + '"]' );
				triggers.forEach( ( t ) => {
					t.setAttribute( 'aria-expanded', 'false' );
				} );
				// Devolver foco al último disparador activo si lo hay.
				const lastTrigger = triggers[ triggers.length - 1 ];
				if ( lastTrigger && typeof lastTrigger.focus === 'function' ) {
					lastTrigger.focus();
				}
			} );

			offcanvas.addEventListener( 'shown.bs.offcanvas', () => {
				const triggers = $$( '[data-mbn-offcanvas-toggle="' + id + '"]' );
				triggers.forEach( ( t ) => {
					t.setAttribute( 'aria-expanded', 'true' );
				} );
				// Auto-focus al título para que screen reader anuncie el menú.
				const title = offcanvas.querySelector( '.mbn-offcanvas__title' );
				if ( title && typeof title.focus === 'function' ) {
					title.setAttribute( 'tabindex', '-1' );
					title.focus();
				}
			} );
		} );
	}

	/**
	 * TopBar ecosistema button (toggle panel).
	 */

	function initTopbarEcosistema() {
		$$( '[data-mbn-ecosistema-toggle]' ).forEach( ( toggle ) => {
			const panelId = toggle.getAttribute( 'aria-controls' );
			const panel = panelId ? document.getElementById( panelId ) : null;
			if ( ! panel ) {
				return;
			}

			toggle.addEventListener( 'click', ( event ) => {
				event.preventDefault();
				const expanded = toggle.getAttribute( 'aria-expanded' ) === 'true';
				if ( expanded ) {
					panel.setAttribute( 'hidden', '' );
					toggle.setAttribute( 'aria-expanded', 'false' );
				} else {
					panel.removeAttribute( 'hidden' );
					toggle.setAttribute( 'aria-expanded', 'true' );
				}
			} );

			toggle.addEventListener( 'keydown', ( event ) => {
				if ( event.key === 'Escape' && toggle.getAttribute( 'aria-expanded' ) === 'true' ) {
					panel.setAttribute( 'hidden', '' );
					toggle.setAttribute( 'aria-expanded', 'false' );
					if ( typeof toggle.focus === 'function' ) {
						toggle.focus();
					}
				}
			} );
		} );

		// click-fuera para el panel ecosistema.
		document.addEventListener( 'click', ( event ) => {
			const target = event.target;
			if (
				target.closest( '[data-mbn-ecosistema-toggle]' ) ||
				target.closest( '.mbn-topbar__panel' )
			) {
				return;
			}
			$$( '[data-mbn-ecosistema-toggle]' ).forEach( ( t ) => {
				const panelId = t.getAttribute( 'aria-controls' );
				const p = panelId ? document.getElementById( panelId ) : null;
				if ( p ) {
					p.setAttribute( 'hidden', '' );
				}
				t.setAttribute( 'aria-expanded', 'false' );
			} );
		} );
	}

	/**
	 * Botonera de accesibilidad — contraste y tamaño del texto.
	 *
	 * El estado vive en <html> y **es de todo el sitio**: lo escribe también el
	 * arranque inline de inc/a11y.php antes del primer pintado, leyendo el mismo
	 * localStorage, para que al cambiar de página no haya ni parpadeo ni pérdida
	 * del ajuste. Este script mantiene el estado y la botonera en sincronía (§6).
	 *
	 *   html.mbn-contrast          → alto contraste.
	 *   html[data-mbn-text-step]   → nivel de escala, de -2 a 2.
	 *   --mbn-text-scale           → el factor del nivel, en línea sobre <html>.
	 *
	 * Un nivel son 2 puntos sobre el cuerpo de 16px, dos niveles por sentido:
	 * 12 / 14 / 16 / 18 / 20px (factores 0.75 / 0.875 / 1 / 1.125 / 1.25). Los
	 * tamaños del theme están escritos como `calc(Npx * var(--mbn-text-scale))`,
	 * así que basta con mover el factor (a11y.css).
	 *
	 * En los topes se marca `aria-disabled`, **no `disabled`**: un `disabled` que
	 * aparece con el foco puesto lo pierde y deja al teclado sin ancla (§8), que
	 * es justo lo que pasa al pulsar A+ hasta el máximo.
	 *
	 * Hay dos botoneras en el DOM —header desktop y offcanvas— y las dos reflejan
	 * el mismo estado, así que se actualizan todas a la vez.
	 */

	const MBN_TEXT_STEP_MIN = -2;
	const MBN_TEXT_STEP_MAX = 2;

	// 2 puntos por nivel sobre un cuerpo de 16px.
	const mbnTextScaleFor = ( step ) => ( 16 + ( step * 2 ) ) / 16;

	const MBN_STORE_CONTRAST = 'mbn-a11y-contrast';
	const MBN_STORE_TEXT_STEP = 'mbn-a11y-text-step';

	/**
	 * localStorage puede lanzar (navegación privada, cookies de terceros
	 * bloqueadas). El ajuste es una comodidad, no puede tumbar la botonera.
	 */
	function mbnStore( key, value ) {
		try {
			window.localStorage.setItem( key, value );
		} catch ( e ) {
			/* sin persistencia: el ajuste vale solo para esta página */
		}
	}

	function initA11yControls() {
		const buttons = $$( '[data-mbn-a11y]' );
		if ( ! buttons.length ) {
			return;
		}

		const root = document.documentElement;
		const status = document.getElementById( 'mbn-a11y-status' );

		const currentStep = () => {
			const step = parseInt( root.getAttribute( 'data-mbn-text-step' ) || '0', 10 );
			return isNaN( step ) ? 0 : Math.max( MBN_TEXT_STEP_MIN, Math.min( MBN_TEXT_STEP_MAX, step ) );
		};

		function sync() {
			const contrast = root.classList.contains( 'mbn-contrast' );
			const step = currentStep();

			buttons.forEach( ( button ) => {
				const kind = button.getAttribute( 'data-mbn-a11y' );

				if ( kind === 'contrast' ) {
					button.setAttribute( 'aria-pressed', contrast ? 'true' : 'false' );
				} else if ( kind === 'text-increase' ) {
					button.setAttribute( 'aria-disabled', step >= MBN_TEXT_STEP_MAX ? 'true' : 'false' );
				} else if ( kind === 'text-decrease' ) {
					button.setAttribute( 'aria-disabled', step <= MBN_TEXT_STEP_MIN ? 'true' : 'false' );
				}
			} );
		}

		function announce( message ) {
			if ( status ) {
				status.textContent = message;
			}
		}

		function setContrast( on ) {
			root.classList.toggle( 'mbn-contrast', on );
			mbnStore( MBN_STORE_CONTRAST, on ? '1' : '0' );
			sync();
			announce( on ? 'Alto contraste activado' : 'Alto contraste desactivado' );
		}

		function setTextStep( step ) {
			const next = Math.max( MBN_TEXT_STEP_MIN, Math.min( MBN_TEXT_STEP_MAX, step ) );
			root.setAttribute( 'data-mbn-text-step', String( next ) );
			root.style.setProperty( '--mbn-text-scale', String( mbnTextScaleFor( next ) ) );
			mbnStore( MBN_STORE_TEXT_STEP, String( next ) );
			sync();
			announce( 'Tamaño del texto: ' + Math.round( mbnTextScaleFor( next ) * 100 ) + ' por ciento' );
		}

		buttons.forEach( ( button ) => {
			button.addEventListener( 'click', () => {
				if ( button.disabled || button.getAttribute( 'aria-disabled' ) === 'true' ) {
					return;
				}

				const kind = button.getAttribute( 'data-mbn-a11y' );

				if ( kind === 'contrast' ) {
					setContrast( ! root.classList.contains( 'mbn-contrast' ) );
				} else if ( kind === 'text-increase' ) {
					setTextStep( currentStep() + 1 );
				} else if ( kind === 'text-decrease' ) {
					setTextStep( currentStep() - 1 );
				}
			} );
		} );

		// El arranque inline ya dejó <html> con el estado guardado; aquí solo se
		// pone la botonera al día (y se cubre el caso de que ese script falte).
		sync();
	}

	/**
	 * Init
	 */

	function init() {
		initDropdowns();
		initOffcanvasFocusReturn();
		initTopbarEcosistema();
		initA11yControls();
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', init );
	} else {
		init();
	}
}() );

/* mantiene visible el menú de escritorio o el header completo en móvil */
(() => {
	'use strict';
	const root = document.documentElement;
	const desktop = document.querySelector('[data-mbn-header="desktop"]');
	const mobile = document.querySelector('[data-mbn-header="mobile"]');
	if (!desktop || !mobile) return;
	const topRow = desktop.querySelector('.mbn-header__row--top');
	const navRow = desktop.querySelector('.mbn-header__sticky-nav');
	const adminBar = document.getElementById('wpadminbar');
	const breakpoint = window.matchMedia('(min-width: 1200px)');
	let scheduled = false;

	const update = () => {
		scheduled = false;
		const header = breakpoint.matches ? desktop : mobile;
		const enabled = header.dataset.mbnSticky === 'true';
		const zoom = header.offsetWidth ? header.getBoundingClientRect().width / header.offsetWidth : 1;
		const adminBottom = adminBar ? Math.max(0, adminBar.getBoundingClientRect().bottom) : 0;
		root.style.setProperty('--mbn-sticky-admin-offset', `${adminBottom / zoom}px`);
		root.style.setProperty('--mbn-sticky-top-height', `${topRow.getBoundingClientRect().height / zoom}px`);
		const logoWidth = desktop.querySelector('.mbn-header__logo').getBoundingClientRect().width;
		root.style.setProperty('--mbn-sticky-stripe-width', `${logoWidth / zoom || 220}px`);
		const row = breakpoint.matches ? navRow : mobile;
		root.style.setProperty('--mbn-sticky-offset', `${enabled ? row.getBoundingClientRect().height + adminBottom : 0}px`);
		desktop.classList.toggle('mbn-header--stuck', enabled && breakpoint.matches && window.scrollY > 0 && navRow.getBoundingClientRect().top <= adminBottom + 1);
		mobile.classList.toggle('mbn-header--stuck', enabled && !breakpoint.matches && window.scrollY > 0 && mobile.getBoundingClientRect().top <= adminBottom + 1);
	};
	const schedule = () => {
		if (!scheduled) {
			scheduled = true;
			requestAnimationFrame(update);
		}
	};
	const observer = new ResizeObserver(schedule);
	[topRow, navRow, mobile, adminBar].filter(Boolean).forEach(el => observer.observe(el));
	window.addEventListener('scroll', schedule, {passive: true});
	window.addEventListener('resize', schedule, {passive: true});
	breakpoint.addEventListener('change', schedule);
	document.fonts.ready.then(schedule);
	desktop.addEventListener('focusin', event => {
		if (desktop.classList.contains('mbn-header--stuck') && topRow.contains(event.target)) window.scrollTo(0, 0);
	});
	update();
})();
