/**
 * Buscador global con Pagefind (BRIEF §9).
 *
 * Dos modos con una sola implementación:
 *  - `disparador` — el enlace del Header, que abre un modal Cmd+K / Ctrl+K.
 *  - `pagina`     — el buscador embebido en `/buscar`.
 *
 * El índice lo genera Pagefind al final de `npm run build`, recorriendo el
 * HTML ya construido. Cualquier página nueva entra en el índice sin tocar
 * este componente: basta con que exista en `dist/`.
 *
 * Se usa el elemento nativo <dialog> con `showModal()`, que aporta atrapado
 * de foco, cierre con Escape y fondo inerte sin implementarlos a mano.
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Search, X, CornerDownLeft, LoaderCircle } from 'lucide-react';
import { trozosDelExtracto } from '@/lib/extracto';

/** Ruta del índice generado por Pagefind dentro de `dist/`. */
const RUTA_PAGEFIND = '/pagefind/pagefind.js';
const MAX_RESULTADOS = 8;
const RETARDO_BUSQUEDA = 160;

interface ResultadoPagefind {
  url: string;
  excerpt: string;
  meta?: { title?: string };
}

type Estado = 'inactivo' | 'cargando' | 'listo' | 'sin-indice';

/** Etiqueta legible de la sección, deducida de la URL del resultado. */
function seccionDe(url: string): string {
  const limpia = url.replace(/^\/|\/$/g, '');
  const raiz = limpia.split('/')[0];
  const etiquetas: Record<string, string> = {
    'quienes-somos': 'Quiénes Somos',
    'comunidades-agricolas': 'Comunidades Agrícolas',
    documentacion: 'Documentación',
    noticias: 'Noticias',
    galerias: 'Galerías',
    contacto: 'Contacto',
  };
  return etiquetas[raiz] ?? 'Inicio';
}

interface Props {
  modo?: 'disparador' | 'pagina';
}

