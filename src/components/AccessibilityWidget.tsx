/**
 * Widget de accesibilidad (BRIEF §4C).
 *
 * Escribe en `localStorage['ccaa-a11y']` y aplica las preferencias como clases
 * y atributos `data-*` sobre <html>. Todo el estilo asociado vive en
 * `src/styles/global.css`.
 *
 * IMPORTANTE: el script anti-FOUC de `BaseLayout.astro` lee exactamente esta
 * misma forma de objeto para aplicar las preferencias antes del primer
 * pintado. Si cambia el contrato de `Preferencias`, hay que actualizar ambos.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Accessibility,
  Contrast,
  Link2,
  Minus,
  Moon,
  MoveVertical,
  Plus,
  RotateCcw,
  Sun,
  Type,
  Waves,
  X,
} from 'lucide-react';

type Tema = 'claro' | 'oscuro' | 'alto-contraste';
type Movimiento = 'normal' | 'reducido';

interface Preferencias {
  tema: Tema;
  escalaFuente: number;
  dislexia: boolean;
  espaciado: boolean;
  movimiento: Movimiento;
  enlaces: boolean;
}

const CLAVE = 'ccaa-a11y';
const ESCALAS = [0.875, 1, 1.125, 1.25, 1.375, 1.5];
const ESCALA_BASE = 1;

const TEMAS: { valor: Tema; etiqueta: string; Icono: typeof Sun }[] = [
  { valor: 'claro', etiqueta: 'Claro', Icono: Sun },
  { valor: 'oscuro', etiqueta: 'Oscuro', Icono: Moon },
  { valor: 'alto-contraste', etiqueta: 'Alto contraste', Icono: Contrast },
];

function preferenciasPorDefecto(): Preferencias {
  const prefiereMenosMovimiento =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return {
    /*
      Claro siempre, sin consultar `prefers-color-scheme`: el portal se presenta
      igual a quien llega por primera vez. **El mismo valor está en el script
      inline de `BaseLayout.astro`**, que aplica el tema antes del primer
      pintado. Si divergen, la página sale con un tema y este interruptor marca
      el otro.

      Ojo con la asimetría: el movimiento de abajo **sí** sigue al sistema. No es
      una incoherencia. Reducir el movimiento es una necesidad médica declarada
      —hay quien se marea con las animaciones— y desatenderla provoca un daño
      inmediato que el visitante no puede prevenir. Un tema claro, como mucho,
      molesta hasta que lo cambia en dos clics.
    */
    tema: 'claro',
    escalaFuente: ESCALA_BASE,
    dislexia: false,
    espaciado: false,
    // Se parte del ajuste del sistema para que el interruptor refleje el
    // estado real desde el principio.
    movimiento: prefiereMenosMovimiento ? 'reducido' : 'normal',
    enlaces: false,
  };
}

function leerPreferencias(): Preferencias {
  const base = preferenciasPorDefecto();
  try {
    const guardadas = JSON.parse(localStorage.getItem(CLAVE) || '{}');
    return { ...base, ...guardadas };
  } catch {
    return base;
  }
}

/** Proyecta las preferencias sobre <html>. */
function aplicar(p: Preferencias) {
  const raiz = document.documentElement;

  raiz.classList.toggle('dark', p.tema === 'oscuro');
  if (p.tema === 'alto-contraste') raiz.dataset.contraste = 'alto';
  else delete raiz.dataset.contraste;

  raiz.style.setProperty('--a11y-escala-fuente', String(p.escalaFuente));

  if (p.dislexia) raiz.dataset.dislexia = 'true';
  else delete raiz.dataset.dislexia;

  if (p.espaciado) raiz.dataset.espaciado = 'amplio';
  else delete raiz.dataset.espaciado;

  raiz.dataset.movimiento = p.movimiento;

  if (p.enlaces) raiz.dataset.enlaces = 'destacados';
  else delete raiz.dataset.enlaces;
}

