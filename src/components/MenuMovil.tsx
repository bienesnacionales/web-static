/**
 * Menú de navegación móvil (por debajo de `xl`, donde el Mega Menú no cabe).
 *
 * Patrón *disclosure*: un botón hamburguesa con `aria-expanded` +
 * `aria-controls` sobre un panel que cae bajo la cabecera. El icono se
 * transforma de hamburguesa a aspa con `morphicons` (física de resorte sobre
 * los datos de Lucide); el estado vive aquí y la animación es un detalle del
 * componente.
 *
 * `morphicons` consume los iconos como **datos** del paquete `lucide`, no los
 * componentes de `lucide-react`: son dos paquetes distintos que conviven a
 * propósito, con las versiones alineadas en package.json.
 *
 * Sustituyó al `<details>` nativo. Se pierde la navegación sin JavaScript en
 * móvil —el pie de página, con todas las secciones, queda como respaldo— y se
 * gana el panel superpuesto con la misma piel del Mega Menú y el icono
 * animado que pidió la contraparte.
 *
 * La regla de la cabecera transparente sobre el Hero
 * (`:not(:has([aria-expanded="true"]))` en global.css) ya cubre este botón:
 * con el menú abierto la cabecera recupera su fondo, igual que con el Mega
 * Menú de escritorio.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { MorphIcon } from 'morphicons/react';
import { Menu, X } from 'lucide'; // datos, no componentes
import type { EnlaceNav, SeccionNav } from '@/data/navigation';

interface Props {
  rutaActual: string;
  /** Navegación ya filtrada por `Header.astro`, la misma que ve el Mega Menú. */
  navegacion: SeccionNav[];
  accesosRapidos: EnlaceNav[];
}

