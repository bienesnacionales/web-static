/**
 * Diapositivas del carrusel de la Home.
 *
 * Las imágenes se importan para que Astro las procese con su pipeline de
 * assets (WebP + `srcset`) en vez de servirlas crudas desde `public/`. La
 * primera diapositiva es el elemento LCP de la portada, así que servirla sin
 * optimizar sale caro. Una importación que no resuelve rompe el build, que es
 * mejor que una ruta rota que sólo se nota mirando la página.
 *
 * Fotografías entregadas por la contraparte (valle de Elqui, desierto de
 * Atacama y San Pedro de Atacama). El archivo `elqui-3.webp` recibido era
 * idéntico byte a byte a `ELQUI-2.webp`, así que son cinco diapositivas y no
 * seis.
 */
import valleElquiPanoramica from '@/assets/hero/valle-elqui-panoramica.webp';
import valleElquiCamino from '@/assets/hero/valle-elqui-camino.webp';
import elquiVinasOtono from '@/assets/hero/elqui-vinas-otono.webp';
import atacamaAtardecer from '@/assets/hero/atacama-atardecer.webp';
import sanPedroCabalgata from '@/assets/hero/san-pedro-cabalgata.webp';

export interface DiapositivaBruta {
  id: string;
  eyebrow: string;
  titulo: string;
  /** Idioma del titular cuando no es el de la página (WCAG 3.1.2, nivel AA). */
  tituloIdioma?: string;
  descripcion: string;
  cta: { texto: string; href: string; externo: boolean };
  imagen: ImageMetadata;
  /**
   * La imagen va detrás de un velo, tras el titular: acompaña, no informa, y
   * por eso se dibuja con `alt=""`. Este texto no llega al maquetado; queda
   * como registro editorial de qué muestra cada archivo.
   */
  imagenAlt: string;
}

export const diapositivas: DiapositivaBruta[] = [
  {
    id: 'comunidades',
    eyebrow: 'Ministerio de Bienes Nacionales',
    titulo: 'Comunidades Agrícolas de Chile',
    descripcion:
      'El mundo campesino organizado en comunidad: 187 comunidades administran colectivamente sus terrenos comunes bajo el D.F.L. N°5 de 1968.',
    cta: { texto: 'Conozca las comunidades', href: '/comunidades-agricolas', externo: false },
    imagen: valleElquiPanoramica,
    imagenAlt:
      'Vista panorámica del valle de Elqui: cultivos verdes en el fondo del valle entre cerros áridos',
  },
  {
    id: 'region-coquimbo',
    eyebrow: 'Región de Coquimbo',
    titulo: '177 comunidades entre Elqui, Limarí y Choapa',
    descripcion:
      'Cerca del 25% de la propiedad rural de la región es de dominio comunitario. Consulte el listado por comuna, con comuneros y superficie.',
    cta: {
      texto: 'Ver listado por comuna',
      href: '/comunidades-agricolas/region-de-coquimbo',
      externo: false,
    },
    imagen: valleElquiCamino,
    imagenAlt:
      'Valle de Elqui con la ruta serpenteando junto a parcelas cultivadas entre montañas áridas',
  },
  {
    id: 'adjudicaciones',
    eyebrow: 'Documentación y trámites',
    titulo: 'Trámite de adjudicaciones',
    descripcion:
      'Revise la documentación requerida según la relación de parentesco con el comunero fallecido y el formato de la declaración jurada.',
    cta: { texto: 'Ver documentación', href: '/documentacion/adjudicaciones', externo: false },
    imagen: elquiVinasOtono,
    imagenAlt:
      'Viñas en tonos de otoño en el valle de Elqui, con la cordillera nevada al fondo',
  },
  {
    id: 'ley',
    eyebrow: 'Normativa',
    titulo: 'Ley de Comunidades Agrícolas',
    descripcion:
      'El D.F.L. N°5 de 1968, modificado por la Ley N°19.233, regula la constitución, organización y funcionamiento de las comunidades.',
    cta: {
      texto: 'Leer la ley',
      href: '/documentacion/ley-de-comunidades-agricolas',
      externo: false,
    },
    imagen: atacamaAtardecer,
    imagenAlt: 'Atardecer de nubes rojas y doradas sobre el desierto de Atacama',
  },
  {
    id: 'oficina-tecnica',
    eyebrow: 'Oficina Técnica de Comunidades Agrícolas',
    titulo: 'Asesoría para comuneros y dirigentes',
    descripcion:
      'El Ministerio de Bienes Nacionales acompaña la gestión colectiva de las comunidades y la defensa de sus terrenos y bienes comunes.',
    cta: { texto: 'Contáctenos', href: '/contacto', externo: false },
    imagen: sanPedroCabalgata,
    imagenAlt:
      'Jinetes a caballo por un camino rural cerca de San Pedro de Atacama, con volcanes nevados al fondo',
  },
];
