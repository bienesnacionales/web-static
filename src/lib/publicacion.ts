/**
 * Interruptores de la construcción: en qué estado sale el sitio.
 */

/**
 * ¿Esta construcción es la del sitio público?
 *
 * Mientras el sitio no esté en `www.bienesnacionales.cl` hay que poder
 * instalarlo en un servidor de revisión sin que los buscadores lo encuentren.
 * Con esto en `false`, cada página sale con `noindex, nofollow` y `robots.txt`
 * prohíbe el sitio entero.
 *
 * **El valor por defecto es «no público», y es deliberado**: de los dos
 * errores posibles es el reversible. El día del lanzamiento:
 * `SITIO_PUBLICO=true` en las variables de CI/CD.
 */
export const SITIO_PUBLICO = process.env.SITIO_PUBLICO === 'true';

/**
 * ¿Esta construcción es la de mantención?
 *
 * Con `MODO_MANTENCION=true` la portada es la de «Sitio en Mantención» y el
 * build convierte el resto de las páginas en redirecciones a ella (eso último
 * lo hace `astro.config.mjs`, que lee la misma variable).
 */
export const MODO_MANTENCION = process.env.MODO_MANTENCION === 'true';
