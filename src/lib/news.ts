/**
 * Capa de acceso a noticias (BRIEF §5).
 *
 * Etapa 1: lee la colección `noticias`, migrada desde el sitio antiguo a
 *          `src/content/noticias/`.
 * Etapa 2: reemplazar únicamente el cuerpo de `obtenerTodas()` por una llamada
 *          al Headless CMS. La firma de las funciones y el tipo `Noticia` son
 *          el contrato con el maquetado, que no debe cambiar.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { PUBLICAR_BORRADORES } from '@/lib/publicacion';

export interface Noticia {
  slug: string;
  titulo: string;
  resumen: string;
  /** ISO 8601 (YYYY-MM-DD). */
  fecha: string;
  categoria: string;
  /**
   * Portada ya resuelta por `image()` del esquema: trae ruta, ancho y alto
   * reales, que es lo que `<Image>` necesita para reservar el hueco exacto.
   * En la Etapa 2 el CMS deberá entregar el mismo trío.
   */
  imagen?: ImageMetadata;
  imagenAlt?: string;
  destacada?: boolean;
  /**
   * En preparación. Sólo llega hasta aquí en desarrollo o con
   * `PUBLICAR_BORRADORES`: `obtenerTodas()` las descarta en producción. Se
   * expone para que el artículo pueda avisar de que lo que se está viendo no
   * está publicado. El CMS de la Etapa 2 deberá entregar el mismo campo.
   */
  borrador?: boolean;
  /** Entrada original, para renderizar el cuerpo con `render()`. */
  entrada?: CollectionEntry<'noticias'>;
}

function aNoticia(entrada: CollectionEntry<'noticias'>): Noticia {
  const d = entrada.data;
  return {
    slug: entrada.id,
    titulo: d.titulo,
    resumen: d.resumen,
    fecha: d.fecha.toISOString().slice(0, 10),
    categoria: d.categoria,
    imagen: d.imagen,
    imagenAlt: d.imagenAlt,
    destacada: d.destacada,
    borrador: d.borrador,
    entrada,
  };
}

/**
 * Punto único de entrada a la fuente de datos.
 *
 * El filtro de borradores vive aquí, y no en cada página, porque éste es el
 * cuello de botella por el que pasan el listado, la paginación, las destacadas
 * de la portada y `getStaticPaths` del artículo: una noticia apagada desaparece
 * de las cuatro a la vez o no está realmente apagada.
 */
async function obtenerTodas(): Promise<Noticia[]> {
  const entradas = await getCollection('noticias');
  const visibles = PUBLICAR_BORRADORES ? entradas : entradas.filter((e) => !e.data.borrador);
  return visibles.map(aNoticia);
}

const porFechaDesc = (a: Noticia, b: Noticia) =>
  new Date(b.fecha).getTime() - new Date(a.fecha).getTime();

/** Listado completo, del más reciente al más antiguo. */
export async function listarNoticias(): Promise<Noticia[]> {
  const noticias = await obtenerTodas();
  return [...noticias].sort(porFechaDesc);
}

/** Las N noticias destacadas más recientes para la Home (por defecto 3). */
export async function listarDestacadas(limite = 3): Promise<Noticia[]> {
  const noticias = await listarNoticias();
  const destacadas = noticias.filter((n) => n.destacada);
  // Si no hay suficientes marcadas como destacadas, se completa con las
  // más recientes para que la Home nunca quede con huecos.
  const complemento = noticias.filter((n) => !n.destacada);
  return [...destacadas, ...complemento].slice(0, limite);
}

/** Una noticia por slug, o `undefined` si no existe. */
export async function obtenerNoticia(slug: string): Promise<Noticia | undefined> {
  const noticias = await obtenerTodas();
  return noticias.find((n) => n.slug === slug);
}

/** Formatea una fecha ISO al formato legible es-CL. */
export function formatearFecha(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Noticias por página en el listado (BRIEF §5). */
export const POR_PAGINA = 12;

/**
 * Ruta de una página del listado. La primera es `/noticias` y no
 * `/noticias/pagina/1`, para no tener dos URL con el mismo contenido.
 */
export function rutaPagina(numero: number): string {
  return numero <= 1 ? '/noticias' : `/noticias/pagina/${numero}`;
}

export interface PaginaNoticias {
  noticias: Noticia[];
  actual: number;
  total: number;
}

/** Número total de páginas del listado (mínimo 1, aunque no haya noticias). */
export async function contarPaginas(): Promise<number> {
  const noticias = await listarNoticias();
  return Math.max(1, Math.ceil(noticias.length / POR_PAGINA));
}

/** Una página del listado, ya ordenada y recortada. */
export async function listarPagina(numero: number): Promise<PaginaNoticias> {
  const noticias = await listarNoticias();
  const total = Math.max(1, Math.ceil(noticias.length / POR_PAGINA));
  const actual = Math.min(Math.max(1, numero), total);
  const desde = (actual - 1) * POR_PAGINA;
  return { noticias: noticias.slice(desde, desde + POR_PAGINA), actual, total };
}
