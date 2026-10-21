/**
 * Arquitectura de navegación.
 *
 * Seis bloques de primer nivel: Inicio (el logo), Quiénes Somos, Comunidades
 * Agrícolas, Documentación, Galerías y Contacto. Sólo Documentación tiene
 * subniveles y abre panel en el Mega Menú; el resto se enlaza directo.
 *
 * **Este archivo no decide qué se publica.** Un enlace sólo se dibuja si su
 * página existe: `src/lib/publicacion.ts` poda esta estructura contra la
 * colección de contenido antes de que la vean el Mega Menú, el menú móvil y el
 * pie. Añadir un enlace a una página que todavía no existe no rompe el sitio:
 * simplemente no aparece hasta que exista.
 */

export interface EnlaceNav {
  titulo: string;
  href: string;
  /** Micro-descripción mostrada bajo el título en el Mega Menú. */
  descripcion?: string;
  /** Nombre del ícono de lucide-react; el Mega Menú lo resuelve. */
  icono?: string;
  /** Marca enlaces que salen del sitio. */
  externo?: boolean;
  /** Apagado en el menú por decisión editorial (la página puede existir). */
  inactivo?: boolean;
  /** Subniveles, para los bloques que bajan más de dos escalones. */
  hijos?: EnlaceNav[];
}

export interface ColumnaNav {
  titulo: string;
  /** La columna tiene página propia: su rótulo se dibuja como enlace. */
  href?: string;
  enlaces: EnlaceNav[];
}

export interface SeccionNav {
  id: string;
  titulo: string;
  /** Etiqueta abreviada para la barra superior. */
  tituloCorto: string;
  href: string;
  columnas: ColumnaNav[];
}

export const navegacion: SeccionNav[] = [
  {
    id: 'quienes-somos',
    titulo: 'Quiénes Somos',
    tituloCorto: 'Quiénes Somos',
    href: '/quienes-somos',
    columnas: [],
  },
  {
    id: 'comunidades-agricolas',
    titulo: 'Comunidades Agrícolas',
    tituloCorto: 'Comunidades',
    href: '/comunidades-agricolas',
    columnas: [
      {
        titulo: 'Comunidades por región',
        enlaces: [
          {
            titulo: 'Región de Atacama',
            href: '/comunidades-agricolas/region-de-atacama',
            descripcion: 'Las comunidades de las provincias de Copiapó y del Huasco',
            icono: 'Mountain',
          },
          {
            titulo: 'Región de Coquimbo',
            href: '/comunidades-agricolas/region-de-coquimbo',
            descripcion: '177 comunidades en las provincias de Elqui, Limarí y Choapa',
            icono: 'Map',
          },
        ],
      },
    ],
  },
  {
    id: 'documentacion',
    titulo: 'Documentación',
    tituloCorto: 'Documentación',
    href: '/documentacion',
    columnas: [
      {
        titulo: 'Trámites',
        enlaces: [
          {
            titulo: 'Adjudicaciones',
            href: '/documentacion/adjudicaciones',
            descripcion: 'Documentación requerida según parentesco con el comunero fallecido',
            icono: 'FileText',
          },
        ],
      },
      {
        titulo: 'Normativa y estudios',
        enlaces: [
          {
            titulo: 'Ley de Comunidades Agrícolas',
            href: '/documentacion/ley-de-comunidades-agricolas',
            descripcion: 'Decreto con Fuerza de Ley N°5 de 1968',
            icono: 'Scale',
          },
          {
            titulo: 'Estudios',
            href: '/documentacion/estudios',
            descripcion: 'Investigaciones sobre las Comunidades Agrícolas',
            icono: 'BookOpen',
          },
        ],
      },
    ],
  },
  {
    id: 'noticias',
    titulo: 'Noticias',
    tituloCorto: 'Noticias',
    href: '/noticias',
    columnas: [],
  },
  {
    id: 'galerias',
    titulo: 'Galerías',
    tituloCorto: 'Galerías',
    href: '/galerias',
    columnas: [],
  },
  {
    id: 'contacto',
    titulo: 'Contacto',
    tituloCorto: 'Contacto',
    href: '/contacto',
    columnas: [],
  },
];

/** Accesos rápidos de la franja inferior del Mega Menú. */
export const accesosRapidos: EnlaceNav[] = [
  { titulo: 'Contacto', href: '/contacto', icono: 'LifeBuoy' },
  {
    titulo: 'Ley de Comunidades Agrícolas',
    href: '/documentacion/ley-de-comunidades-agricolas',
    icono: 'Scale',
  },
  {
    titulo: 'Ministerio de Bienes Nacionales',
    href: 'https://www.bienesnacionales.cl',
    icono: 'Globe',
    externo: true,
  },
];
