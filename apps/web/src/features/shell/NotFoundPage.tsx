import { Link } from "react-router";

import { buttonVariants } from "@/components/ui/Button";
import { BrandMark } from "@shared/components/BrandMark";
import { useDocumentTitle } from "@shared/hooks/useDocumentTitle";

/**
 * Page of any address that does not exist.
 *
 * @returns The page.
 */
export function NotFoundPage() {
  useDocumentTitle("Página no encontrada");
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 px-5">
      <BrandMark />
      <h1 className="font-wide text-4xl font-bold text-fg">Esta bahía está vacía</h1>
      <p className="text-fg-muted">La dirección que abriste no existe o cambió. Vuelve al inicio para seguir.</p>
      <div className="flex flex-wrap gap-2">
        <Link to="/" className={buttonVariants({ variant: "default" })}>
          Ir al inicio
        </Link>
        <Link to="/app" className={buttonVariants({ variant: "outline" })}>
          Ir al tablero
        </Link>
      </div>
    </main>
  );
}