export default function Buscador({ modo = 'disparador' }: Props) {
  const esPagina = modo === 'pagina';
  const [abierto, setAbierto] = useState(esPagina);

  /*
    En modo página la consulta puede venir en la URL como `?q=`.

    `buscar.astro` ya se describía como «URL compartible para buscar sin el
    modal», pero nadie leía el parámetro: `/buscar?q=metadatos` abría la página
    con el campo vacío. Un enlace a una búsqueda no llevaba a ninguna búsqueda.

    Se lee en el inicializador de `useState` y no en un `useEffect` para que el
    primer render ya tenga el término: así no hay un fotograma con el campo
    vacío ni una búsqueda que se dispara dos veces.
  */
  const [consulta, setConsulta] = useState(() => {
    if (!esPagina || typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('q')?.trim() ?? '';
  });
  const [resultados, setResultados] = useState<ResultadoPagefind[]>([]);
  const [estado, setEstado] = useState<Estado>('inactivo');
  const [indice, setIndice] = useState(0);
  const [mac, setMac] = useState(false);

  const pagefind = useRef<any>(null);
  const dialogo = useRef<HTMLDialogElement>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const idListado = useId();

  useEffect(() => {
    // `navigator.platform` está obsoleto; se usa userAgentData cuando existe.
    const plataforma =
      (navigator as any).userAgentData?.platform ?? navigator.userAgent;
    setMac(/mac|iphone|ipad/i.test(plataforma));
  }, []);

  /** Carga perezosa del índice: sólo cuando se abre el buscador. */
  const cargarPagefind = useCallback(async () => {
    if (pagefind.current) return pagefind.current;
    setEstado('cargando');
    try {
      // La ruta va en una variable con `@vite-ignore` para que Vite no intente
      // resolverla en tiempo de build: el archivo aún no existe entonces,
      // porque Pagefind se ejecuta después de `astro build`.
      const ruta = RUTA_PAGEFIND;
      const modulo = await import(/* @vite-ignore */ ruta);
      await modulo.options?.({ excerptLength: 24 });
      pagefind.current = modulo;
      setEstado('listo');
      return modulo;
    } catch {
      // En `astro dev` el índice no existe todavía.
      setEstado('sin-indice');
      return null;
    }
  }, []);

  const abrir = useCallback(() => {
    setAbierto(true);
    void cargarPagefind();
  }, [cargarPagefind]);

  const cerrar = useCallback(() => {
    dialogo.current?.close();
    setAbierto(false);
  }, []);

  // En modo página el índice se carga de entrada.
  useEffect(() => {
    if (esPagina) void cargarPagefind();
  }, [esPagina, cargarPagefind]);

  /*
    La URL sigue a lo que se escribe, para que se pueda copiar y compartir.

    `replaceState` y no `pushState`: cada tecla crearía una entrada en el
    historial y el botón «atrás» tendría que recorrer la palabra letra a letra
    para salir de la página.
  */
  useEffect(() => {
    if (!esPagina) return;
    const url = new URL(window.location.href);
    const texto = consulta.trim();
    if (texto) url.searchParams.set('q', texto);
    else url.searchParams.delete('q');
    if (url.href !== window.location.href) window.history.replaceState(null, '', url);
  }, [esPagina, consulta]);

  // Atajo global Cmd+K / Ctrl+K.
  useEffect(() => {
    if (esPagina) return;
    const alPulsar = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        abrir();
      }
    };
    document.addEventListener('keydown', alPulsar);
    return () => document.removeEventListener('keydown', alPulsar);
  }, [esPagina, abrir]);

  // Sincroniza el <dialog> nativo con el estado de React.
  useEffect(() => {
    if (esPagina) return;
    const d = dialogo.current;
    if (!d) return;
    if (abierto && !d.open) {
      d.showModal();
      requestAnimationFrame(() => entrada.current?.focus());
    } else if (!abierto && d.open) {
      d.close();
    }
  }, [abierto, esPagina]);

  // Búsqueda con retardo, para no lanzar una consulta por tecla.
  useEffect(() => {
    if (!abierto) return;
    const texto = consulta.trim();
    if (!texto) {
      setResultados([]);
      return;
    }

    let vigente = true;
    const temporizador = window.setTimeout(async () => {
      const pf = await cargarPagefind();
      if (!pf || !vigente) return;
      const busqueda = await pf.search(texto);
      const datos = await Promise.all(
        busqueda.results.slice(0, MAX_RESULTADOS).map((r: any) => r.data()),
      );
      if (!vigente) return;
      setResultados(datos);
      setIndice(0);
    }, RETARDO_BUSQUEDA);

    return () => {
      vigente = false;
      window.clearTimeout(temporizador);
    };
  }, [consulta, abierto, cargarPagefind]);

  const alPulsarEnEntrada = (e: React.KeyboardEvent) => {
    if (!resultados.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndice((i) => (i + 1) % resultados.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndice((i) => (i - 1 + resultados.length) % resultados.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const elegido = resultados[indice];
      if (elegido) window.location.href = elegido.url;
    }
  };

  const cuerpo = (
    <>
      <div
        className="flex items-center gap-3 border-b border-slate-200/60 px-5
                   dark:border-slate-800"
      >
        <Search aria-hidden="true" className="size-5 shrink-0 text-slate-400" />
        <input
          ref={entrada}
          type="search"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          onKeyDown={alPulsarEnEntrada}
          placeholder="Buscar en el sitio…"
          aria-label="Buscar en el sitio"
          aria-controls={idListado}
          aria-autocomplete="list"
          autoComplete="off"
          className="buscador-entrada w-full bg-transparent py-4 text-base text-slate-900
                     outline-none placeholder:text-slate-400 dark:text-white"
        />
        {estado === 'cargando' && (
          <LoaderCircle aria-hidden="true" className="size-4 shrink-0 animate-spin text-slate-400" />
        )}
        {!esPagina && (
          <button
            type="button"
            onClick={cerrar}
            className="-mr-1.5 shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100
                       dark:hover:bg-slate-800"
          >
            <X aria-hidden="true" className="size-5" />
            <span className="sr-only">Cerrar el buscador</span>
          </button>
        )}
      </div>

      <div className="max-h-[60vh] overflow-y-auto">
        {/*
          Sin índice hay que decir dos cosas distintas según quién mire.

          En desarrollo, a quien programa: qué pasa y cómo probarlo. Ese texto
          menciona órdenes de consola y **no puede llegar a producción**; el
          estado `sin-indice` no significa «estamos en desarrollo» sino «el
          índice no cargó», y eso puede ocurrir en el sitio publicado por un 404,
          un despliegue a medias o una red caída. Mostrar ahí «ejecute npm run
          build» sería enseñarle al visitante un mensaje que no va con él y que
          no puede resolver.

          `import.meta.env.DEV` lo resuelve en tiempo de compilación: en el
          paquete de producción la rama de desarrollo ni siquiera se incluye.

          `role="status"`: quien usa lector de pantalla tiene que enterarse de
          que no hay resultados porque el buscador falló, no porque no haya nada.
        */}
        {estado === 'sin-indice' &&
          (import.meta.env.DEV ? (
            <p className="px-5 py-8 text-sm text-slate-600 dark:text-slate-400">
              El índice de búsqueda lo genera Pagefind al final del build.
              Ejecute{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">
                npm run build
              </code>{' '}
              una vez y recargue: en desarrollo se sirve desde{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">
                dist/
              </code>
              , así que refleja el último build, no lo que esté editando.
            </p>
          ) : (
            <p
              role="status"
              className="px-5 py-8 text-sm text-slate-600 dark:text-slate-400"
            >
              La búsqueda no está disponible en este momento. Vuelva a intentarlo
              más tarde o recorra las secciones desde el menú principal.
            </p>
          ))}

        {estado !== 'sin-indice' && consulta.trim() && !resultados.length && (
          <p className="px-5 py-8 text-sm text-slate-600 dark:text-slate-400">
            No hay resultados para <strong className="text-slate-900 dark:text-white">
              {consulta}
            </strong>.
          </p>
        )}

        {!consulta.trim() && estado !== 'sin-indice' && (
          <p className="px-5 py-8 text-sm text-slate-500 dark:text-slate-400">
            Escriba para buscar en las secciones del sitio: quiénes somos,
            comunidades, documentación, trámites y noticias.
          </p>
        )}

        <ul id={idListado} role="listbox" aria-label="Resultados de búsqueda">
          {resultados.map((r, i) => (
            <li key={r.url} role="option" aria-selected={i === indice}>
              <a
                href={r.url}
                onMouseEnter={() => setIndice(i)}
                className={`block border-b border-slate-100 px-5 py-4 last:border-0
                            dark:border-slate-800/60 ${
                              i === indice ? 'bg-comunidad-50 dark:bg-slate-800' : ''
                            }`}
              >
                <p className="eyebrow">{seccionDe(r.url)}</p>
                <p className="mt-1.5 font-semibold text-slate-900 dark:text-white">
                  {r.meta?.title ?? r.url}
                </p>
                {/* El extracto lo genera Pagefind a partir de nuestro propio
                    contenido indexado, con <mark> en los términos hallados.
                    Llega como cadena de HTML y se convierte en nodos antes de
                    pintarlo: el porqué está en `src/lib/extracto.ts`. */}
                <p className="buscador-extracto mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {trozosDelExtracto(r.excerpt).map((trozo, t) =>
                    trozo.resaltado ? (
                      <mark key={t}>{trozo.texto}</mark>
                    ) : (
                      <span key={t}>{trozo.texto}</span>
                    ),
                  )}
                </p>
              </a>
            </li>
          ))}
        </ul>
      </div>

      {resultados.length > 0 && (
        <div
          className="flex items-center justify-between gap-4 border-t border-slate-200/60
                     px-5 py-3 text-xs text-slate-500 dark:border-slate-800"
        >
          <span>
            {resultados.length} resultado{resultados.length === 1 ? '' : 's'}
          </span>
          <span className="flex items-center gap-1.5">
            <CornerDownLeft aria-hidden="true" className="size-3.5" />
            para abrir · ↑↓ para navegar
          </span>
        </div>
      )}

      {/* Anuncia el número de resultados a los lectores de pantalla. */}
      <p role="status" aria-live="polite" className="sr-only">
        {consulta.trim() ? `${resultados.length} resultados para ${consulta}` : ''}
      </p>
    </>
  );

  if (esPagina) {
    return <div className="tarjeta overflow-hidden">{cuerpo}</div>;
  }

  return (
    <>
      {/* Enlace, no botón: si la isla no llega a hidratarse el usuario acaba
          igualmente en /buscar en vez de pulsar un control muerto. */}
      <a
        href="/buscar"
        onClick={(e) => {
          e.preventDefault();
          abrir();
        }}
        className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium
                   text-slate-700 transition-colors hover:bg-comunidad-50 hover:text-comunidad-800
                   dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <Search aria-hidden="true" className="size-4" />
        {/* En móvil sólo queda la lupa: `sr-only` conserva el nombre accesible
            del enlace sin ocupar la fila. */}
        <span className="max-sm:sr-only">Buscar</span>
        <kbd
          className="hidden rounded border border-slate-300 px-1.5 py-0.5 text-[0.6875rem]
                     font-sans text-slate-500 lg:inline-block dark:border-slate-700"
        >
          {mac ? '⌘' : 'Ctrl'} K
        </kbd>
      </a>

      <dialog
        ref={dialogo}
        onClose={() => setAbierto(false)}
        onClick={(e) => {
          // Clic en el backdrop: el target es el propio <dialog>.
          if (e.target === dialogo.current) cerrar();
        }}
        aria-label="Buscar en el sitio"
        /* `mx-auto mt-[10vh]` es obligatorio: el navegador centra los <dialog>
           modales con `margin: auto`, pero el preflight de Tailwind pone
           `margin: 0` en todos los elementos y lo anula, dejando el panel
           pegado arriba a la izquierda. */
        className="tarjeta mx-auto mt-[10vh] mb-auto w-[min(40rem,calc(100vw-2rem))]
                   overflow-hidden p-0 backdrop:bg-slate-950/40 backdrop:backdrop-blur-sm"
      >
        {cuerpo}
      </dialog>
    </>
  );
}
