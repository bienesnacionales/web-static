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
