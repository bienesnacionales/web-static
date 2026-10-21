/**
 * Interruptor de publicación.
 *
 * Un sitio que se publica antes de estar terminado necesita poder apagar
 * secciones enteras y volver a encenderlas sin tocar código. Aquí vive esa
 * decisión, en un solo sitio, para que no pueda contradecirse a sí misma.
 *
 * La fuente de verdad es `borrador: true` en el *frontmatter* del Markdown.
 * Todo lo demás —el Mega Menú, el pie, las migas, los listados de hermanas e
 * hijas y el sitemap— se deriva de ahí. Apagar un enlace no apaga una página;
 * sólo esconde la puerta principal y deja abiertas las demás.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import {
  navegacion as navegacionCompleta,
  accesosRapidos as accesosCompletos,
  type SeccionNav,
  type ColumnaNav,
  type EnlaceNav,
} from '@/data/navigation';

type Pagina = CollectionEntry<'paginas'>;

/**
 * ¿Esta construcción muestra los borradores?
 *
 * En desarrollo siempre: apagar una página no puede significar dejar de poder
 * escribirla. En construcción, sólo si se pide expresamente
 * (`PUBLICAR_BORRADORES=true npm run build`).
 *
 * Se mira `MODE` y no `DEV`: `DEV` sale de `NODE_ENV` y un contenedor de
 * desarrollo puede exportar `NODE_ENV=development` también para los builds.
 * `MODE` lo fija el propio comando y el entorno no puede contradecirlo.
 */
export const PUBLICAR_BORRADORES =
  import.meta.env.MODE !== 'production' || process.env.PUBLICAR_BORRADORES === 'true';

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
 * Rutas que se sirven siempre porque no salen de la colección `paginas`:
 * viven como archivos en `src/pages/`. Sin ellas, el filtro de navegación
 * borraría Noticias, Galerías y Contacto del menú por no encontrarlas en el
 * contenido.
 */
const RUTAS_FIJAS = ['/', '/contacto', '/galerias', '/noticias', '/buscar'];

/**
 * Las páginas que se publican, con la cascada aplicada.
 *
 * Cascada: apagar `documentacion` apaga `documentacion/adjudicaciones` y todo
 * lo que cuelgue por debajo. Sin ella quedarían páginas huérfanas accesibles
 * por URL, con migas que apuntan a una sección que ya no existe.
 */
export function paginasPublicadas(todas: Pagina[]): Pagina[] {
  if (PUBLICAR_BORRADORES) return todas;

  const apagadas = todas.filter((p) => p.data.borrador).map((p) => p.id);
  return todas.filter(
    (p) => !apagadas.some((raiz) => p.id === raiz || p.id.startsWith(`${raiz}/`)),
  );
}

/** Conjunto de rutas vivas, para resolver los enlaces del menú y del pie. */
export function rutasPublicadas(paginas: Pagina[]): Set<string> {
  return new Set([...RUTAS_FIJAS, ...paginas.map((p) => `/${p.id}`)]);
}

/**
 * ¿Se dibuja este enlace?
 *
 * Los externos salen siempre: su destino no depende de lo que construyamos.
 * Los internos, sólo si la página existe y `navigation.ts` no los ha apagado a
 * mano.
 */
function enlaceVisible(enlace: EnlaceNav, rutas: Set<string>): boolean {
  if (enlace.inactivo) return false;
  return enlace.externo === true || rutas.has(enlace.href);
}

function filtrarEnlaces(enlaces: EnlaceNav[], rutas: Set<string>): EnlaceNav[] {
  return enlaces
    .filter((e) => enlaceVisible(e, rutas))
    .map((e) => (e.hijos ? { ...e, hijos: filtrarEnlaces(e.hijos, rutas) } : e));
}

function filtrarColumnas(columnas: ColumnaNav[], rutas: Set<string>): ColumnaNav[] {
  return columnas
    .map((columna) => ({
      ...columna,
      // Una columna puede tener página propia. Si esa página se apaga pero sus
      // hijas siguen vivas, la columna se queda como rótulo sin enlace en vez
      // de desaparecer con sus hijas dentro.
      href: columna.href && rutas.has(columna.href) ? columna.href : undefined,
      enlaces: filtrarEnlaces(columna.enlaces, rutas),
    }))
    .filter((columna) => columna.enlaces.length > 0);
}

/**
 * Navegación reducida a lo que existe. Función pura y sin `astro:content`: eso
 * permite pasar su resultado como prop a la isla React del Mega Menú, que es lo
 * que garantiza que escritorio, móvil y pie muestren exactamente lo mismo.
 */
export function filtrarNavegacion(
  navegacion: SeccionNav[],
  rutas: Set<string>,
): SeccionNav[] {
  return navegacion
    .filter((seccion) => rutas.has(seccion.href))
    .map((seccion) => ({ ...seccion, columnas: filtrarColumnas(seccion.columnas, rutas) }));
}

/**
 * Lo que consumen la cabecera y el pie: la navegación ya podada y el conjunto
 * de rutas vivas, por si el componente necesita comprobar alguna más.
 */
export async function navegacionPublicada(): Promise<{
  navegacion: SeccionNav[];
  accesosRapidos: EnlaceNav[];
  rutas: Set<string>;
}> {
  const paginas = paginasPublicadas(await getCollection('paginas'));
  const rutas = rutasPublicadas(paginas);
  return {
    navegacion: filtrarNavegacion(navegacionCompleta, rutas),
    accesosRapidos: filtrarEnlaces(accesosCompletos, rutas),
    rutas,
  };
}
