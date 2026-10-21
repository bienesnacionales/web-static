// @ts-check
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

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

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL ?? 'https://www.comunidadesagricolas.cl',

  // SSG puro: sin servidor en producción.
  output: 'static',

  integrations: [react(), sitemap(), avisoDeIndexacion()],

  build: {
    format: 'directory',
  },

  vite: {
    plugins: [tailwindcss(), indicePagefindEnDesarrollo()],
    server: {
      host: true,
      port: 4321,
    },
  },
});
