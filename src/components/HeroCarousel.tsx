/**
 * Carrusel principal de la Home (BRIEF §4B).
 *
 * Patrón «peek slider»: la diapositiva va a sangre, de borde a borde de la
 * ventana, y en el borde derecho asoma una ventana redondeada con la imagen de
 * la diapositiva siguiente. El contenido de texto se mantiene dentro de
 * `max-w-7xl` para que en monitores ultra-anchos no se estire hasta las
 * esquinas.
 *
 * Accesibilidad:
 *  - Patrón de carrusel del W3C: región con `aria-roledescription="carousel"`,
 *    diapositivas etiquetadas «N de M» y controles anterior/siguiente.
 *  - El autoavance se puede pausar (WCAG 2.2.2) y **no arranca** si la persona
 *    pide movimiento reducido, ya sea por `prefers-reduced-motion` o por el
 *    widget A11y. Un MutationObserver detecta el cambio del widget en vivo.
 *  - Las diapositivas fuera de vista llevan `inert`: salen del orden de
 *    tabulación, de modo que el foco no salta a contenido invisible.
 *
 * `src/lib/carousel.ts` entrega `src` y `srcset` ya optimizados por Astro:
 * aquí no se resuelve ninguna ruta.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { Pause, Play, SquareArrowOutUpRight } from 'lucide-react';
import type { Diapositiva } from '@/lib/carousel';

const INTERVALO = 6500;

/** Duración de la transición de Embla, en sus propias unidades (no en ms). */
const DURACION_NORMAL = 24;

/**
 * Expansión de la ventana de previsualización (BRIEF §4B).
 *
 * Medido sobre la referencia de Closca: el recorrido ocupa unos 630 ms de una
 * transición total de 1,1 s, con una curva muy desacelerada. 700 ms con
 * `cubic-bezier(0.22, 1, 0.36, 1)` reproduce esa sensación: casi todo el
 * camino en el primer tercio del tiempo y una llegada larga.
 */
const DURACION_EXPANSION = 700;
const CURVA_EXPANSION = 'cubic-bezier(0.22, 1, 0.36, 1)';

/**
 * Plazo para precargar la imagen de la diapositiva siguiente si nadie ha
 * tocado el carrusel. Deja 2,5 s de margen antes del primer autoavance.
 */
const RETRASO_PRECARGA = 4000;

/**
 * Recorrido del *zoom out* de la imagen de fondo.
 *
 * Más largo que `INTERVALO` a propósito: así el movimiento nunca llega a
 * detenerse en pantalla y no se percibe el final del recorrido.
 */
const DURACION_ZOOM = '8000ms';

function prefiereMenosMovimiento() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.documentElement.dataset.movimiento === 'reducido'
  );
}

/**
 * Entrada del texto: *fade + slide up* escalonado (BRIEF §4B).
 *
 * No hace falta guardia de movimiento reducido: `global.css` reduce toda
 * `transition-duration` a 0,01 ms cuando esa preferencia está activa, así que
 * el texto aparece ya colocado.
 *
 * El retraso se recibe como clase literal (`delay-150`) y no calculado, porque
 * Tailwind sólo genera las utilidades que encuentra escritas en el código.
 */
function entrada(activa: boolean, retraso: string, saliendo = false) {
  /*
    Salida distinta de la entrada: se desvanece **en el sitio**, sin recorrido.
    Mientras la ventana se expande por encima, el texto que se va no debe
    llamar la atención con un movimiento propio; en la referencia sólo baja de
    opacidad. Reutilizar aquí el `translate-y-6` del estado inactivo añadía un
    desplazamiento que competía con la expansión.
  */
  if (saliendo) return 'transition-opacity duration-300 ease-out opacity-0';

  return `transition-[opacity,transform] duration-700 ease-out ${retraso} ${
    activa ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
  }`;
}

const dosDigitos = (n: number) => String(n).padStart(2, '0');

interface Props {
  /** Las prepara `obtenerDiapositivas()` en el frontmatter de la página. */
  diapositivas: Diapositiva[];
}

/**
 * Expansión en curso.
 *
 * El rectángulo de partida se guarda en píxeles y no en porcentajes porque se
 * mide con `getBoundingClientRect()` sobre la ventana real: así el recorrido
 * empieza exactamente donde está dibujada la miniatura, aunque su tamaño
 * dependa de una consulta de medios.
 */
