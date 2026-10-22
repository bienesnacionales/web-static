// @ts-check
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

/**
 * Sirve el índice de Pagefind durante `astro dev`.
 *
 * El índice sólo existe en `dist/pagefind`, porque Pagefind recorre el HTML ya
 * construido al final de `npm run build`. El servidor de desarrollo no sirve
 * `dist/`, así que sin esto el buscador no encuentra nada mientras se
 * programa.
 *
 * No basta con copiarlo a `public/`: Vite se niega a que se importe un archivo
 * de esa carpeta y responde 500 al `import()` del componente. Este middleware
 * devuelve los archivos tal cual, antes de que Vite intente tratarlos como
 * módulos del proyecto. `apply: 'serve'` lo deja fuera del build.
 *
 * Lo que se busca en desarrollo es el contenido del **último build**, no lo
 * que haya sin guardar. Para refrescarlo, `npm run build`.
 *
 * @returns {import('vite').Plugin}
 */
function indicePagefindEnDesarrollo() {
  const RAIZ = path.resolve('dist/pagefind');
  /** @type {Record<string, string>} */
  const TIPOS = {
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.wasm': 'application/wasm',
  };

  return {
    name: 'pagefind-en-desarrollo',
    apply: 'serve',
    configureServer(servidor) {
      servidor.middlewares.use('/pagefind', (req, res, siguiente) => {
        const relativa = decodeURIComponent((req.url ?? '/').split('?')[0]);
        const archivo = path.resolve(RAIZ, `.${relativa}`);

        // Guardia de travesía: nada fuera de `dist/pagefind`.
        if (!archivo.startsWith(RAIZ)) return siguiente();
        if (!fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) return siguiente();

        res.setHeader('Content-Type', TIPOS[path.extname(archivo)] ?? 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-store');
        fs.createReadStream(archivo).pipe(res);
      });
    },
  };
}

/**
 * Anuncia al terminar el build si el sitio es indexable.
 *
 * El estado por defecto —bloqueado a los buscadores— es el correcto mientras el
 * sitio no esté en su dominio definitivo, pero es también el que produce el
 * fallo caro si se olvida el día del lanzamiento. Un aviso al final del log es
 * lo que hace que se note.
 *
 * @returns {import('astro').AstroIntegration}
 */
function avisoDeIndexacion() {
  return {
    name: 'aviso-de-indexacion',
    hooks: {
      'astro:build:done': ({ logger }) => {
        if (process.env.SITIO_PUBLICO === 'true') {
          logger.info('Sitio PÚBLICO: indexable por buscadores.');
        } else {
          logger.warn(
            'Sitio NO PÚBLICO: noindex en todas las páginas y robots.txt cerrado. ' +
              'Para el lanzamiento, construya con SITIO_PUBLICO=true.',
          );
        }
      },
    },
  };
}

/**
 * Sitio en mantención: toda URL lleva a la portada.
 *
 * Se activa construyendo con `MODO_MANTENCION=true`. Entonces la portada es la
 * de mantención (`src/pages/index.astro` lee la misma variable) y, al
 * terminar el build, cada página HTML salvo la portada se reemplaza por una
 * redirección a `/`. Incluye `404.html`, que es
 * lo que el hosting sirve para las URL que no existen, así que también ésas
 * terminan en la portada. Los archivos del contenido (`uploads`: imágenes, PDF,
 * planillas) y los índices de `datos` se quitan del build: un archivo no puede
 * redirigir, y dejarlo sería dejar el contenido accesible por enlace directo.
 *
 * Se hace aquí y no con reglas del servidor porque el sitio puede alojarse en
 * cualquier hosting de archivos: así funciona en todos sin configurar nada.
 * Las redirecciones no corren en `astro dev`: con la variable puesta sólo
 * cambia la portada, y el resto del sitio se puede seguir trabajando.
 *
 * Se lee aquí y no se importa de `src/lib/publicacion.ts`, igual que
 * `SITIO_PUBLICO`: la configuración se carga antes que el código del sitio.
 */
const MODO_MANTENCION = process.env.MODO_MANTENCION === 'true';

/*
  `location.replace` además del `refresh`: no deja la URL vieja en el
  historial, así que «Atrás» no devuelve a una página que vuelve a redirigir.
  El `refresh` cubre a quien navegue sin JavaScript.
*/
const REDIRECCION_A_PORTADA = `<!doctype html>
<html lang="es-CL">
  <head>
    <meta charset="utf-8" />
    <meta name="robots" content="noindex" />
    <meta http-equiv="refresh" content="0; url=/" />
    <title>Sitio en Mantención — Ministerio de Bienes Nacionales</title>
    <script>location.replace('/');</script>
  </head>
  <body>
    <a href="/">Ir al inicio</a>
  </body>
</html>
`;

/**
 * Aplica `MODO_MANTENCION` sobre el build terminado.
 *
 * @returns {import('astro').AstroIntegration}
 */
function modoMantencion() {
  return {
    name: 'modo-mantencion',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        if (!MODO_MANTENCION) return;
        const raiz = fileURLToPath(dir);

        for (const carpeta of ['uploads', 'datos', 'documentos']) {
          fs.rmSync(path.join(raiz, carpeta), { recursive: true, force: true });
        }

        const paginas = fs
          .readdirSync(raiz, { recursive: true, encoding: 'utf8' })
          .filter((relativa) => relativa.endsWith('.html') && relativa !== 'index.html');
        for (const relativa of paginas) {
          fs.writeFileSync(path.join(raiz, relativa), REDIRECCION_A_PORTADA);
        }

        logger.warn(
          `Sitio EN MANTENCIÓN: ${paginas.length} páginas redirigen a la portada. ` +
            'Para salir, construya sin MODO_MANTENCION=true.',
        );
      },
    },
  };
}

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL ?? 'https://www.bienesnacionales.cl',

  // SSG puro: sin servidor en producción.
  output: 'static',

  integrations: [sitemap(), avisoDeIndexacion(), modoMantencion()],

  build: {
    format: 'directory',
  },

  vite: {
    plugins: [indicePagefindEnDesarrollo()],
    server: {
      host: true,
      port: 4321,
    },
  },
});
