# Comunidades Agrícolas de Chile

Sitio web de las Comunidades Agrícolas de Chile, reguladas por el D.F.L. N°5
de 1968 (Ley de Comunidades Agrícolas). Publica la información institucional
de la Oficina Técnica de Comunidades Agrícolas del Ministerio de Bienes
Nacionales: quiénes somos, los listados de comunidades por región, la
documentación de trámites, la normativa, noticias y galerías.

Derivado de la arquitectura del portal IDE Chile (`sitio-web-ide-chile`):
mismo stack, mismo sistema de accesibilidad y misma filosofía de publicación.

## Stack

- **[Astro 5](https://astro.build)** — generación 100% estática
  (`output: 'static'`): en producción no hay servidor, sólo archivos.
- **[Tailwind CSS 4](https://tailwindcss.com)** — vía `@tailwindcss/vite`,
  con los tokens de diseño declarados en `src/styles/global.css`.
- **React 19** — sólo como islas de interactividad (menús, buscador,
  carrusel, widget de accesibilidad). El resto es HTML estático.
- **[Pagefind](https://pagefind.app)** — buscador del sitio; indexa el HTML
  construido al final del build.
- **[morphicons](https://www.morphicons.com)** — animación del icono
  hamburguesa ↔ aspa del menú móvil, sobre los datos de Lucide.
- **Fuentes autoalojadas** (`@fontsource`): Inter, Plus Jakarta Sans y
  OpenDyslexic. Cero peticiones a CDN externos.

Requiere **Node ≥ 20.11**.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm install` | Instala las dependencias |
| `npm run dev` | Servidor de desarrollo en `http://localhost:4321` |
| `npm run build` | Construye el sitio en `dist/` y genera el índice de Pagefind |
| `npm run preview` | Sirve `dist/` en el puerto 4322 |
| `npm run check` | Verificación de tipos (`astro check`) |

**El buscador en desarrollo** sirve el índice del **último build** (un
middleware en `astro.config.mjs` lo lee desde `dist/pagefind`). Si el
buscador no devuelve nada en `astro dev`, ejecute `npm run build` una vez.

**Si las islas React mueren** en desarrollo con `Cannot read properties of
null (reading 'useState')` —suele pasar tras instalar una dependencia o
cambiar `astro.config.mjs`—, reinicie el servidor con la caché limpia:
`rm -rf node_modules/.vite && npm run dev`.

## Estructura

```text
├── public/
│   ├── documentos/          # PDFs publicados (ley, estudios, adjudicaciones)
│   └── favicon.svg
├── src/
│   ├── assets/
│   │   ├── hero/            # Fotografías del carrusel de la portada
│   │   └── marca/           # Logos (sitio y Ministerio), en dos variantes
│   ├── components/          # Header, Footer, MegaMenu, MenuMovil, Buscador,
│   │                        # HeroCarousel, VisorPdf, AccessibilityWidget,
│   │                        # NewsCard, MetricCard, PageCard, Paginacion…
│   ├── content/             # Contenido en Markdown (colección `paginas`)
│   │   ├── quienes-somos.md
│   │   ├── comunidades-agricolas.md
│   │   ├── comunidades-agricolas/   # Listados por región
│   │   ├── documentacion.md
│   │   ├── documentacion/           # Adjudicaciones, ley, estudios
│   │   └── noticias/                # Colección `noticias`: <slug>/index.md
│   ├── data/
│   │   ├── navigation.ts    # Arquitectura de navegación (menús y pie)
│   │   └── carousel.ts      # Diapositivas del Hero de la portada
│   ├── layouts/BaseLayout.astro
│   ├── lib/
│   │   ├── publicacion.ts   # Interruptor de publicación (borradores, SITIO_PUBLICO)
│   │   ├── seguridad.ts     # Política CSP del sitio
│   │   ├── news.ts          # Capa de acceso a noticias
│   │   ├── carousel.ts      # Optimización de imágenes del Hero
│   │   ├── degradado.ts     # Degradados de respaldo para tarjetas sin foto
│   │   └── extracto.ts      # Extractos seguros del buscador
│   ├── pages/
│   │   ├── index.astro          # Portada (carrusel + cifras + noticias)
│   │   ├── [...ruta].astro      # Renderizador genérico del contenido
│   │   ├── noticias/            # Listado, artículo y paginación
│   │   ├── buscar.astro, contacto.astro, galerias.astro, 404.astro
│   │   └── robots.txt.ts        # Generado según SITIO_PUBLICO
│   └── styles/global.css    # Tokens de diseño, prosa, ganchos del widget A11y
└── astro.config.mjs
```

## Cómo se edita el contenido

### Páginas institucionales

Cada archivo Markdown de `src/content/` se publica en la ruta que indica su
ubicación: `documentacion/adjudicaciones.md` sale en
`/documentacion/adjudicaciones`, sin declarar nada más. El *frontmatter*
mínimo:

```yaml
---
titulo: Adjudicaciones
descripcion: Una frase que aparece bajo el título y en los buscadores.
seccion: documentacion        # quienes-somos | comunidades-agricolas | documentacion
eyebrow: Trámites             # etiqueta superior, opcional
orden: 1                      # posición en los índices de su sección
borrador: false               # true = la página no se publica
---
```

El renderizador (`src/pages/[...ruta].astro`) arma solo las migas de pan,
los listados «En esta sección» y «Al mismo nivel», y el índice «En esta
página» cuando el texto tiene 5 o más secciones `##`.

### Noticias

Un directorio por noticia en `src/content/noticias/`: `<slug>/index.md` con
sus imágenes al lado. La portada se declara como `imagen: ./portada.jpg` en
el *frontmatter* y Astro la optimiza (WebP, `srcset`, dimensiones reales).
Sin portada, la tarjeta usa un degradado de marca. `destacada: true` la
lleva a la portada del sitio.

### Documentos (PDF)

Los PDF viven en `public/documentos/` y se enlazan desde el Markdown con
ruta absoluta (`/documentos/estudios/...pdf`). Todo enlace a un PDF del
sitio se abre automáticamente en un **visor modal** con botón de descarga
(`VisorPdf.astro`); sin JavaScript el enlace navega al archivo, como
siempre.

Pendientes de depositar: los cuatro PDF de adjudicaciones
(`public/documentos/adjudicaciones/`) y el estudio «Tenencia Ancestral y
Vecinos Modernos» — sus enlaces existen y devolverán 404 hasta entonces.

### Carrusel de la portada

Las diapositivas se declaran en `src/data/carousel.ts` (texto, CTA e imagen
importada desde `src/assets/hero/`). Una diapositiva cuyo destino interno
está apagado se retira sola del carrusel.

### Navegación

La estructura de menús vive en `src/data/navigation.ts`, pero **ese archivo
no decide qué se publica**: `src/lib/publicacion.ts` poda los enlaces contra
el contenido existente antes de que los vean el Mega Menú, el menú móvil y
el pie. Añadir un enlace a una página que aún no existe no rompe nada:
simplemente no aparece hasta que exista.

## Publicación

Dos interruptores, en `src/lib/publicacion.ts`:

- **`borrador: true`** en el *frontmatter* apaga una página: fuera del menú,
  del pie, del buscador, del sitemap, y su URL devuelve 404. El apagado
  arrastra a las páginas hijas. En `astro dev` sí se ve, con un distintivo.
  Para construir una vista previa con borradores:
  `PUBLICAR_BORRADORES=true npm run build`.
- **`SITIO_PUBLICO`**: mientras no sea `true`, cada página sale con
  `noindex, nofollow` y `robots.txt` bloquea el rastreo entero. Es el estado
  correcto para servidores de revisión. **El día del lanzamiento** hay que
  construir con `SITIO_PUBLICO=true` (el build lo recuerda con un aviso al
  final del log).

Variables de entorno (todas opcionales):

| Variable | Efecto |
| --- | --- |
| `SITIO_PUBLICO=true` | Sitio indexable por buscadores |
| `PUBLICAR_BORRADORES=true` | El build incluye las páginas en borrador |
| `PUBLIC_SITE_URL` | URL canónica (por defecto `https://www.comunidadesagricolas.cl`) |
| `PUBLIC_GA_ID` | Activa Google Analytics 4 y ajusta la CSP en consecuencia |

## Diseño y accesibilidad

- **Paleta** (tokens en `global.css`): azul institucional `comunidad-*` (el
  mismo del portal IDE Chile), ámbar de acento `cosecha-*` y tierra
  `tierra-*` para apoyos cálidos. Tipografía: Inter (cuerpo) y Plus Jakarta
  Sans (titulares).
- **Widget de accesibilidad** (botón flotante): tema claro / oscuro / alto
  contraste, escala de texto, fuente para dislexia, espaciado ampliado,
  reducción de animaciones y destacado de enlaces. Las preferencias se
  guardan en `localStorage['ccaa-a11y']` y se aplican antes del primer
  pintado (sin parpadeo).
- **WCAG 2.1 AA**: foco visible consistente, objetivos táctiles de 24px,
  navegación completa por teclado en menús y carrusel, `inert` en las
  diapositivas ocultas, autoavance pausable que no arranca con movimiento
  reducido.
- **El modo de alto contraste es frágil por diseño**: normaliza todo a
  blanco/negro con `!important`. No use el modificador `!` de Tailwind en
  colores ni fondos — le ganaría a ese bloque y lo rompería.

## Seguridad

La política CSP vive en `src/lib/seguridad.ts` y viaja en un `<meta>` dentro
del HTML: protege el sitio lo aloje quien lo aloje. Base cerrada
(`default-src 'self'`), sin formularios propios (`form-action 'none'`; el
contacto enlaza al formulario SIAC del Ministerio) y `'wasm-unsafe-eval'`
sólo porque Pagefind carga un módulo WebAssembly — si se quita, el buscador
muere sin error visible. `frame-ancestors` y HSTS no caben en un `<meta>`:
deben configurarse como cabeceras en el servidor que aloje el sitio.

## Despliegue

`npm run build` deja en `dist/` un sitio estático completo: puede servirse
desde cualquier hosting de archivos (Nginx, Apache, Cloudflare Pages,
Netlify…). Lista mínima para producción:

1. Construir con `SITIO_PUBLICO=true` (y `PUBLIC_GA_ID` si corresponde).
2. Configurar en el servidor las cabeceras `frame-ancestors` / HSTS.
3. Verificar que el servidor entregue `application/wasm` para `.wasm`
   (Pagefind) — sin ese tipo MIME el buscador no responde.
