/**
 * Preparación de las diapositivas del Hero.
 *
 * Este módulo se ejecuta **sólo en el servidor** (frontmatter de Astro).
 *
 * `HeroCarousel` es una isla de React, así que no puede usar el componente
 * `<Image>` de Astro. Se resuelve aquí con `getImage()`: se generan las
 * variantes WebP en el build y a la isla le llegan `src` y `srcset` ya
 * calculados, como cadenas.
 */
import { getImage } from 'astro:assets';
import { getCollection } from 'astro:content';
import { diapositivas as datos } from '@/data/carousel';
import { paginasPublicadas, rutasPublicadas } from '@/lib/publicacion';

/**
 * Anchos a generar. 2040 es el ancho de los originales; pedir más sólo
 * produciría una variante ampliada, que pesa sin añadir detalle.
 */
const ANCHOS = [640, 960, 1280, 1920, 2040];

/**
 * La diapositiva va a sangre: ocupa el ancho completo de la ventana en
 * cualquier tamaño de pantalla.
 */
const SIZES = '100vw';

/**
 * Ancho de la ventana de previsualización: entre el 9 % y el 13 % del ancho de
 * la ventana según el tamaño de pantalla. Se declara aparte para que el
 * navegador elija ahí la variante pequeña y no vuelva a descargar la grande.
 */
const SIZES_VENTANA = '15vw';

export interface Diapositiva {
  id: string;
  eyebrow: string;
  titulo: string;
  /** Idioma del titular si no es el de la página (WCAG 3.1.2). */
  tituloIdioma?: string;
  descripcion: string;
  cta: { texto: string; href: string; externo: boolean };
  imagen: { src: string; srcset: string; sizes: string; sizesVentana: string };
}

export async function obtenerDiapositivas(): Promise<Diapositiva[]> {
  /*
    Una diapositiva cuyo destino está apagado se retira entera, no sólo su
    botón: el Hero es una llamada a la acción y sin acción no dice nada. Los
    destinos externos no dependen de lo que construyamos y salen siempre.
  */
  const rutas = rutasPublicadas(paginasPublicadas(await getCollection('paginas')));
  const vigentes = datos.filter((d) => d.cta.externo || rutas.has(d.cta.href));

  return Promise.all(
    vigentes.map(async ({ imagen, imagenAlt: _imagenAlt, ...resto }) => {
      const optimizada = await getImage({
        src: imagen,
        widths: ANCHOS,
        sizes: SIZES,
        format: 'webp',
        /*
          Calidad por debajo de la que usa Astro por defecto (80): esta imagen
          se dibuja detrás de un velo oscuro que la tapa entre un 55% y un 95%
          según la zona, con el titular encima. El detalle fino no llega a
          verse, así que los bytes que cuesta conservarlo se gastan en nada.
        */
        quality: 62,
      });

      return {
        ...resto,
        imagen: {
          src: optimizada.src,
          srcset: optimizada.srcSet.attribute,
          sizes: SIZES,
          sizesVentana: SIZES_VENTANA,
        },
      };
    }),
  );
}
