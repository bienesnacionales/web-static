/**
 * Degradado de respaldo para las tarjetas que no tienen imagen.
 *
 * Un hueco gris se lee como error de carga; un degradado de la familia de la
 * marca se lee como decisión. La elección es determinista a partir de un texto
 * estable —el slug— para que no cambie entre compilaciones y para que dos
 * tarjetas contiguas no salgan casi siempre iguales.
 *
 * Cuando lleguen las fotos reales, esto se sustituye por `<Image>` de
 * `astro:assets` en cada tarjeta; el módulo se queda para las que sigan sin
 * imagen.
 *
 * **`global.css` debe rastrear este archivo con `@source`**: las clases viven
 * en cadenas y Tailwind sólo genera lo que encuentra escrito en los archivos
 * que rastrea. Sin esa línea, las tarjetas sin imagen salen con el `div`
 * puesto y sin fondo ninguno.
 */
export const DEGRADADOS = [
  'from-comunidad-800 via-comunidad-700 to-comunidad-900',
  'from-tierra-800 via-comunidad-800 to-comunidad-950',
  'from-comunidad-900 via-comunidad-700 to-tierra-600',
] as const;

/** Devuelve las clases del degradado que corresponde a `clave`. */
export function degradadoPara(clave: string): string {
  const indice = [...clave].reduce((suma, c) => suma + c.charCodeAt(0), 0) % DEGRADADOS.length;
  return DEGRADADOS[indice];
}
