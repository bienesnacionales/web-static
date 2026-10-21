/**
 * El extracto del buscador, convertido en datos en vez de en HTML.
 *
 * Pagefind devuelve cada extracto como una cadena de HTML con los términos
 * hallados envueltos en `<mark>`. La forma evidente de pintarlo es
 * `dangerouslySetInnerHTML`, y así estuvo: era el único punto de todo el sitio
 * donde una cadena se convertía en HTML vivo.
 *
 * Hoy eso es inofensivo —el extracto sale de nuestro propio contenido ya
 * construido, y no hay una sola etiqueta HTML cruda en `src/content/`— pero la
 * seguridad de ese punto no depende del código: depende de que nadie, dentro de
 * dos años, pegue en un Markdown un fragmento copiado de otro sitio. Es una
 * garantía que hay que recordar mantener, y ésas se rompen solas.
 *
 * Así que el extracto se parte aquí en trozos de texto plano y trozos
 * resaltados, y el componente los pinta como nodos de React: el texto sale como
 * texto y el resaltado como un `<mark>` de verdad. Lo que Pagefind haya metido
 * en la cadena deja de ser HTML antes de llegar al DOM, y la regla «nada de HTML
 * crudo en el contenido» pasa de ser una precaución a ser redundante.
 *
 * Sin dependencias nuevas: un sanitizador para reconocer una sola etiqueta sería
 * traer 20 KB y una superficie de actualización para lo que hacen dos líneas.
 */

export interface TrozoExtracto {
  texto: string;
  /** ¿Es uno de los términos buscados? Se pinta dentro de un `<mark>`. */
  resaltado: boolean;
}

/**
 * Entidades HTML que Pagefind puede haber escapado dentro del extracto.
 *
 * Hay que deshacerlas o el visitante lee «Política &amp; Estándares» tal cual,
 * con el `&amp;` a la vista. Decodificar suele ser el paso peligroso de este
 * tipo de función —es donde un `&lt;script&gt;` vuelve a ser un `<script>`—,
 * pero aquí no lo es: el resultado se entrega como cadena a React, que lo pinta
 * como nodo de texto y lo vuelve a escapar al insertarlo. Nada de lo que salga
 * de aquí puede convertirse en un elemento.
 *
 * Se resuelve con una tabla y no con el truco del `textarea` porque este módulo
 * también se evalúa al construir, donde no hay `document`.
 */
const ENTIDADES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodificar(texto: string): string {
  return texto.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entera, cuerpo: string) => {
    if (cuerpo[0] === '#') {
      const codigo =
        cuerpo[1] === 'x' || cuerpo[1] === 'X'
          ? parseInt(cuerpo.slice(2), 16)
          : parseInt(cuerpo.slice(1), 10);
      // Fuera del rango Unicode válido `fromCodePoint` lanza; ante una entidad
      // absurda es mejor dejarla escrita que tumbar el buscador entero.
      return Number.isFinite(codigo) && codigo > 0 && codigo <= 0x10ffff
        ? String.fromCodePoint(codigo)
        : entera;
    }
    return ENTIDADES[cuerpo.toLowerCase()] ?? entera;
  });
}

/**
 * Parte el extracto de Pagefind en trozos alternos de texto y resaltado.
 *
 * `split` con un grupo de captura intercala lo capturado entre los fragmentos:
 * las posiciones pares son texto normal y las impares, el término hallado. Se
 * captura con `[\s\S]` y no con `.` porque un extracto puede cruzar un salto de
 * línea si el párrafo indexado lo tenía.
 *
 * Los trozos vacíos se descartan: aparecen siempre que un `<mark>` abre o cierra
 * pegado al borde del extracto, y sin quitarlos React pinta `<mark></mark>`
 * sueltos que el CSS colorea igual.
 */
export function trozosDelExtracto(extracto: string): TrozoExtracto[] {
  return extracto
    .split(/<mark>([\s\S]*?)<\/mark>/)
    .map((parte, i) => ({ texto: decodificar(parte), resaltado: i % 2 === 1 }))
    .filter((trozo) => trozo.texto !== '');
}