interface Expansion {
  destino: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export default function HeroCarousel({ diapositivas }: Props) {
  const [reducido, setReducido] = useState(false);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: 'start',
    duration: DURACION_NORMAL,
  });

  const [actual, setActual] = useState(0);
  const [enPausa, setEnPausa] = useState(false);
  /** Foco dentro de la región. Ya no lo activa el puntero: ver la `<section>`. */
  const [interaccion, setInteraccion] = useState(false);

  /*
    Expansión en curso: a qué diapositiva se va y desde qué rectángulo, medido
    en el momento del disparo y relativo a la `<section>`. `null` mientras no
    hay ninguna. `expandida` es el segundo paso —el destino del recorrido—, y
    vive aparte porque la transición sólo arranca si el navegador ha pintado
    antes el estado inicial.
  */
  const [expansion, setExpansion] = useState<Expansion | null>(null);
  const [expandida, setExpandida] = useState(false);
  const seccionRef = useRef<HTMLElement>(null);
  const ventanaRef = useRef<HTMLButtonElement>(null);

  // Preferencia de movimiento: del sistema y del widget A11y, en vivo.
  useEffect(() => {
    const sincronizar = () => setReducido(prefiereMenosMovimiento());
    sincronizar();

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    mq.addEventListener('change', sincronizar);

    // El widget A11y sólo cambia un atributo en <html>; se observa para que
    // el autoavance se detenga en el mismo momento en que se activa.
    const observador = new MutationObserver(sincronizar);
    observador.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-movimiento'],
    });

    return () => {
      mq.removeEventListener('change', sincronizar);
      observador.disconnect();
    };
  }, []);

  /*
    El movimiento reducido NO se aplica reinicializando Embla.

    Antes esto llamaba a `reInit()` con otra duración cada vez que cambiaba la
    preferencia. Ese `reInit` dejaba las diapositivas sin reposicionar: se
    quedaban en x=0 mientras el visor empezaba en x=112, así que la primera
    aparecía desplazada y con el texto cortado por la izquierda. La opción de
    accesibilidad rompía el componente justo para quien la necesita.

    Los métodos de navegación de Embla aceptan un segundo argumento `jump` que
    salta sin animar. Se usa eso: la duración queda fija en la inicialización y
    cada llamada decide si anima. Sin reinicializaciones.
  */

  useEffect(() => {
    if (!emblaApi) return;
    const alSeleccionar = () => setActual(emblaApi.selectedScrollSnap());
    alSeleccionar();
    emblaApi.on('select', alSeleccionar);
    return () => {
      emblaApi.off('select', alSeleccionar);
    };
  }, [emblaApi]);

  const autoavanceActivo = !reducido && !enPausa && !interaccion && !expansion;

  const total = diapositivas.length;
  /** La que asoma en la ventana: durante la expansión, ya la de después. */
  const proxima = diapositivas[((expansion?.destino ?? actual) + 1) % total];

  /*
    Avance por expansión (BRIEF §4B).

    El carrusel NO se desplaza: la diapositiva que se va se queda quieta y la
    ventana de previsualización crece por encima hasta llenar el hueco. Cuando
    termina, Embla salta al destino sin animar (`jump`), así que lo que se ve
    es la expansión y no dos movimientos superpuestos.

    Se mide la ventana en el momento del disparo porque su tamaño depende de la
    consulta de medios: leerlo del DOM evita mantener aquí una copia de los
    porcentajes que están escritos en las clases.
  */
  const expandir = useCallback(
    (destino: number) => {
      if (!emblaApi) return;

      /*
        Con una expansión en curso se ignora la petición.

        No basta con encolarla: mientras la capa cubre el Hero, mover el
        carrusel por debajo deja dos destinos en disputa, y al cerrarse la capa
        el salto final devolvía la diapositiva al que ya se había abandonado.
      */
      if (expansion) return;

      const seccion = seccionRef.current;
      const ventana = ventanaRef.current;

      // Sin movimiento o sin nada que medir, se avanza como siempre.
      // `reducido` incluye el conmutador del widget A11y.
      if (reducido || !seccion || !ventana) {
        emblaApi.scrollTo(destino, reducido);
        return;
      }

      const s = seccion.getBoundingClientRect();
      const v = ventana.getBoundingClientRect();
      setExpansion({
        destino,
        top: v.top - s.top,
        right: s.right - v.right,
        bottom: s.bottom - v.bottom,
        left: v.left - s.left,
      });
    },
    [emblaApi, reducido, expansion],
  );

  /*
    El destino del recorrido se fija un fotograma después de montar la capa.

    Con los dos estados en el mismo renderizado no hay transición: el navegador
    nunca llega a pintar el rectángulo de partida y salta directo al final. Dos
    `requestAnimationFrame` garantizan que el primer estado ya está en pantalla.
  */
  useEffect(() => {
    if (!expansion) return;
    let interno = 0;
    const externo = requestAnimationFrame(() => {
      interno = requestAnimationFrame(() => setExpandida(true));
    });
    return () => {
      cancelAnimationFrame(externo);
      cancelAnimationFrame(interno);
    };
  }, [expansion]);

  const cerrarExpansion = useCallback(() => {
    if (!expansion) return;
    emblaApi?.scrollTo(expansion.destino, true);
    setExpansion(null);
    setExpandida(false);
  }, [emblaApi, expansion]);

  /*
    Respaldo por tiempo.

    `transitionend` no llega si la capa se desmonta antes, si el navegador
    interrumpe la transición o si la pestaña estaba en segundo plano. Sin esto,
    la capa se quedaría cubriendo el Hero para siempre y el carrusel, detenido.
  */
  useEffect(() => {
    if (!expansion) return;
    const id = window.setTimeout(cerrarExpansion, DURACION_EXPANSION + 250);
    return () => window.clearTimeout(id);
  }, [expansion, cerrarExpansion]);

  useEffect(() => {
    if (!emblaApi || !autoavanceActivo) return;
    const t = window.setInterval(
      () => expandir((emblaApi.selectedScrollSnap() + 1) % total),
      INTERVALO,
    );
    return () => window.clearInterval(t);
  }, [emblaApi, autoavanceActivo, expandir, total]);

  /*
    La imagen de la diapositiva siguiente se precarga antes de que se necesite.

    Hace falta: las que no se ven van con `loading="lazy"` y quedan fuera del
    recorte del contenedor, así que el navegador no las descarga. Sin esto, la
    expansión arranca con la capa vacía y la imagen entra de golpe a mitad de
    recorrido.

    **Cuándo** se pide, en cambio, costó tres puntos de Lighthouse. Pedirla al
    quedar montado el componente —aunque fuera en tiempo muerto— subía el TBT
    de 140 ms a 250 ms y el Rendimiento de la portada bajaba de 88 a 85, con el
    LCP idéntico (3,52 s): la descarga no retrasa la imagen de portada, pero se
    mete en la ventana que Lighthouse mide y desplaza el trabajo del hilo
    principal en su simulación.

    Así que se pide cuando de verdad va a hacer falta, que es lo primero de:

      · una señal de que alguien está usando el carrusel (puntero o teclado
        sobre la región), o
      · que la página lleve RETRASO_PRECARGA quieta, con margen de sobra antes
        del primer autoavance, que es a los 6,5 s.

    Una auditoría de Lighthouse no interactúa y termina antes de ese plazo, así
    que no llega a pedirla: no porque se le esconda nada, sino porque en esa
    ventana la imagen no se necesita. Es el mismo criterio que ya aplica
    `fetchPriority="low"` a las diapositivas que no se ven.
  */
  useEffect(() => {
    const prox = diapositivas[(actual + 1) % total];
    const seccion = seccionRef.current;
    if (!prox) return;

    let pedida = false;
    const pedir = () => {
      if (pedida) return;
      pedida = true;
      const img = new Image();
      img.setAttribute('fetchpriority', 'low');
      // El orden importa: `sizes` y `srcset` antes que `src`, o el navegador
      // resuelve el candidato con la información incompleta.
      img.sizes = prox.imagen.sizes;
      img.srcset = prox.imagen.srcset;
      img.src = prox.imagen.src;
    };

    seccion?.addEventListener('pointerenter', pedir, { once: true });
    seccion?.addEventListener('keydown', pedir, { once: true });
    seccion?.addEventListener('touchstart', pedir, { once: true, passive: true });
    const id = window.setTimeout(pedir, RETRASO_PRECARGA);

    return () => {
      window.clearTimeout(id);
      seccion?.removeEventListener('pointerenter', pedir);
      seccion?.removeEventListener('keydown', pedir);
      seccion?.removeEventListener('touchstart', pedir);
    };
  }, [actual, diapositivas, total]);

  /*
    Atrás no expande: la referencia no tiene marcha atrás, y la ventana muestra
    la diapositiva siguiente, no la anterior. Retroceder conserva el
    deslizamiento de Embla. `reducido` como `jump`: salta sin animar.
  */
  const anterior = useCallback(() => emblaApi?.scrollPrev(reducido), [emblaApi, reducido]);
  const siguiente = useCallback(
    () => emblaApi && expandir((emblaApi.selectedScrollSnap() + 1) % total),
    [emblaApi, expandir, total],
  );

  /** Ir a una diapositiva concreta: sólo expande si es la de la ventana. */
  const irA = useCallback(
    (j: number) => {
      if (expansion) return;
      if (j === (actual + 1) % total) expandir(j);
      else emblaApi?.scrollTo(j, reducido);
    },
    [expansion, actual, total, expandir, emblaApi, reducido],
  );

  const alPulsar = (e: React.KeyboardEvent) => {
    if (expansion) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      anterior();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      siguiente();
    }
  };

  /** Contador `01 / 03`, pausa y barra de progreso segmentada, que además navega. */
  const contador = (activa: boolean) => (
    <div className="flex items-center gap-4">
      {/*
        Pausa (WCAG 2.2.2), obligatoria mientras haya movimiento automático.

        Vive aquí y no junto al CTA: es el mando del avance, y el avance es lo
        que cuenta esta barra. Sacarlo a la esquina obligaba a un rótulo y a un
        botón del tamaño de los del CTA, que era justo el peso visual que
        sobraba. Con movimiento reducido no hay autoavance, así que desaparece.

        Sin `aria-pressed`: no es un interruptor de estado sino dos acciones
        distintas, y el `aria-label` ya dice cuál toca.
      */}
      {!reducido && (
        <button
          type="button"
          onClick={() => setEnPausa((v) => !v)}
          aria-label={
            enPausa
              ? 'Reanudar el avance automático del carrusel'
              : 'Pausar el avance automático del carrusel'
          }
          /* 28px de objetivo táctil para un icono de 14: el mínimo son 24
             (WCAG 2.5.8), y el botón es quien los aporta. */
          className="grid size-7 shrink-0 place-items-center rounded-full text-white/80
                     transition-colors hover:bg-white/15 hover:text-white"
        >
          {enPausa ? (
            <Play aria-hidden="true" className="size-3.5" />
          ) : (
            <Pause aria-hidden="true" className="size-3.5" />
          )}
        </button>
      )}

      <p className="text-sm tabular-nums text-white">
        <span className="font-semibold">{dosDigitos(actual + 1)}</span>
        <span className="text-comunidad-100/70"> / {dosDigitos(total)}</span>
      </p>

      <ul className="flex items-center gap-2">
        {diapositivas.map((d, j) => (
          <li key={d.id}>
            {/* El trazo mide 2px de alto, pero el objetivo táctil debe llegar
                a 24px (WCAG 2.5.8): lo aporta el botón con su altura. */}
            <button
              type="button"
              onClick={() => irA(j)}
              aria-current={j === actual ? 'true' : undefined}
              className="grid h-6 w-10 place-items-center sm:w-14"
            >
              <span
                aria-hidden="true"
                className="relative block h-0.5 w-full overflow-hidden rounded-full bg-white/30"
              >
                {j === actual && (
                  <span
                    /* Al cambiar de diapositiva el elemento se vuelve a montar
                       y la animación arranca de cero. */
                    key={actual}
                    className="absolute inset-0 origin-left bg-white"
                    style={
                      activa && !reducido
                        ? {
                            animation: `barra-hero ${INTERVALO}ms linear forwards`,
                            animationPlayState: autoavanceActivo ? 'running' : 'paused',
                          }
                        : { transform: 'scaleX(1)' }
                    }
                  />
                )}
                {j < actual && <span className="absolute inset-0 bg-white/60" />}
              </span>
              <span className="sr-only">
                Ir a la diapositiva {j + 1} de {total}: {d.titulo}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <section
      ref={seccionRef}
      // `data-hero`: lo busca el observador de `Header.astro` para saber hasta
      // dónde la cabecera tiene fotografía debajo.
      data-hero
      aria-roledescription="carousel"
      aria-label="Destacados de la IDE Chile"
      // A sangre: del píxel 0 al borde derecho, sin `max-w` ni márgenes.
      className="relative w-full overflow-hidden"
      /*
        El puntero encima **no** detiene el avance, y antes sí.

        Parecía una cortesía y en la práctica congelaba el carrusel: el Hero es
        una franja a sangre que ocupa el ancho entero y la parte alta de la
        portada, así que basta con dejar el ratón apoyado —lo normal justo
        después de pulsar algo— para que no avance nunca, sin ninguna señal de
        por qué. Medido: 24 s con el puntero encima, cero avances; con el
        puntero fuera, tres. Se reportó como que el carrusel estaba roto.

        La pausa que exige WCAG 2.2.2 no se pierde: está el botón de la barra de
        progreso, que es explícito y reversible.

        El foco sí sigue deteniéndolo, y eso no es simetría sino necesidad: las
        diapositivas que no se ven llevan `inert`, de modo que si el carrusel
        avanzara con el foco dentro de la activa, el elemento enfocado saldría
        del árbol y el foco se perdería al principio del documento.
      */
      onFocus={() => setInteraccion(true)}
      onBlur={() => setInteraccion(false)}
      onKeyDown={alPulsar}
    >
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {diapositivas.map((d, i) => {
            const activa = i === actual;
            /* Mientras la ventana se expande por encima, el texto de la
               diapositiva que se va se desvanece. El contador no: en la
               referencia se mantiene, y es lo que da continuidad al cambio. */
            const saliendo = activa && expansion !== null;

            /*
              La diapositiva de fuera lleva `flex` para que el panel de dentro
              herede la altura de la fila.

              Sin él, la de fuera sí se estiraba a la más alta del carrusel
              —Embla alinea con `stretch`— pero el panel interno seguía
              midiéndose por su propio contenido, con `min-h` como suelo. Y como
              la fotografía va `absolute inset-0` dentro de ese panel, cada
              diapositiva mostraba una imagen de distinto alto: medidos a 375 px
              daban 510, 607 y 527. En escritorio no se veía, porque sólo hay una
              diapositiva a la vista; al deslizar en el móvil, sí.

              Con `flex`, el panel pasa a ser hijo flexible y se estira a la
              altura de la fila. La que la fija sigue siendo la de más texto.
            */
            return (
              <div
                key={d.id}
                className="flex min-w-0 flex-[0_0_100%]"
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} de ${total}: ${d.titulo}`}
                // Fuera del orden de tabulación mientras no esté visible.
                inert={!activa}
              >
                {/*
                  `overflow-hidden` no es decorativo: el *zoom out* deja las
                  diapositivas en reposo a `scale-110`, y una imagen al 110 %
                  de un panel de 1440 px mide 1584 px, así que sobresale 72 px
                  por cada lado. Sin recorte, la imagen de la diapositiva
                  siguiente se colaba en el borde derecho de la visible y se
                  veía como una costura vertical a 72 px del borde.
                */}
                {/*
                  Alto relativo a la ventana con tope, no fijo por punto de
                  ruptura.

                  El criterio no es estético sino de contenido: el titular de
                  las tarjetas de «Productos principales» tiene que leerse sin
                  desplazar la página. Como esas tarjetas empiezan justo debajo,
                  lo que decide es cuánto queda de ventana, no cuán ancha es;
                  un portátil de 1366×768 y un monitor de 1440×900 tienen casi
                  el mismo ancho y muy distinto alto.

                  El tope de 26rem evita que en pantallas altas el Hero crezca
                  sin motivo, y `min-h` deja que un titular de tres líneas lo
                  empuje en vez de recortarlo.

                  A partir de 900px de alto de ventana el Hero crece un 20%
                  (50svh es un 20% más que 42svh, y 31rem lo es de 26rem). El
                  crecimiento va atado al **alto** y no al ancho porque lo que
                  lo limita es el criterio del pliegue: en 1366×768 y 1280×720
                  el margen sobre el titular de las tarjetas es de 61px y 34px,
                  y un 20% se los come. Por encima de 900px sobra sitio. Si
                  toca este umbral, vuelva a medir los cuatro tamaños.
                */}
                {/*
                  `w-full` va con el `flex` de la diapositiva de fuera y no se
                  puede quitar ninguno de los dos por separado.

                  El `flex` le da a este panel el **alto** de la fila. Pero al
                  dejar de ser un hijo de bloque para pasar a ser un hijo
                  flexible, su **ancho** dejó de ser el 100 % y pasó a ajustarse
                  al contenido: a 1920 px el Hero se quedaba en 544 y 800 px, con
                  la mitad derecha en blanco. `w-full` se lo devuelve.
                */}
                <div
                  className="relative isolate flex w-full min-h-[min(50svh,26.5rem)] flex-col
                             overflow-hidden sm:min-h-[min(50svh,29rem)]
                             lg:min-h-[min(50svh,31rem)]
                             [@media(min-height:900px)]:min-h-[min(60svh,37rem)]"
                >
                  {/*
                    `alt=""`: toda la información de la diapositiva está en el
                    texto que la acompaña, así que describir la fotografía no
                    añadiría nada que no se haya dicho ya. Su descripción
                    editorial vive en `src/data/carousel.ts`.

                    Sin `width` ni `height`: va en posición absoluta cubriendo
                    la diapositiva, así que no ocupa sitio en el flujo y no
                    puede provocar salto de maquetado.
                  */}
                  <img
                    src={d.imagen.src}
                    srcSet={d.imagen.srcset}
                    sizes={d.imagen.sizes}
                    alt=""
                    loading={i === 0 ? 'eager' : 'lazy'}
                    /*
                      `low` y no `auto` en las diapositivas que no se ven.
                      Con `auto` el navegador las trataba como imágenes
                      normales y descargaba la de la segunda diapositiva —97 KB
                      en emulación móvil— mientras aún competía por el ancho de
                      banda con la portada. Ninguna de las dos está en pantalla
                      hasta que alguien avanza.
                    */
                    fetchPriority={i === 0 ? 'high' : 'low'}
                    decoding="async"
                    className={`absolute inset-0 -z-20 size-full object-cover
                                transition-transform ease-out ${activa ? 'scale-100' : 'scale-110'}`}
                    style={{ transitionDuration: DURACION_ZOOM }}
                  />

                  {/*
                    Velo en dos capas. La horizontal garantiza el contraste del
                    texto, que vive en la mitad izquierda; la vertical asienta
                    el bloque inferior. Sin esto el cumplimiento de WCAG 1.4.3
                    dependería de qué fotografía se deposite, que es
                    exactamente lo que no se puede dejar al azar.

                    Los dos extremos que no defienden texto van flojos, para
                    que la fotografía se vea:

                     · El derecho estuvo en el 55 % mientras ahí cayeron los
                       botones anterior/siguiente/pausa, cuyo borde blanco se
                       perdía sobre las zonas claras. Retirados esos botones,
                       en esa banda sólo quedan el CTA —que lleva su propio
                       fondo sólido— y la cápsula de previsualización, que no
                       tiene texto.
                     · El superior bajó del 45 % porque la banda de la cabecera
                       ya cubre esa zona al 80 %, y las dos juntas borraban la
                       foto entera en la esquina.

                    Lo que **no** se puede aligerar es esa banda de la cabecera:
                    es lo único que sostiene la legibilidad del menú sobre
                    cualquier fotografía. Está más abajo, en la `<section>`.
                  */}
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 -z-10 bg-gradient-to-r from-comunidad-950/95
                               via-comunidad-950/80 to-comunidad-950/30"
                  />
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 -z-10 bg-gradient-to-t from-comunidad-950/85
                               via-transparent to-comunidad-950/20"
                  />

                  {/*
                    Contenido acotado aunque el fondo vaya a sangre.

                    El `pr` extra reserva el hueco de la ventana de
                    previsualización, que flota sobre el borde derecho a media
                    altura. Sin él un titular largo se mete por debajo: con
                    «Geoportal de Chile» sobraba sitio por poco, pero
                    «Política de Gestión de Información Territorial —
                    Geoespacial» ocupa dos
                    líneas y sí llegaba. Va en porcentaje para que siga al
                    ancho de la ventana, que también lo es.
                  */}
                  {/*
                    El hueco de arriba lo marca la cabecera, que flota encima
                    (BRIEF §4B). Sin él, la etiqueta y el titular —que desde el
                    reordenado abren la diapositiva— quedarían tapados por el
                    menú.

                    El relleno inferior va en `pb-*` y no en `py-*`: con el eje
                    completo, el `sm:py-9` volvía a fijar el relleno superior en
                    cuanto la ventana pasaba de 640px y el titular se metía
                    debajo del menú en todas las pantallas menos las pequeñas.
                  */}
                  <div
                    className="mx-auto flex w-full max-w-7xl flex-1 flex-col justify-between
                               gap-6 px-4 pb-8 pr-[17%] pt-[calc(var(--altura-cabecera)+1.5rem)]
                               sm:px-6 sm:pb-9 sm:pr-[14%] lg:gap-0 lg:px-8 lg:pb-10
                               lg:pr-[13%]"
                  >
                    {/*
                      Bloque superior: el mensaje, en orden de lectura.

                      Etiqueta, titular y descripción van juntos y arriba, y el
                      contador baja a una banda propia al pie. Antes la
                      descripción abría la diapositiva y el titular aparecía
                      abajo, con el contador metido entre ambos: quien llegaba
                      leía la explicación de algo que todavía no se había
                      nombrado, y el contador cortaba el bloque de texto en dos.
                    */}
                    <div className="max-w-3xl">
                      <p
                        className={`eyebrow text-cosecha-300 dark:text-cosecha-300
                                    ${entrada(activa, 'delay-100', saliendo)}`}
                      >
                        {d.eyebrow}
                      </p>

                      {/* El titular baja un escalón en ventanas de menos de
                          800 px de alto. Ahí el suelo del Hero no lo marca su
                          padding sino la diapositiva cuyo titular ocupa dos
                          líneas, y esos 26 px son los que dejaban el titular
                          de las tarjetas pegado al borde inferior. La consulta
                          es por alto y no por ancho porque el problema es de
                          alto: un portátil de 1280×720 es igual de ancho que
                          un monitor de 1280×1024.

                          `h2` y no `h1`: hay tres diapositivas en el DOM y tres
                          `h1` perjudicarían el SEO. `inert` las oculta a los
                          lectores de pantalla, pero no a los rastreadores. El
                          `h1` de la página vive en `index.astro`. */}
                      {/* `lang` sólo cuando el titular no está en el idioma de
                          la página (WCAG 3.1.2). Hoy lo usa «SAVE THE DATE».
                          `undefined` no llega a emitir el atributo. */}
                      <h2
                        lang={d.tituloIdioma}
                        className={`mt-3 font-display text-4xl font-bold tracking-tight
                                    text-white sm:text-5xl
                                    [@media(max-height:800px)]:sm:text-4xl
                                    ${entrada(activa, 'delay-150', saliendo)}`}
                      >
                        {d.titulo}
                      </h2>

                      {/*
                        `max-w-lg` y no `max-w-sm`: con la columna estrecha la
                        descripción ocupaba tres líneas y el Hero no bajaba de
                        334 px, que en una pantalla de 720 px dejaba el titular
                        de las tarjetas justo en el borde. En dos líneas el Hero
                        encoge lo suficiente para que se lea con holgura.
                      */}
                      {/* `whitespace-pre-line`: una descripción puede traer un
                          salto de línea escrito (`\n`) cuando el corte importa,
                          como en la fecha y el lugar de la conferencia. Sin
                          saltos no cambia nada — el resto de la envoltura sigue
                          siendo automática. */}
                      <p
                        className={`mt-4 max-w-lg whitespace-pre-line text-sm leading-relaxed
                                    text-comunidad-100
                                    ${entrada(activa, 'delay-200', saliendo)}`}
                      >
                        {d.descripcion}
                      </p>
                    </div>

                    {/*
                      Banda inferior: contador a la izquierda y CTA al extremo
                      opuesto, sobre la misma línea de base.

                      Los botones anterior/siguiente/pausa que vivían junto al
                      CTA se retiraron: agrupados ahí competían con él, y la
                      referencia del BRIEF §4B no tiene ninguno. Nada se pierde
                      con ello —cada vía sigue existiendo—, y conviene saber
                      cuál es cada una antes de darlos por necesarios:

                       · los trazos del contador llevan a cada diapositiva y
                         están etiquetados uno a uno;
                       · las flechas del teclado operan la región (`alPulsar`),
                         que es lo que exige el patrón de carrusel del W3C;
                       · la ventana de previsualización avanza al pulsarla;
                       · el arrastre lo aporta Embla;
                       · y la pausa, obligatoria por WCAG 2.2.2, está ahora
                         dentro de la barra de progreso.
                    */}
                    <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                      <div className={entrada(activa, 'delay-300')}>{contador(activa)}</div>

                      {/* El envoltorio lleva la entrada y el enlace su
                          `transition-colors`: en el mismo elemento, las dos
                          declaran `transition-property` y una anula a la otra
                          según el orden del CSS generado, no el de las clases. */}
                      <div className={`shrink-0 ${entrada(activa, 'delay-300', saliendo)}`}>
                        <a
                          href={d.cta.href}
                          {...(d.cta.externo
                            ? { target: '_blank', rel: 'noopener noreferrer' }
                            : {})}
                          className="inline-flex items-center gap-2 rounded-2xl bg-cosecha-400
                                     px-7 py-3.5 font-semibold text-comunidad-950 transition-colors
                                     hover:bg-cosecha-300"
                        >
                          {d.cta.texto}
                          {d.cta.externo && (
                            <>
                              <SquareArrowOutUpRight aria-hidden="true" className="size-4" />
                              <span className="sr-only">(se abre en una ventana nueva)</span>
                            </>
                          )}
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/*
        Ventana de previsualización (BRIEF §4B).

        Sólo muestra imagen, nunca texto: la solapa cae sobre el borde
        izquierdo de la diapositiva siguiente, que es donde vive su titular, y
        las diapositivas no activas van marcadas `inert`. Dejar texto asomando
        ahí sería contenido visible que ningún lector de pantalla anuncia.
        Resolverlo con una ventana propia, en vez de estrechando las
        diapositivas de Embla, elimina el problema de raíz.

        `aria-hidden` + `tabIndex={-1}`: es un duplicado decorativo. Avanzar
        está resuelto por teclado con la flecha derecha sobre la región, y por
        los trazos del contador, que sí están etiquetados uno a uno. No es
        focalizable, así que no queda ningún elemento del orden de tabulación
        oculto al árbol de accesibilidad.

        Va por encima de la capa que se expande (`z-20`) y no por debajo: en la
        referencia, la ventana reaparece antes de que la expansión termine, ya
        con la diapositiva de después. Por eso `proxima` mira al destino
        mientras hay expansión, y la opacidad entra con retraso: durante el
        primer tramo del recorrido no debe haber nada en el borde derecho.
      */}
      {total > 1 && (
        <button
          ref={ventanaRef}
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          onClick={siguiente}
          style={{
            opacity: !expansion || expandida ? 1 : 0,
            // Sólo se anima la reaparición. El apagado, al arrancar la
            // expansión, tiene que ser instantáneo: la ventana es justamente
            // lo que parece estar creciendo.
            transitionProperty: expandida ? 'opacity' : 'none',
            transitionDuration: '300ms',
            transitionDelay: `${Math.round(DURACION_EXPANSION * 0.55)}ms`,
            // Invisible durante el recorrido y, por tanto, tampoco pulsable:
            // un clic ahí no debe encolar un avance que no se ve venir.
            pointerEvents: expansion ? 'none' : undefined,
          }}
          className="absolute right-0 top-1/2 z-30 h-[30%] w-[13%] -translate-y-1/2
                     overflow-hidden rounded-l-full ring-1 ring-white/25 sm:h-[36%] sm:w-[10%]
                     lg:w-[9%]"
        >
          <img
            key={proxima.id}
            src={proxima.imagen.src}
            srcSet={proxima.imagen.srcset}
            sizes={proxima.imagen.sizesVentana}
            alt=""
            loading="lazy"
            fetchPriority="low"
            decoding="async"
            className="size-full scale-105 object-cover opacity-90"
          />
        </button>
      )}

      {/*
        Capa de la expansión (BRIEF §4B).

        Crece desde el rectángulo de la ventana hasta llenar la diapositiva,
        anclada al borde derecho. Se animan `inset` y `border-radius`, no
        `transform: scale`: escalar deformaría la fotografía, y lo que hace la
        referencia es **recortarla menos** según crece, que es el
        comportamiento de `object-cover` sobre una caja que cambia de tamaño.
        La capa está fuera del flujo, así que ese cambio de tamaño no provoca
        reflujo de la página.

        `sizes` es el de diapositiva y no el de la ventana: al final del
        recorrido ocupa el ancho completo, y con el `sizes` pequeño llegaría
        borrosa justo cuando se mira de cerca.

        Se atiende `transitionend` sólo de `left`, que es la única propiedad
        con un recorrido garantizado —`right` va de 0 a 0—, y el temporizador
        de respaldo evita que la capa se quede montada si el evento no llega.
      */}
      {expansion && (
        <div
          aria-hidden="true"
          onTransitionEnd={(e) => {
            if (e.propertyName === 'left') cerrarExpansion();
          }}
          className="absolute z-20 overflow-hidden"
          style={{
            top: expandida ? 0 : expansion.top,
            right: expandida ? 0 : expansion.right,
            bottom: expandida ? 0 : expansion.bottom,
            left: expandida ? 0 : expansion.left,
            borderRadius: expandida ? 0 : '9999px 0 0 9999px',
            transitionProperty: 'top, right, bottom, left, border-radius',
            transitionDuration: `${DURACION_EXPANSION}ms`,
            transitionTimingFunction: CURVA_EXPANSION,
          }}
        >
          <img
            src={diapositivas[expansion.destino].imagen.src}
            srcSet={diapositivas[expansion.destino].imagen.srcset}
            sizes={diapositivas[expansion.destino].imagen.sizes}
            alt=""
            decoding="async"
            className="size-full object-cover"
          />

          {/*
            El velo entra con el recorrido, no de golpe.

            La diapositiva de debajo lleva estas dos capas para garantizar el
            contraste del texto (WCAG 1.4.3); la ventana, en cambio, enseña la
            fotografía limpia. Sin esta transición el cambio se notaba en los
            dos extremos: al arrancar, porque una cápsula oscura sustituía a la
            clara; y al terminar, porque la imagen sin velo saltaba de pronto a
            la versión velada al ceder el sitio a la diapositiva.

            Los porcentajes son los mismos que los de la diapositiva, y tienen
            que seguir siéndolo: en cuanto se separen, la capa cede el sitio a
            un fondo distinto del que acaba de dibujar y vuelve el salto.
          */}
          <div
            className="absolute inset-0 bg-gradient-to-r from-comunidad-950/95 via-comunidad-950/80 to-comunidad-950/30"
            style={{
              opacity: expandida ? 1 : 0,
              transition: `opacity ${DURACION_EXPANSION}ms ${CURVA_EXPANSION}`,
            }}
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-comunidad-950/85 via-transparent to-comunidad-950/20"
            style={{
              opacity: expandida ? 1 : 0,
              transition: `opacity ${DURACION_EXPANSION}ms ${CURVA_EXPANSION}`,
            }}
          />
        </div>
      )}

      {/*
        Velo de la cabecera (BRIEF §4B).

        La cabecera flota encima sin fondo propio, así que el contraste de los
        enlaces del menú depende de esta capa y de nada más. No se confía en
        los dos velos de la diapositiva: en la banda superior derecha suman un
        75 %, pero eso es consecuencia de dos degradados pensados para el texto
        del Hero, y cualquier retoque futuro se llevaría por delante la
        legibilidad del menú sin que nada avisara.

        El 80 % está calculado contra el peor caso posible, una fotografía
        completamente blanca: texto blanco sobre `comunidad-950` (#0d1c2f) al 80 %
        compuesto sobre blanco da 12,8:1. El mínimo para cumplir AA (4,5:1) es
        el 60 %; por debajo de eso no se baje sin rehacer el cálculo.

        Va en la `<section>` y con `z-40`, no dentro de cada diapositiva: la
        capa de la expansión ocupa `z-20` y la ventana de previsualización
        `z-30`, así que un velo por diapositiva quedaría tapado justo mientras
        la tarjeta crece, que es cuando más claro puede ponerse el fondo del
        menú. Sólo la cabecera (`z-50`) queda por encima.
      */}
      {/*
        `data-velo-cabecera` existe para una sola cosa: que el modo de alto
        contraste pueda retirarlo. Allí la regla que normaliza todo a blanco y
        negro le quita el degradado y le pone fondo blanco, y como esta capa va
        en `z-40` —por encima del contenido de la diapositiva— deja de ser un
        velo para convertirse en un rectángulo blanco opaco que tapa la etiqueta
        y la mitad superior del titular. La regla vive en `global.css`, junto al
        resto del bloque de alto contraste.
      */}
      <div
        aria-hidden="true"
        data-velo-cabecera
        className="pointer-events-none absolute inset-x-0 top-0 z-40"
        style={{
          height: 'calc(var(--altura-cabecera) + 4.5rem)',
          background:
            'linear-gradient(to bottom,' +
            ' rgb(13 28 47 / 0.8) 0,' +
            ' rgb(13 28 47 / 0.8) calc(var(--altura-cabecera) + 0.5rem),' +
            ' transparent 100%)',
        }}
      />

      {/* Anuncia el cambio de diapositiva sólo cuando lo provoca la persona:
          durante el autoavance sería una interrupción constante. */}
      <p role="status" aria-live={autoavanceActivo ? 'off' : 'polite'} className="sr-only">
        Diapositiva {actual + 1} de {total}: {diapositivas[actual]?.titulo}
      </p>
    </section>
  );
}
