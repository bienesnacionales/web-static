/**
 * Marcas de Pagefind sobre el `<main>` original de una página.
 *
 * Qué entra al índice de la búsqueda del sitio y con qué datos sale cada
 * resultado (la etiqueta Noticia, Trámite o Página y el extracto).
 */

/*
  Bloques que se repiten en muchas páginas y no son su contenido: las migas, los
  botones de compartir y las noticias relacionadas. Indexarlos hace que una
  noticia aparezca al buscar el título de otra.
*/
const FUERA_DEL_INDICE = /class="((?:mbn-breadcrumbs|mbn-share|mbn-single__aside|mbn-news-list)(?:\s[^"]*)?)"/g;

function escapa(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Devuelve el HTML de la página listo para Pagefind.
 *
 * El extracto va como contenido de un elemento y no dentro del atributo
 * `data-pagefind-meta`: ahí las comas separan metadatos y lo partirían.
 */
export function paraIndice(html: string, tipo: string, resumen: string): string {
  return html
    .replace(
      /<main id="primary"([^>]*)>/,
      `<main data-pagefind-body data-pagefind-meta="tipo:${tipo}" id="primary"$1>` +
        `<span hidden data-pagefind-meta="resumen">${escapa(resumen)}</span>`,
    )
    .replace(FUERA_DEL_INDICE, 'data-pagefind-ignore class="$1"');
}
