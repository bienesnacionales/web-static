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
  Los destinos de medición, y ninguno sobra. En CSP,
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
  // Tag Manager pide desde aquí la configuración de cada etiqueta de GA4.
  'https://*.googletagmanager.com',
];

/**
 * La política, como cadena lista para el atributo `content` del `<meta>`.
 *
 * @param conGa  Si la página carga Google Analytics (directo o con Tag Manager).
 */
export function politicaCsp(conGa = false): string {

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
      // Las noticias con publicaciones de Instagram incrustadas cargan su script.
      'https://www.instagram.com',
      ...(conGa ? [GA_SCRIPT] : []),
    ],

    // El tema y el contenido llevan `style=""` y `<style>`: sin
    // `'unsafe-inline'` el sitio sale sin estilos.
    'style-src': ["'self'", "'unsafe-inline'"],

    // Las noticias citan imágenes de otros sitios del Gobierno y de las redes
    // que incrustan. Una imagen no ejecuta código: abrir `https:` aquí no
    // abre la puerta que cierra `script-src`.
    'img-src': ["'self'", 'data:', 'https:'],

    // Videos y mapas incrustados en el contenido.
    'frame-src': [
      "'self'",
      'https://www.youtube.com',
      'https://youtube.com',
      'https://www.youtube-nocookie.com',
      'https://*.arcgis.com',
      'https://www.bienesnacionales.cl',
      'https://www.instagram.com',
    ],

    'media-src': ["'self'"],

    'font-src': ["'self'", 'data:'],

    // Pagefind pide su índice al mismo origen, y los listados sus datos.
    'connect-src': ["'self'", ...(conGa ? GA_CONEXION : [])],

    'object-src': ["'none'"],

    // Impide que un `<base>` inyectado reescriba a dónde apuntan todas las
    // rutas relativas de la página de golpe.
    'base-uri': ["'self'"],

    // Los únicos formularios son los de búsqueda (GET al propio sitio) y la
    // encuesta y el chatbot, que envían por `fetch`.
    'form-action': ["'self'"],
  };

  return Object.entries(directivas)
    .map(([nombre, valores]) => `${nombre} ${valores.join(' ')}`)
    .join('; ');
}
