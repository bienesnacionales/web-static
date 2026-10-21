/**
 * Mega Menú del Header.
 *
 * Patrón de accesibilidad: *disclosure* (botón con `aria-expanded` +
 * `aria-controls` sobre una región). No se usa `role="menu"` / `menuitem`
 * porque ese patrón está pensado para menús de aplicación; aplicado a
 * navegación de enlaces degrada la experiencia en lectores de pantalla.
 *
 * Teclado: Enter/Espacio abre, Flecha abajo abre y enfoca el primer enlace,
 * Flechas izq/der recorren las secciones, Escape cierra devolviendo el foco,
 * Tab fuera del panel lo cierra.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  FileText,
  Globe,
  LifeBuoy,
  Map,
  Mountain,
  Scale,
  SquareArrowOutUpRight,
  type LucideIcon,
} from 'lucide-react';
import type { EnlaceNav, SeccionNav } from '@/data/navigation';

/**
 * Resuelve los nombres declarados en `navigation.ts` a componentes.
 *
 * Contiene exactamente los que usa la navegación: cada icono importado se
 * incluye en el bundle de la isla, así que sobrar cuesta bytes y faltar deja
 * la entrada sin icono.
 */
const ICONOS: Record<string, LucideIcon> = {
  BookOpen,
  FileText,
  Globe,
  LifeBuoy,
  Map,
  Mountain,
  Scale,
};

const RETARDO_APERTURA = 120;
const RETARDO_CIERRE = 220;

interface Props {
  rutaActual: string;
  /**
   * Navegación ya filtrada por `Header.astro`. Llega por props y no por
   * `import` porque la isla no puede leer la colección de contenido:
   * importándola mostraría también las secciones apagadas.
   */
  navegacion: SeccionNav[];
  accesosRapidos: EnlaceNav[];
}

