/**
 * `robots.txt`, generado según la construcción.
 *
 * Es un endpoint y no un archivo en `public/` porque su contenido depende de si
 * el sitio ya es público: mientras no lo sea, prohíbe el rastreo entero. Un
 * archivo estático obligaría a acordarse de cambiarlo a mano el día del
 * lanzamiento, que es exactamente la clase de paso que se olvida.
 */
import type { APIRoute } from 'astro';
import { SITIO_PUBLICO } from '@/lib/publicacion';

export const GET: APIRoute = ({ site }) => {
  /*
    `Disallow: /` no es una garantía: es una petición. Lo que de verdad
    sostiene el bloqueo es el `noindex, nofollow` que `BaseLayout.astro` pone
    en cada página.
  */
  const cuerpo = SITIO_PUBLICO
    ? ['User-agent: *', 'Allow: /', '', `Sitemap: ${new URL('sitemap-index.xml', site)}`]
    : [
        '# Sitio en preparación: no debe indexarse.',
        '# Se abre poniendo SITIO_PUBLICO=true al construir.',
        'User-agent: *',
        'Disallow: /',
      ];

  return new Response(`${cuerpo.join('\n')}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
