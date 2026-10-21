import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Colección única para todas las páginas de contenido institucional.
 * El `id` de cada entrada es su ruta relativa dentro de `src/content/`, así
 * que `documentacion/adjudicaciones.md` se publica en
 * `/documentacion/adjudicaciones` sin necesidad de declarar nada más: el
 * renderizador genérico `src/pages/[...ruta].astro` ya la publica.
 */
const paginas = defineCollection({
  // Se excluye `noticias/`: tiene su propia colección y su esquema.
  loader: glob({
    pattern: ['**/*.md', '!noticias/**'],
    base: './src/content',
  }),
  schema: z.object({
    titulo: z.string(),
    descripcion: z.string(),
    /** Bloque de primer nivel de la navegación al que pertenece. */
    seccion: z.enum(['quienes-somos', 'comunidades-agricolas', 'documentacion']),
    /** Etiqueta superior en mayúsculas. */
    eyebrow: z.string().optional(),
    /** Orden dentro del índice de su sección. */
    orden: z.number().default(99),
    /**
     * Contenido en preparación: no se publica.
     *
     * En producción la página no se construye. No aparece en el Mega Menú, ni
     * en el pie, ni en el `sitemap.xml`, y su URL devuelve 404. El apagado
     * arrastra a las páginas que cuelgan de ella.
     *
     * En `astro dev` sí se ve, con un distintivo, para poder seguir
     * escribiéndola. Quien decida publicar borradores en una construcción de
     * vista previa usa `PUBLICAR_BORRADORES=true`.
     *
     * Declárelo a mano en cada página aunque el valor por defecto lo haga
     * innecesario: escrito, apagar una sección es cambiar `false` por `true`
     * en la página que se tiene delante.
     */
    borrador: z.boolean().default(false),
    /**
     * Oculta el índice «En esta sección» que `[...ruta].astro` genera con las
     * páginas hijas. Para páginas que ya listan a sus hijas con un componente
     * propio.
     */
    ocultarHijas: z.boolean().default(false),
  }),
});

/**
 * Noticias de la Oficina Técnica y del mundo comunitario.
 *
 * Un directorio por noticia: `<slug>/index.md` más sus imágenes al lado.
 * Colocar las imágenes junto al texto permite referenciarlas en el cuerpo como
 * `![alt](./foto.webp)`: Astro las procesa con su pipeline de assets (WebP,
 * `srcset`, dimensiones reales) en vez de servirlas crudas desde `public/`.
 *
 * El acceso pasa siempre por `src/lib/news.ts`, que es el contrato con el
 * maquetado.
 */
const noticias = defineCollection({
  loader: glob({ pattern: '*/index.md', base: './src/content/noticias' }),
  schema: ({ image }) => z.object({
    titulo: z.string(),
    resumen: z.string(),
    /** `coerce` valida que sea una fecha real, no sólo una cadena con forma de tal. */
    fecha: z.coerce.date(),
    categoria: z.string(),
    /**
     * Imagen de cabecera: el archivo `portada.*` del directorio de la noticia.
     * `image()` y no `z.string()`: Astro valida que el archivo exista, lo
     * optimiza y expone su ancho y alto reales.
     */
    imagen: image().optional(),
    /**
     * Texto alternativo de la portada (WCAG 1.1.1). Sin él la imagen se marca
     * como decorativa (`alt=""`), que es lo correcto cuando no hay
     * descripción: inventarla es peor que omitirla.
     */
    imagenAlt: z.string().optional(),
    /**
     * Noticia en preparación: no se publica. Mismo contrato que en `paginas`,
     * sin cascada. Se filtra en `obtenerTodas()` (`src/lib/news.ts`).
     */
    borrador: z.boolean().default(false),
    destacada: z.boolean().default(false),
  }),
});

export const collections = { paginas, noticias };