export default function AccessibilityWidget() {
  const [abierto, setAbierto] = useState(false);
  const [prefs, setPrefs] = useState<Preferencias>(preferenciasPorDefecto);
  const [anuncio, setAnuncio] = useState('');
  const disparadorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const montado = useRef(false);

  // Carga inicial desde localStorage (sólo en cliente).
  useEffect(() => {
    const guardadas = leerPreferencias();
    setPrefs(guardadas);
    aplicar(guardadas);
    montado.current = true;
  }, []);

  // Persiste y aplica en cada cambio posterior.
  useEffect(() => {
    if (!montado.current) return;
    aplicar(prefs);
    try {
      localStorage.setItem(CLAVE, JSON.stringify(prefs));
    } catch {
      /* Modo privado o almacenamiento lleno: los cambios sólo duran la sesión. */
    }
  }, [prefs]);

  const cerrar = useCallback((devolverFoco = true) => {
    setAbierto(false);
    if (devolverFoco) disparadorRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!abierto) return;

    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cerrar();
      }
    };
    const fuera = (e: Event) => {
      const destino = e.target as Node;
      if (
        !panelRef.current?.contains(destino) &&
        !disparadorRef.current?.contains(destino)
      ) {
        cerrar(false);
      }
    };

    document.addEventListener('keydown', alPulsar);
    document.addEventListener('pointerdown', fuera);
    // Al abrir, el foco entra al panel para que los lectores de pantalla
    // anuncien su contenido.
    requestAnimationFrame(() => panelRef.current?.focus());

    return () => {
      document.removeEventListener('keydown', alPulsar);
      document.removeEventListener('pointerdown', fuera);
    };
  }, [abierto, cerrar]);

  const actualizar = (cambio: Partial<Preferencias>) =>
    setPrefs((actual) => ({ ...actual, ...cambio }));

  const cambiarEscala = (direccion: 1 | -1) => {
    const indice = ESCALAS.indexOf(prefs.escalaFuente);
    const base = indice === -1 ? ESCALAS.indexOf(ESCALA_BASE) : indice;
    const siguiente = Math.min(Math.max(base + direccion, 0), ESCALAS.length - 1);
    const escala = ESCALAS[siguiente];
    actualizar({ escalaFuente: escala });
    setAnuncio(`Tamaño de texto: ${Math.round(escala * 100)} por ciento`);
  };

  const restablecer = () => {
    const base = preferenciasPorDefecto();
    setPrefs(base);
    setAnuncio('Preferencias de accesibilidad restablecidas');
  };

  const porcentaje = Math.round(prefs.escalaFuente * 100);

  return (
    <>
      <button
        type="button"
        ref={disparadorRef}
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-controls="panel-accesibilidad"
        className="fixed bottom-5 right-5 z-[90] flex size-14 items-center justify-center
                   rounded-full bg-comunidad-700 text-white shadow-xl transition-transform
                   hover:scale-105 hover:bg-comunidad-800 focus-visible:scale-105"
      >
        <Accessibility aria-hidden="true" className="size-7" />
        <span className="sr-only">Opciones de accesibilidad</span>
      </button>

      {abierto && (
        <div
          id="panel-accesibilidad"
          ref={panelRef}
          tabIndex={-1}
          role="group"
          aria-labelledby="titulo-accesibilidad"
          data-superficie
          /*
            `dark:bg-slate-950` pisa a propósito el `dark:bg-slate-900/60` que trae
            `.tarjeta`. Ese 60 % está bien en una tarjeta, que se apoya sobre el
            fondo liso de la página y no deja ver nada detrás; aquí no, porque el
            panel flota sobre el contenido y en oscuro se transparentaba el texto
            de debajo. En móvil se nota más porque ocupa casi todo el ancho.

            Opaco y `slate-950`, que es el mismo fondo del panel del Mega Menú: es
            la otra superficie flotante del sitio y no hay motivo para que las dos
            se vean distintas.

            La utilidad le gana a `.tarjeta` sin `!` porque ésta vive en
            `@layer components` y las utilidades van en una capa posterior. Nada de
            `!` aquí: rompería el modo de alto contraste (MARCA.md, regla 1).
          */
          className="tarjeta fixed bottom-24 right-5 z-[95] w-[min(22rem,calc(100vw-2.5rem))]
                     max-h-[min(34rem,calc(100vh-8rem))] overflow-y-auto p-6 shadow-2xl
                     dark:bg-slate-950"
        >
          <div className="flex items-start justify-between gap-4">
            <h2
              id="titulo-accesibilidad"
              className="font-display text-lg font-bold text-slate-900 dark:text-white"
            >
              Accesibilidad
            </h2>
            <button
              type="button"
              onClick={() => cerrar()}
              className="-mr-1.5 -mt-1 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100
                         dark:hover:bg-slate-800"
            >
              <X aria-hidden="true" className="size-5" />
              <span className="sr-only">Cerrar opciones de accesibilidad</span>
            </button>
          </div>

          {/* Tema */}
          <fieldset className="mt-6">
            <legend className="eyebrow">Tema</legend>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {TEMAS.map(({ valor, etiqueta, Icono }) => (
                <label
                  key={valor}
                  className="flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border
                             border-slate-200 p-3 text-center text-xs font-medium text-slate-700
                             transition-colors has-checked:border-comunidad-600 has-checked:bg-comunidad-50
                             has-checked:text-comunidad-800 dark:border-slate-700 dark:text-slate-300
                             dark:has-checked:border-cosecha-400 dark:has-checked:bg-slate-800
                             dark:has-checked:text-white"
                >
                  <input
                    type="radio"
                    name="tema"
                    value={valor}
                    checked={prefs.tema === valor}
                    onChange={() => actualizar({ tema: valor })}
                    className="sr-only"
                  />
                  <Icono aria-hidden="true" className="size-5" />
                  {etiqueta}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Tamaño del texto */}
          <div className="mt-6">
            <p className="eyebrow" id="etiqueta-tamano">
              Tamaño del texto
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => cambiarEscala(-1)}
                disabled={prefs.escalaFuente <= ESCALAS[0]}
                className="grid size-11 place-items-center rounded-xl border border-slate-200
                           text-slate-700 hover:bg-slate-50 disabled:opacity-40
                           dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Minus aria-hidden="true" className="size-4" />
                <span className="sr-only">Reducir tamaño del texto</span>
              </button>

              <p
                className="flex-1 text-center text-sm font-semibold tabular-nums
                           text-slate-900 dark:text-white"
                aria-describedby="etiqueta-tamano"
              >
                {porcentaje}%
              </p>

              <button
                type="button"
                onClick={() => cambiarEscala(1)}
                disabled={prefs.escalaFuente >= ESCALAS[ESCALAS.length - 1]}
                className="grid size-11 place-items-center rounded-xl border border-slate-200
                           text-slate-700 hover:bg-slate-50 disabled:opacity-40
                           dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Plus aria-hidden="true" className="size-4" />
                <span className="sr-only">Aumentar tamaño del texto</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  actualizar({ escalaFuente: ESCALA_BASE });
                  setAnuncio('Tamaño de texto restablecido al 100 por ciento');
                }}
                className="grid size-11 place-items-center rounded-xl border border-slate-200
                           text-slate-700 hover:bg-slate-50 dark:border-slate-700
                           dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <RotateCcw aria-hidden="true" className="size-4" />
                <span className="sr-only">Restablecer tamaño del texto</span>
              </button>
            </div>
          </div>

          {/* Interruptores de legibilidad */}
          <div className="mt-6 space-y-1">
            <p className="eyebrow">Lectura y navegación</p>
            <div className="mt-3 space-y-1">
              <Interruptor
                Icono={Type}
                etiqueta="Fuente para dislexia"
                descripcion="Tipografía de trazos diferenciados"
                activo={prefs.dislexia}
                alCambiar={(v) => actualizar({ dislexia: v })}
              />
              <Interruptor
                Icono={MoveVertical}
                etiqueta="Espaciado ampliado"
                descripcion="Más aire entre letras, líneas y párrafos"
                activo={prefs.espaciado}
                alCambiar={(v) => actualizar({ espaciado: v })}
              />
              <Interruptor
                Icono={Waves}
                etiqueta="Reducir animaciones"
                descripcion="Desactiva transiciones y desplazamiento suave"
                activo={prefs.movimiento === 'reducido'}
                alCambiar={(v) => actualizar({ movimiento: v ? 'reducido' : 'normal' })}
              />
              <Interruptor
                Icono={Link2}
                etiqueta="Destacar enlaces"
                descripcion="Resalta y subraya todos los hipervínculos"
                activo={prefs.enlaces}
                alCambiar={(v) => actualizar({ enlaces: v })}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={restablecer}
            className="mt-6 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm
                       font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700
                       dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Restablecer todo
          </button>

          {/* Anuncia los cambios que no son evidentes para un lector de pantalla. */}
          <p role="status" aria-live="polite" className="sr-only">
            {anuncio}
          </p>
        </div>
      )}
    </>
  );
}