export default function MegaMenu({ rutaActual, navegacion, accesosRapidos }: Props) {
  const [abierta, setAbierta] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const triggersRef = useRef<(HTMLButtonElement | null)[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const temporizador = useRef<number | null>(null);

  // Secciones que abren panel. Las demás se enlazan directo.
  const seccionesConPanel = navegacion.filter((s) => s.columnas.length > 0);

  const esActiva = (href: string) =>
    href === '/' ? rutaActual === '/' : rutaActual.startsWith(href);

  const limpiarTemporizador = () => {
    if (temporizador.current !== null) {
      window.clearTimeout(temporizador.current);
      temporizador.current = null;
    }
  };

  const cerrar = useCallback(
    (devolverFoco = false) => {
      limpiarTemporizador();
      if (devolverFoco && abierta) {
        const indice = seccionesConPanel.findIndex((s) => s.id === abierta);
        triggersRef.current[indice]?.focus();
      }
      setAbierta(null);
    },
    [abierta, seccionesConPanel],
  );

  // Escape cierra y devuelve el foco al disparador.
  useEffect(() => {
    if (!abierta) return;
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cerrar(true);
      }
    };
    document.addEventListener('keydown', alPulsar);
    return () => document.removeEventListener('keydown', alPulsar);
  }, [abierta, cerrar]);

  // Un clic o un foco fuera del menú lo cierra (sin robar el foco).
  useEffect(() => {
    if (!abierta) return;
    const fuera = (e: Event) => {
      if (!navRef.current?.contains(e.target as Node)) cerrar(false);
    };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('focusin', fuera);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      document.removeEventListener('focusin', fuera);
    };
  }, [abierta, cerrar]);

  useEffect(() => limpiarTemporizador, []);

  /** La apertura por hover sólo aplica a punteros de precisión. */
  const soportaHover = () =>
    typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches;

  const alEntrar = (id: string) => {
    if (!soportaHover()) return;
    limpiarTemporizador();
    temporizador.current = window.setTimeout(() => setAbierta(id), RETARDO_APERTURA);
  };

  const alSalir = () => {
    if (!soportaHover()) return;
    limpiarTemporizador();
    temporizador.current = window.setTimeout(() => setAbierta(null), RETARDO_CIERRE);
  };

  const enfocarPrimerEnlace = () => {
    // Se espera al pintado para que el panel exista en el DOM.
    requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLAnchorElement>('a[href]')?.focus();
    });
  };

  const alPulsarTrigger = (e: React.KeyboardEvent, indice: number, id: string) => {
    // Sólo cuentan las secciones con panel: las que se enlazan directo no
    // tienen botón, y contarlas dejaría huecos muertos en el recorrido.
    const total = seccionesConPanel.length;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setAbierta(id);
        enfocarPrimerEnlace();
        break;
      case 'ArrowRight':
        e.preventDefault();
        triggersRef.current[(indice + 1) % total]?.focus();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        triggersRef.current[(indice - 1 + total) % total]?.focus();
        break;
      case 'Home':
        e.preventDefault();
        triggersRef.current[0]?.focus();
        break;
      case 'End':
        e.preventDefault();
        triggersRef.current[total - 1]?.focus();
        break;
    }
  };

  /*
    `xl` y no `lg`: por debajo la fila del header no cabe con las secciones
    desplegadas. Si cambia aquí, cambia también el `xl:hidden` del `<details>`
    de Header.astro: entre los dos no puede quedar ni un hueco ni un
    solapamiento.
  */
  return (
    <nav
      ref={navRef}
      aria-label="Navegación principal"
      className="hidden xl:block"
      onMouseLeave={alSalir}
    >
      <ul className="flex items-center gap-0.5">
        {navegacion.map((seccion) => {
          const estaAbierta = abierta === seccion.id;
          const idPanel = `mega-panel-${seccion.id}`;

          // Las secciones sin subniveles se enlazan directo en vez de abrir
          // un panel vacío.
          if (!seccion.columnas.length) {
            return (
              <li key={seccion.id}>
                <a
                  href={seccion.href}
                  aria-current={esActiva(seccion.href) ? 'page' : undefined}
                  className="flex items-center whitespace-nowrap rounded-xl px-2.5 py-2 text-xs
                             font-medium text-slate-700 transition-colors hover:bg-comunidad-50
                             hover:text-comunidad-800 aria-[current=page]:text-comunidad-800
                             dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  {seccion.tituloCorto}
                </a>
              </li>
            );
          }

          const indicePanel = seccionesConPanel.findIndex((x) => x.id === seccion.id);

          return (
            <li key={seccion.id} onMouseEnter={() => alEntrar(seccion.id)}>
              <button
                type="button"
                ref={(el) => {
                  triggersRef.current[indicePanel] = el;
                }}
                aria-expanded={estaAbierta}
                aria-controls={idPanel}
                aria-current={esActiva(seccion.href) ? 'page' : undefined}
                onClick={() => (estaAbierta ? cerrar(false) : setAbierta(seccion.id))}
                onKeyDown={(e) => alPulsarTrigger(e, indicePanel, seccion.id)}
                className="flex items-center gap-1 whitespace-nowrap rounded-xl px-2.5 py-2
                           text-xs font-medium text-slate-700 transition-colors
                           hover:bg-comunidad-50 hover:text-comunidad-800
                           aria-expanded:bg-comunidad-50 aria-expanded:text-comunidad-800
                           aria-[current=page]:text-comunidad-800 dark:text-slate-300
                           dark:hover:bg-slate-800 dark:hover:text-white
                           dark:aria-expanded:bg-slate-800 dark:aria-expanded:text-white"
              >
                {seccion.tituloCorto}
                <ChevronDown
                  aria-hidden="true"
                  className={`size-4 transition-transform ${estaAbierta ? 'rotate-180' : ''}`}
                />
              </button>

              {estaAbierta && (
                <div
                  id={idPanel}
                  ref={panelRef}
                  data-superficie
                  className="panel-mega absolute inset-x-0 top-full z-40 border-b border-slate-200/60
                             bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950"
                >
                  <div className="mx-auto max-w-7xl px-4 py-9 sm:px-6 lg:px-8">
                    <div className="grid gap-10 md:grid-cols-2">
                      {seccion.columnas.map((columna) => (
                        <div key={columna.titulo}>
                          {/*
                            El rótulo de la columna es un enlace cuando el grupo
                            tiene página propia. `min-h-6`: `.eyebrow` es
                            `text-xs` y su caja queda por debajo de los 24px que
                            pide WCAG 2.5.8; el alto lo aporta el contenedor sin
                            cambiar el aspecto.
                          */}
                          {columna.href ? (
                            <a
                              href={columna.href}
                              className="eyebrow inline-flex min-h-6 items-center gap-1.5
                                         hover:underline"
                            >
                              {columna.titulo}
                              <ArrowRight aria-hidden="true" className="size-3.5" />
                            </a>
                          ) : (
                            <p className="eyebrow inline-flex min-h-6 items-center">
                              {columna.titulo}
                            </p>
                          )}
                          <ul className="mt-4 space-y-1">
                            {columna.enlaces.map((enlace) => {
                              const Icono = enlace.icono ? ICONOS[enlace.icono] : undefined;
                              return (
                                <li key={enlace.href}>
                                  <a
                                    href={enlace.href}
                                    {...(enlace.externo
                                      ? { target: '_blank', rel: 'noopener noreferrer' }
                                      : {})}
                                    className="group flex gap-3.5 rounded-2xl p-3 transition-colors
                                               hover:bg-comunidad-50 dark:hover:bg-slate-900"
                                  >
                                    {Icono && (
                                      <span
                                        aria-hidden="true"
                                        className="mt-0.5 grid size-9 shrink-0 place-items-center
                                                   rounded-xl bg-comunidad-50 text-comunidad-700
                                                   group-hover:bg-white dark:bg-slate-900
                                                   dark:text-cosecha-400 dark:group-hover:bg-slate-800"
                                      >
                                        <Icono className="size-[18px]" />
                                      </span>
                                    )}
                                    <span className="min-w-0">
                                      <span
                                        className="flex items-center gap-1.5 font-semibold
                                                   text-slate-900 dark:text-white"
                                      >
                                        {enlace.titulo}
                                        {enlace.externo && (
                                          <>
                                            <SquareArrowOutUpRight
                                              aria-hidden="true"
                                              className="size-3.5 shrink-0 text-slate-400"
                                            />
                                            <span className="sr-only">
                                              (se abre en una ventana nueva)
                                            </span>
                                          </>
                                        )}
                                      </span>
                                      {enlace.descripcion && (
                                        <span
                                          className="mt-0.5 block text-sm text-slate-600
                                                     dark:text-slate-400"
                                        >
                                          {enlace.descripcion}
                                        </span>
                                      )}
                                    </span>
                                  </a>

                                  {/* Subniveles del mapa. El margen izquierdo
                                      alinea con el título de la madre: 36px de
                                      icono más 14px de separación. */}
                                  {enlace.hijos && enlace.hijos.length > 0 && (
                                    <ul className="ml-[3.125rem] mt-0.5 space-y-0.5 border-l
                                                   border-slate-200 pl-3 dark:border-slate-800">
                                      {enlace.hijos.map((hijo) => (
                                        <li key={hijo.href}>
                                          <a
                                            href={hijo.href}
                                            className="block rounded-lg px-2 py-1 text-sm
                                                       text-slate-600 transition-colors
                                                       hover:bg-comunidad-50 hover:text-comunidad-800
                                                       dark:text-slate-400 dark:hover:bg-slate-900
                                                       dark:hover:text-white"
                                          >
                                            {hijo.titulo}
                                          </a>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>

                    {/* Franja inferior con accesos rápidos. */}
                    <div
                      className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3 border-t
                                 border-slate-200/60 pt-6 dark:border-slate-800"
                    >
                      {/*
                        La portada de la sección, delante de todo: el disparador
                        de la barra es un `<button>` que abre este panel, así
                        que sin este enlace no habría forma de llegar a ella en
                        escritorio.
                      */}
                      <a
                        href={seccion.href}
                        className="flex items-center gap-2 text-sm font-semibold text-slate-900
                                   hover:underline dark:text-white"
                      >
                        Ver todo {seccion.titulo}
                        <ArrowRight aria-hidden="true" className="size-4" />
                      </a>

                      {accesosRapidos.map((acceso) => {
                        const Icono = acceso.icono ? ICONOS[acceso.icono] : undefined;
                        return (
                          <a
                            key={acceso.href}
                            href={acceso.href}
                            {...(acceso.externo
                              ? { target: '_blank', rel: 'noopener noreferrer' }
                              : {})}
                            className="flex items-center gap-2 text-sm font-semibold text-comunidad-700
                                       hover:underline dark:text-cosecha-400"
                          >
                            {Icono && <Icono aria-hidden="true" className="size-4" />}
                            {acceso.titulo}
                            {acceso.externo && (
                              <span className="sr-only"> (se abre en una ventana nueva)</span>
                            )}
                          </a>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
