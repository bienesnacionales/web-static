/* gestiona las interacciones de tarjetas de acceso y destacados */
( function () {
	'use strict';

	function init( section ) {
		const track = section.querySelector( '.mbn-card-grid__grid' );
		const cards = Array.from( track.children );
		const controls = section.querySelector( '.mbn-card-grid__controls' );
		const previous = section.querySelector( '.mbn-card-grid__nav--prev' );
		const next = section.querySelector( '.mbn-card-grid__nav--next' );
		const status = section.querySelector( '[data-mbn-card-carousel-status]' );
		const mobileMedia = window.matchMedia( '(max-width: 767.98px)' );
		const reducedMotion = window.matchMedia( '(prefers-reduced-motion: reduce)' );
		let mobile = mobileMedia.matches;
		let enabled = false;
		let active = 0;
		let stopped = reducedMotion.matches;
		let hovering = false;
		let focused = false;
		let touching = false;
		let inView = ! window.IntersectionObserver;
		let moving = false;
		let targets = [];
		let position = 0;
		let cycleStart = 0;
		let cycleLength = 0;
		let frame = 0;
		let lastTime = 0;
		let layoutKey = '';
		let settleTimer;
		let drag = null;
		let suppressClick = false;

		track.tabIndex = 0;
		track.setAttribute( 'aria-label', 'Tarjetas destacadas. Usa las flechas izquierda y derecha para desplazarte.' );

		function render() {
			const text = ( active + 1 ) + ' de ' + cards.length;
			if ( status.textContent.trim() !== text ) status.textContent = text;
			status.setAttribute( 'aria-live', mobile ? 'polite' : 'off' );
			previous.disabled = active === 0;
			next.disabled = active === cards.length - 1;
		}
		function stopFrame() {
			cancelAnimationFrame( frame );
			frame = 0;
			lastTime = 0;
		}
		function canAnimate() {
			return enabled && ! mobile && ! stopped && ! hovering && ! focused && ! touching && ! moving && inView && ! document.hidden;
		}
		function normalize( value ) {
			return cycleStart + ( ( value - cycleStart ) % cycleLength + cycleLength ) % cycleLength;
		}
		function tick( time ) {
			frame = 0;
			if ( ! canAnimate() ) { lastTime = 0; return; }
			// 24 px por segundo: avance constante, sin pausas entre tarjetas
			if ( lastTime ) position = normalize( position + Math.min( time - lastTime, 50 ) * 0.024 );
			lastTime = time;
			track.scrollLeft = position;
			frame = requestAnimationFrame( tick );
		}
		function animate() {
			if ( ! canAnimate() ) { stopFrame(); return; }
			if ( ! frame ) {
				position = normalize( track.scrollLeft );
				frame = requestAnimationFrame( tick );
			}
		}
		function nearest() {
			return targets.reduce( function ( best, target, index ) {
				return Math.abs( track.scrollLeft - target ) < Math.abs( track.scrollLeft - targets[ best ] ) ? index : best;
			}, 0 );
		}
		function settle() {
			if ( touching || ! enabled ) return;
			moving = false;
			position = track.scrollLeft;
			active = nearest();
			render();
			animate();
		}
		function go( index ) {
			if ( ! enabled ) return;
			active = Math.max( 0, Math.min( cards.length - 1, index ) );
			moving = true;
			stopFrame();
			track.scrollTo( { left: targets[ active ], behavior: reducedMotion.matches ? 'instant' : 'smooth' } );
			render();
			clearTimeout( settleTimer );
			settleTimer = setTimeout( settle, 800 );
		}
		function clone( card ) {
			const copy = card.cloneNode( true );
			copy.setAttribute( 'data-mbn-card-clone', '' );
			copy.setAttribute( 'aria-hidden', 'true' );
			copy.removeAttribute( 'id' );
			copy.querySelectorAll( '[id]' ).forEach( function ( node ) { node.removeAttribute( 'id' ); } );
			copy.querySelectorAll( 'a, button, input, select, textarea, [tabindex]' ).forEach( function ( node ) { node.tabIndex = -1; } );
			return copy;
		}
		function layout() {
			mobile = mobileMedia.matches;
			const visible = window.matchMedia( '(min-width: 1200px)' ).matches ? 3 : 2;
			const key = mobile + ':' + visible + ':' + track.clientWidth;
			if ( key === layoutKey ) return;
			layoutKey = key;
			stopFrame();
			clearTimeout( settleTimer );
			moving = false;
			track.querySelectorAll( '[data-mbn-card-clone]' ).forEach( function ( node ) { node.remove(); } );
			enabled = mobile || cards.length > visible;
			section.classList.toggle( 'mbn-card-grid--carousel', enabled );
			section.classList.toggle( 'mbn-card-grid--continuous', enabled && ! mobile );
			if ( enabled ) section.setAttribute( 'aria-roledescription', 'carrusel' );
			else section.removeAttribute( 'aria-roledescription' );
			controls.hidden = ! enabled || ! mobile;
			if ( ! enabled ) { track.scrollLeft = 0; render(); return; }
			if ( ! mobile ) {
				const before = document.createDocumentFragment();
				cards.slice( -visible ).forEach( function ( card ) { before.appendChild( clone( card ) ); } );
				track.prepend( before );
				cards.slice( 0, visible ).forEach( function ( card ) { track.appendChild( clone( card ) ); } );
			}
			cycleStart = cards[ 0 ].offsetLeft;
			const step = cards[ 1 ].offsetLeft - cards[ 0 ].offsetLeft;
			cycleLength = step * cards.length;
			const max = track.scrollWidth - track.clientWidth;
			targets = cards.map( function ( card ) {
				return mobile ? Math.max( 0, Math.min( max, card.offsetLeft - ( track.clientWidth - card.offsetWidth ) / 2 ) ) : card.offsetLeft;
			} );
			position = targets[ active ];
			track.scrollTo( { left: position, behavior: 'instant' } );
			render();
			animate();
		}

		previous.addEventListener( 'click', function () { go( active - 1 ); } );
		next.addEventListener( 'click', function () { go( active + 1 ); } );
		track.addEventListener( 'scroll', function () {
			if ( frame || ! enabled ) return;
			position = track.scrollLeft;
			if ( mobile && ! moving ) { active = nearest(); render(); }
			clearTimeout( settleTimer );
			settleTimer = setTimeout( settle, 160 );
		}, { passive: true } );
		track.addEventListener( 'scrollend', function () { if ( moving ) settle(); } );
		track.addEventListener( 'keydown', function ( event ) {
			if ( event.target !== track || ! enabled ) return;
			const current = moving ? active : nearest();
			const keys = { ArrowLeft: current - 1, ArrowRight: current + 1, Home: 0, End: cards.length - 1 };
			if ( Object.prototype.hasOwnProperty.call( keys, event.key ) ) { event.preventDefault(); go( keys[ event.key ] ); }
		} );
		function endDrag( event ) {
			const finished = drag;
			drag = null;
			touching = false;
			track.classList.remove( 'mbn-card-grid__grid--dragging' );
			if ( finished ) {
				if ( track.hasPointerCapture( finished.id ) ) track.releasePointerCapture( finished.id );
				if ( finished.moved ) {
					suppressClick = true;
					if ( track.contains( document.activeElement ) ) document.activeElement.blur();
				}
				if ( event ) hovering = track.contains( document.elementFromPoint( event.clientX, event.clientY ) );
			}
			settle();
		}
		track.addEventListener( 'pointerdown', function ( event ) {
			if ( ! enabled || ( event.pointerType === 'mouse' && event.button !== 0 ) ) return;
			suppressClick = false;
			touching = true;
			animate();
			if ( mobile || event.pointerType !== 'mouse' ) return;
			drag = { id: event.pointerId, x: event.clientX, scroll: track.scrollLeft, moved: false };
			if ( ! event.target.closest( 'a, button, input, select, textarea' ) ) event.preventDefault();
		} );
		window.addEventListener( 'pointermove', function ( event ) {
			if ( ! drag || event.pointerId !== drag.id ) return;
			if ( !( event.buttons & 1 ) ) { endDrag( event ); return; }
			const distance = event.clientX - drag.x;
			if ( ! drag.moved && Math.abs( distance ) < 5 ) return;
			if ( ! drag.moved ) {
				drag.moved = true;
				track.setPointerCapture( event.pointerId );
				track.classList.add( 'mbn-card-grid__grid--dragging' );
			}
			event.preventDefault();
			const scale = track.getBoundingClientRect().width / track.offsetWidth || 1;
			position = normalize( drag.scroll - distance / scale );
			track.scrollLeft = position;
		}, { passive: false } );
		window.addEventListener( 'pointerup', function ( event ) { if ( touching ) endDrag( event ); } );
		window.addEventListener( 'pointercancel', function ( event ) { if ( touching ) endDrag( event ); } );
		window.addEventListener( 'blur', function () { if ( drag ) endDrag(); } );
		track.addEventListener( 'lostpointercapture', function ( event ) { if ( drag && drag.id === event.pointerId ) endDrag( event ); } );
		track.addEventListener( 'dragstart', function ( event ) { if ( enabled && ! mobile ) event.preventDefault(); } );
		// evita abrir los enlaces al finalizar un arrastre de tarjetas
		track.addEventListener( 'click', function ( event ) {
			if ( suppressClick && event.detail > 0 ) {
				suppressClick = false;
				event.preventDefault();
				event.stopImmediatePropagation();
			}
		}, true );
		track.addEventListener( 'pointerenter', function ( event ) { if ( event.pointerType === 'mouse' ) { hovering = true; animate(); } } );
		track.addEventListener( 'pointerleave', function () { hovering = false; animate(); } );
		section.addEventListener( 'focusin', function () { focused = true; animate(); } );
		section.addEventListener( 'focusout', function () {
			requestAnimationFrame( function () { focused = section.contains( document.activeElement ); animate(); } );
		} );
		document.addEventListener( 'visibilitychange', animate );
		reducedMotion.addEventListener( 'change', function () { stopped = reducedMotion.matches; render(); animate(); } );
		mobileMedia.addEventListener( 'change', layout );
		layout();
		if ( window.ResizeObserver ) new ResizeObserver( layout ).observe( track );
		else window.addEventListener( 'resize', layout );
		if ( window.IntersectionObserver ) {
			new IntersectionObserver( function ( entries ) { inView = entries[ 0 ].isIntersecting; animate(); }, { threshold: 0.15 } ).observe( section );
		}
	}
	function boot() { document.querySelectorAll( '[data-mbn-card-carousel]' ).forEach( init ); }
	if ( document.readyState === 'loading' ) document.addEventListener( 'DOMContentLoaded', boot );
	else boot();
}() );