export default function MenuMovil({ rutaActual, navegacion, accesosRapidos }: Props) {
  const [abierto, setAbierto] = useState(false);
  const raizRef = useRef<HTMLDivElement>(null);
  const botonRef = useRef<HTMLButtonElement>(null);

  const esActiva = (href: string) =>
    href === '/' ? rutaActual === '/' : rutaActual.startsWith(href);

  const cerrar = useCallback((devolverFoco = false) => {
    setAbierto(false);
    if (devolverFoco) botonRef.current?.focus();
  }, []);

  // Escape cierra y devuelve el foco al botón.
  useEffect(() => {
    if (!abierto) return;
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cerrar(true);
      }
    };
    document.addEventListener('keydown', alPulsar);
    return () => document.removeEventListener('keydown', alPulsar);
  }, [abierto, cerrar]);

  // Un toque o un foco fuera del menú lo cierra (sin robar el foco).
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: Event) => {
      if (!raizRef.current?.contains(e.target as Node)) cerrar(false);
    };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('focusin', fuera);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      document.removeEventListener('focusin', fuera);
    };
  }, [abierto, cerrar]);

  return (
    <div ref={raizRef} className="xl:hidden">
      <button
        ref={botonRef}
        type="button"
        aria-expanded={abierto}
        aria-controls="menu-movil-panel"
        onClick={() => setAbierto((v) => !v)}
        className="grid size-11 place-items-center rounded-xl text-slate-700
                   transition-colors hover:bg-comunidad-50 hover:text-comunidad-800
                   dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
      >
        {/*
          `reducedMotion="user"`: con `prefers-reduced-motion` el morph se
          degrada a un cambio instantáneo, coherente con el resto del sitio.
          `aria-hidden` lo pone el propio MorphIcon al no llevar `label`; el
          nombre accesible del botón lo da el `sr-only`.
        */}
        <MorphIcon
          icon={abierto ? X : Menu}
          size={22}
          strokeWidth={2}
          reducedMotion="user"
        />
        <span className="sr-only">{abierto ? 'Cerrar el menú' : 'Abrir el menú'}</span>
      </button>

      {abierto && (
        <div
          id="menu-movil-panel"
          data-superficie
          className="panel-mega absolute inset-x-0 top-full z-40 border-b
                     border-slate-200/60 bg-white shadow-xl dark:border-slate-800
                     dark:bg-slate-950"
        >
          {/*
            Desplazamiento propio: sin tope de altura el panel crece más que la
            ventana dentro de una cabecera que no se mueve, y la parte de abajo
            no se alcanza nunca. `svh` es el mínimo garantizado en móvil;
            `overscroll-contain` evita que el gesto pase a la página al llegar
            al final.
          */}
          <nav
            aria-label="Navegación principal (móvil)"
            className="max-h-[calc(100svh-var(--altura-cabecera)-0.5rem)] overflow-y-auto
                       overscroll-contain px-4 pb-5 pt-3"
          >
            <ul className="space-y-4">
              {navegacion.map((seccion) => (
                <li key={seccion.id}>
                  <a
                    href={seccion.href}
                    aria-current={esActiva(seccion.href) ? 'page' : undefined}
                    className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-900
                               hover:bg-comunidad-50 aria-[current=page]:bg-comunidad-50
                               dark:text-white dark:hover:bg-slate-800"
                  >
                    {seccion.titulo}
                  </a>

                  {/* Sin subniveles no se dibuja la lista: dejaría un borde vacío. */}
                  {seccion.columnas.length > 0 && (
                    <div className="mt-1 space-y-3 border-l border-slate-200 pl-3 dark:border-slate-800">
                      {seccion.columnas.map((columna) => (
                        <div key={columna.titulo}>
                          {columna.href ? (
                            <a
                              href={columna.href}
                              className="eyebrow inline-flex min-h-6 items-center gap-1.5 px-3
                                         hover:underline"
                            >
                              {columna.titulo}
                              <span aria-hidden="true">→</span>
                            </a>
                          ) : (
                            <p className="eyebrow inline-flex min-h-6 items-center px-3">
                              {columna.titulo}
                            </p>
                          )}

                          <ul className="mt-0.5 space-y-0.5">
                            {columna.enlaces.map((enlace) => (
                              <li key={enlace.href}>
                                <a
                                  href={enlace.href}
                                  className="block rounded-lg px-3 py-1.5 text-sm text-slate-600
                                             hover:bg-comunidad-50 dark:text-slate-400
                                             dark:hover:bg-slate-800"
                                  {...(enlace.externo
                                    ? { target: '_blank', rel: 'noopener noreferrer' }
                                    : {})}
                                >
                                  {enlace.titulo}
                                  {enlace.externo && (
                                    <span className="sr-only"> (se abre en una ventana nueva)</span>
                                  )}
                                </a>

                                {/* Tercer nivel del mapa, para llegar a las mismas
                                    páginas que el Mega Menú de escritorio. */}
                                {enlace.hijos && enlace.hijos.length > 0 && (
                                  <ul className="ml-3 space-y-0.5 border-l border-slate-200 pl-3 dark:border-slate-800">
                                    {enlace.hijos.map((hijo) => (
                                      <li key={hijo.href}>
                                        <a
                                          href={hijo.href}
                                          className="block rounded-lg px-3 py-1.5 text-sm text-slate-500
                                                     hover:bg-comunidad-50 dark:text-slate-400
                                                     dark:hover:bg-slate-800"
                                        >
                                          {hijo.titulo}
                                        </a>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>

            <ul
              className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-200/60 pt-4
                         dark:border-slate-800"
            >
              {accesosRapidos.map((acceso) => (
                <li key={acceso.href}>
                  <a
                    href={acceso.href}
                    className="text-sm font-semibold text-comunidad-700 hover:underline
                               dark:text-cosecha-400"
                    {...(acceso.externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  >
                    {acceso.titulo}
                    {acceso.externo && (
                      <span className="sr-only"> (se abre en una ventana nueva)</span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}
    </div>
  );
}
