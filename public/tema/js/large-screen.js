( function () {
	'use strict';

	if ( ! window.CSS || ! CSS.supports( 'zoom', '1.1' ) ) {
		return;
	}

	const root = document.documentElement;
	const reference = Math.max( 1440, parseFloat( getComputedStyle( root ).getPropertyValue( '--mbn-scale-reference' ) ) || 1440 );
	let density = window.devicePixelRatio || 1;
	let screenWidth = window.screen.width;
	let screenHeight = window.screen.height;
	let frame = 0;
	const storageKey = 'mbn-screen-density';
	try {
		const saved = JSON.parse( sessionStorage.getItem( storageKey ) );
		if ( saved && saved.width === screenWidth && saved.height === screenHeight && saved.density > 0 ) {
			density = saved.density;
		}
	} catch ( error ) {
		// la escala funciona también cuando el almacenamiento está bloqueado
	}

	function rememberDensity() {
		try {
			sessionStorage.setItem( storageKey, JSON.stringify( { width: screenWidth, height: screenHeight, density: density } ) );
		} catch ( error ) {
			// guardar la referencia es opcional
		}
	}

	function update() {
		frame = 0;
		const currentDensity = window.devicePixelRatio || 1;
		// al cambiar de pantalla se toma su densidad como nueva referencia
		if ( screenWidth !== window.screen.width || screenHeight !== window.screen.height ) {
			density = currentDensity;
			screenWidth = window.screen.width;
			screenHeight = window.screen.height;
			rememberDensity();
		}
		// conserva el zoom que el usuario aplica durante la navegación
		const width = window.innerWidth * currentDensity / density;
		const scale = Math.max( 1, width / reference );
		root.style.setProperty( '--mbn-screen-scale', String( scale ) );
		root.style.setProperty( '--mbn-viewport-width', ( window.innerWidth / scale ) + 'px' );
		root.style.setProperty( '--mbn-viewport-height', ( window.innerHeight / scale ) + 'px' );
		root.toggleAttribute( 'data-mbn-large-screen', scale > 1 );
	}

	function schedule() {
		if ( ! frame ) {
			frame = window.requestAnimationFrame( update );
		}
	}

	rememberDensity();
	update();
	window.addEventListener( 'resize', schedule );
	window.addEventListener( 'orientationchange', schedule );
	document.addEventListener( 'fullscreenchange', schedule );
} )();
