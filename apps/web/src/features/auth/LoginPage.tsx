import { Link, Navigate, useLocation, useNavigate } from "react-router";

import { BrandMark } from "@shared/components/BrandMark";
import { REPAIR_STATUS_LABELS, REPAIR_STATUSES, stageColor } from "@shared/domain/repair-status";
import { useDocumentTitle } from "@shared/hooks/useDocumentTitle";
import { useSession } from "@shared/session/useSession";
import { ThemeToggle } from "@shared/theme/ThemeToggle";

import { LoginForm } from "./components/LoginForm";

/**
 * Reads the page a person tried to open before being sent to the login.
 *
 * @param state - Navigation state set by the protected route.
 * @returns A path inside the app, never an external URL.
 */
function nextPath(state: unknown): string {
  const from: unknown = (state as { from?: unknown } | null)?.from;
  return typeof from === "string" && from.startsWith("/app") ? from : "/app";
}

/**
 * Login of the staff: the form on one side and, on wide screens, the seven bays the
 * workshop moves engines through.
 *
 * @returns The page.
 */
export function LoginPage() {
  useDocumentTitle("Entrar");
  const { status } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const target: string = nextPath(location.state);

  if (status === "authenticated") {
    return <Navigate to={target} replace />;
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <main className="flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Link to="/" aria-label="Volver al inicio de Motorix" className="rounded-md">
            <BrandMark />
          </Link>
          <ThemeToggle />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="font-wide text-3xl font-bold text-fg">Entrar al taller</h1>
          <p className="mt-2 mb-8 text-fg-muted">Usa el correo y la contraseña que te dio el administrador del taller.</p>
          <LoginForm onSuccess={() => navigate(target, { replace: true })} />
          <p className="mt-8 text-sm text-fg-subtle">
            ¿No tienes cuenta? Las cuentas las crea un administrador; pídele acceso a tu jefe de taller.
          </p>
        </div>
      </main>

      <aside aria-hidden className="relative hidden overflow-hidden bg-(--graphite) p-12 text-[#e6ebeb] lg:flex lg:flex-col lg:justify-end">
        <ol className="flex flex-col gap-3">
          {REPAIR_STATUSES.map((stage, index) => (
            <li key={stage} className="flex items-center gap-4">
              <span className="w-6 text-right text-sm text-[#8e9a9f] tabular">{index + 1}</span>
              <span className="h-2 flex-1 rounded-full" style={{ backgroundColor: stageColor(stage), opacity: 0.35 + index * 0.09 }} />
              <span className="w-48 font-wide text-lg font-semibold">{REPAIR_STATUS_LABELS[stage]}</span>
            </li>
          ))}
        </ol>
        <p className="mt-10 max-w-md font-wide text-2xl leading-snug font-semibold">
          Del muelle de recepción a la entrega, cada motor deja rastro de quién lo movió y cuándo.
        </p>
      </aside>
    </div>
  );
}