interface PropsInterruptor {
  Icono: typeof Type;
  etiqueta: string;
  descripcion: string;
  activo: boolean;
  alCambiar: (valor: boolean) => void;
}

/** Casilla nativa con apariencia de interruptor: sin ARIA que pueda fallar. */
function Interruptor({ Icono, etiqueta, descripcion, activo, alCambiar }: PropsInterruptor) {
  return (
    <label
      className="flex cursor-pointer items-start gap-3 rounded-2xl p-3 transition-colors
                 hover:bg-slate-50 dark:hover:bg-slate-800/60"
    >
      <input
        type="checkbox"
        checked={activo}
        onChange={(e) => alCambiar(e.target.checked)}
        className="peer sr-only"
      />

      <Icono
        aria-hidden="true"
        className="mt-0.5 size-5 shrink-0 text-slate-500 peer-checked:text-comunidad-700
                   dark:peer-checked:text-cosecha-400"
      />

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-900 dark:text-white">
          {etiqueta}
        </span>
        <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-400">
          {descripcion}
        </span>
      </span>

      <span
        aria-hidden="true"
        data-interruptor
        className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-slate-300
                   transition-colors peer-checked:bg-comunidad-600 peer-focus-visible:outline-2
                   peer-focus-visible:outline-offset-2 peer-focus-visible:outline-cosecha-600
                   after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full
                   after:bg-white after:transition-transform after:content-['']
                   peer-checked:after:translate-x-5 dark:bg-slate-600
                   dark:peer-checked:bg-cosecha-500"
      />
    </label>
  );
}
