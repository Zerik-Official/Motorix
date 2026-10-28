import { LuClipboardList, LuShieldCheck, LuWrench } from "react-icons/lu";
import { Link } from "react-router";

import { buttonVariants } from "@/components/ui/Button";
import { BrandMark } from "@shared/components/BrandMark";
import { REPAIR_STATUS_HINTS, REPAIR_STATUS_LABELS, REPAIR_STATUSES, stageColor } from "@shared/domain/repair-status";
import { useDocumentTitle } from "@shared/hooks/useDocumentTitle";
import { useSession } from "@shared/session/useSession";
import { ThemeToggle } from "@shared/theme/ThemeToggle";

import { BayRoute } from "./components/BayRoute";

/**
 * What each person of the workshop gets from Motorix.
 */
const ROLES_IN_THE_SHOP = [
  {
    icon: LuClipboardList,
    title: "Recepción",
    text: "Registra al cliente y su motor una sola vez. Cada orden nueva toma el dueño del motor, sin volver a escribirlo.",
  },
  {
    icon: LuWrench,
    title: "Técnicos",
    text: "Mueven la orden de etapa al terminar su parte. El historial guarda quién hizo cada cambio y cuándo.",
  },
  {
    icon: LuShieldCheck,
    title: "Jefe de taller",
    text: "Ve cuántos motores hay en cada bahía y decide qué puede hacer cada rol, sin depender de nadie más.",
  },
];

/**
 * Public home of Motorix: what the platform does for a heavy mining engine workshop, the route
 * an engine follows, and the way in for the staff.
 *
 * @returns The page.
 */
export function LandingPage() {
  useDocumentTitle(null);
  const { status } = useSession();
  const signedIn: boolean = status === "authenticated";
  const entry = signedIn ? { to: "/app", label: "Ir al tablero" } : { to: "/login", label: "Iniciar sesión" };

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-accent px-3 py-2 font-semibold text-accent-fg focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Saltar al contenido
      </a>
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <BrandMark />
        <nav aria-label="Principal" className="flex items-center gap-1.5">
          <a href="#recorrido" className="hidden rounded-md px-3 py-2 text-sm font-medium text-fg-muted no-underline hover:text-fg sm:block">
            Cómo funciona
          </a>
          <ThemeToggle />
          <Link to={entry.to} className={buttonVariants({ variant: "outline", size: "sm" })}>
            {entry.label}
          </Link>
        </nav>
      </header>

      <main id="main" tabIndex={-1} className="outline-none">
        <section
          aria-labelledby="hero-title"
          className="mx-auto grid max-w-6xl gap-12 px-5 pt-12 pb-20 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:items-end lg:pt-20"
        >
          <div>
            <p className="mb-4 text-sm font-semibold text-fg-subtle">Taller de motores de minería pesada</p>
            <h1 id="hero-title" className="font-wide text-4xl leading-[1.05] font-extrabold text-fg sm:text-5xl lg:text-6xl">
              Cada motor, en qué bahía está y quién lo movió.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-fg-muted">
              Motorix sigue cada motor desde que entra al muelle hasta que el cliente lo retira: clientes, motores, órdenes de
              reparación y el historial completo de cada una.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={entry.to} className={buttonVariants({ size: "lg" })}>
                {entry.label}
              </Link>
              <a href="#recorrido" className={buttonVariants({ variant: "outline", size: "lg" })}>
                Ver el recorrido
              </a>
            </div>
          </div>
          <div className="rounded-lg border border-line bg-panel p-5 sm:p-7">
            <p className="mb-6 text-sm font-semibold text-fg">Recorrido de un motor por el taller</p>
            <BayRoute />
          </div>
        </section>

        <section aria-labelledby="roles-title" className="border-y border-line bg-panel">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
            <h2 id="roles-title" className="max-w-2xl font-wide text-2xl font-bold text-fg sm:text-3xl">
              Un mismo registro para recepción, técnicos y jefatura.
            </h2>
            <ul className="mt-10 grid gap-10 md:grid-cols-3 md:gap-8">
              {ROLES_IN_THE_SHOP.map((role) => (
                <li key={role.title} className="border-l-2 border-line-strong pl-5">
                  <role.icon aria-hidden className="size-6 text-fg" />
                  <h3 className="mt-3 font-wide text-lg font-semibold text-fg">{role.title}</h3>
                  <p className="mt-2 text-fg-muted">{role.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="recorrido" aria-labelledby="route-title" className="mx-auto max-w-6xl scroll-mt-6 px-5 py-20 sm:px-8">
          <h2 id="route-title" className="font-wide text-2xl font-bold text-fg sm:text-3xl">
            Siete etapas, en el orden del taller.
          </h2>
          <p className="mt-3 max-w-2xl text-fg-muted">
            Una orden avanza cuando el técnico termina su parte. Si hay que corregir, puede volver a una etapa anterior; el
            historial lo deja anotado.
          </p>
          <ol className="mt-10 divide-y divide-line border-y border-line">
            {REPAIR_STATUSES.map((stage, index) => (
              <li
                key={stage}
                className="grid grid-cols-[2.5rem_1fr] items-baseline gap-x-4 gap-y-1 py-4 sm:grid-cols-[3rem_16rem_1fr]"
              >
                <span className="font-wide text-2xl font-bold text-fg-faint tabular">{index + 1}</span>
                <span className="flex items-center gap-2.5 font-wide text-lg font-semibold text-fg">
                  <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: stageColor(stage) }} />
                  {REPAIR_STATUS_LABELS[stage]}
                </span>
                <span className="col-start-2 text-fg-muted sm:col-start-3">{REPAIR_STATUS_HINTS[stage]}</span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="access-title" className="bg-(--graphite) text-[#e6ebeb]">
          <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-16 sm:px-8 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <h2 id="access-title" className="font-wide text-2xl font-bold sm:text-3xl">
                Cada quien ve lo que le toca.
              </h2>
              <p className="mt-3 text-[#b3bec2]">
                El jefe de taller decide qué puede consultar o modificar cada rol. Las cuentas las crea un administrador, y una
                cuenta desactivada pierde el acceso al instante.
              </p>
            </div>
            <Link to={entry.to} className={buttonVariants({ size: "lg" })}>
              {entry.label}
            </Link>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-8 text-sm text-fg-subtle sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <BrandMark />
        <p>Plataforma interna del taller. El acceso es solo para el personal autorizado.</p>
      </footer>
    </div>
  );
}
