/**
 * Interruptores del sitio.
 *
 * Viven en el código y no en variables de entorno del despliegue: el valor que
 * se publica es el que está escrito aquí. Para cambiar el estado del sitio en
 * producción se cambia este archivo y se despliega.
 *
 * Una variable de entorno con el mismo nombre (`true` o `false`) sobrescribe el
 * valor, para probar el otro estado en local sin tocar el archivo:
 * `MODO_MANTENCION=false npm run dev`.
 *
 * Es `.mjs` y no `.ts` porque también lo lee `astro.config.mjs`, que se carga
 * antes que el código del sitio.
 */

/** @param {string} nombre @param {boolean} porDefecto */
function interruptor(nombre, porDefecto) {
  const valor = process.env[nombre];
  return valor === undefined || valor === '' ? porDefecto : valor === 'true';
}

/**
 * Sitio en mantención: la portada es «Sitio en Mantención» y el resto de las
 * URL redirige a ella. **`false` publica el sitio completo.**
 */
export const MODO_MANTENCION = interruptor('MODO_MANTENCION', false);

/**
 * Sitio indexable por los buscadores. Con `false`, cada página sale con
 * `noindex, nofollow` y `robots.txt` cierra el sitio entero: es lo que se
 * quiere en un servidor de revisión, nunca en www.bienesnacionales.cl, donde
 * sacaría al Ministerio de los resultados de búsqueda.
 */
export const SITIO_PUBLICO = interruptor('SITIO_PUBLICO', true);

/**
 * Contenedores de Google Tag Manager del Ministerio, los mismos que cargaba el
 * sitio anterior. Cada uno publica en su propiedad de Google Analytics 4. Sólo
 * se cargan con `SITIO_PUBLICO`.
 */
export const CONTENEDORES_GTM = [
  'GTM-W223SKX', // General (G-ZMS9ZHNTZW)
  'GTM-MLH6ZBL', // Registro de Goce Singular (G-C2LF9FNF8D)
  'GTM-NVSV5PN', // Registro Nacional de Contratistas (G-NR22DBEYGQ)
  'GTM-5QF3NC9', // Donación de Bienes (G-E3VJ1MCYXJ)
  'GTM-T26K4RS', // Permuta (G-3FS58CZ776)
];
