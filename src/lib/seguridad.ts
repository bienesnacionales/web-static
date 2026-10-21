/**
 * La política de seguridad de contenido (CSP) del sitio.
 *
 * Vive aquí, en una sola función, para que no pueda contradecirse a sí misma.
 *
 * Se escribe a mano y no con `experimental.csp` de Astro porque el sitio tiene
 * scripts `is:inline` que deben ejecutarse antes del primer pintado (tema y
 * accesibilidad) y en cuanto una CSP declara un solo hash el navegador ignora
 * `'unsafe-inline'` por especificación: activar la vía experimental los
 * dejaría bloqueados, con el tema parpadeando y las preferencias sin aplicar.
 *
 * **Qué se pierde con `'unsafe-inline'` y por qué se acepta.** Se pierde la
 * defensa contra un script inyectado en el HTML. Se conserva la que aquí
 * importa: `script-src 'self'` impide cargar código desde cualquier origen
 * ajeno. Para inyectar un script inline en un sitio estático hay que poder
 * escribir en el repositorio o en el build — momento en el cual también se
 * puede reescribir esta misma etiqueta.
 *
 * Lo que deliberadamente NO está aquí, y no es un olvido:
 *  - `frame-ancestors`: los navegadores lo ignoran dentro de un `<meta>`.
 *    Exige cabecera HTTP en el servidor.
 *  - `upgrade-insecure-requests`: dentro de un `<meta>` rompería un servidor
 *    de revisión servido por HTTP plano. Va en el servidor, junto a HSTS.
 */

/** Origen del script de Google Analytics 4. */
const GA_SCRIPT = 'https://www.googletagmanager.com';

/*
  Los cuatro destinos de medición, y ninguno sobra. En CSP,
  `*.analytics.google.com` NO cubre `analytics.google.com`: el asterisco exige
  un subdominio, y GA4 usa el dominio pelado. `*.google-analytics.com` está por
  los endpoints regionales (`region1`, `region2`…), que GA4 elige según desde
  dónde se conecte el visitante.
*/
const GA_CONEXION = [
  'https://www.google-analytics.com',
  'https://*.google-analytics.com',
  'https://analytics.google.com',
  'https://*.analytics.google.com',
];

/**
 * La política, como cadena lista para el atributo `content` del `<meta>`.
 *
 * @param gaId  Identificador de GA4, si la analítica está encendida.
 */
export function politicaCsp(gaId?: string): string {
  const conGa = Boolean(gaId);

  const directivas: Record<string, string[]> = {
    // Base cerrada: todo lo que no se nombre abajo tiene que ser del sitio.
    'default-src': ["'self'"],

    /*
      `'wasm-unsafe-eval'` es obligatorio y es la línea más frágil del archivo:
      el buscador carga un módulo WebAssembly, y sin este permiso Pagefind
      falla **sin dar ningún error visible**: la caja acepta texto y no
      devuelve nada nunca. Si alguien quita esto, el buscador muere en
      silencio.
    */
    'script-src': [
      "'self'",
      "'unsafe-inline'",
      "'wasm-unsafe-eval'",
      ...(conGa ? [GA_SCRIPT] : []),
    ],

    // Astro deja `<style>` en el HTML: sin `'unsafe-inline'` el sitio sale
    // sin estilos.
    'style-src': ["'self'", "'unsafe-inline'"],

    'img-src': ["'self'", 'data:', ...(conGa ? [GA_SCRIPT, ...GA_CONEXION] : [])],

    /*
      Fuentes autoalojadas con `@fontsource`: cero peticiones a un CDN.
      `data:` no sobra: Vite incrusta en base64 los recursos por debajo de su
      umbral de inline, y un subconjunto de fuente puede caer dentro del CSS
      como `src:url(data:font/woff2;...)`. Sin este permiso el navegador lo
      bloquea y el texto se pinta con la fuente de reserva, sin error visible.
    */
    'font-src': ["'self'", 'data:'],

    // Pagefind pide su índice al mismo origen. El sitio no hace ninguna otra
    // petición en tiempo de ejecución.
    'connect-src': ["'self'", ...(conGa ? GA_CONEXION : [])],

    'object-src': ["'none'"],

    // Impide que un `<base>` inyectado reescriba a dónde apuntan todas las
    // rutas relativas de la página de golpe.
    'base-uri': ["'self'"],

    // El sitio no tiene formularios propios: el de contacto es un enlace al
    // del Ministerio. Cualquier envío desde estas páginas es un ataque.
    'form-action': ["'none'"],
  };

  return Object.entries(directivas)
    .map(([nombre, valores]) => `${nombre} ${valores.join(' ')}`)
    .join('; ');
}
