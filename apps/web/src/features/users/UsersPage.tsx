import { useCallback, useMemo, useState } from "react";
import { LuPlus } from "react-icons/lu";
import { useSearchParams } from "react-router";

import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { readActiveFilter, readPageNumber, type OffsetPage } from "@shared/api/pagination";
import { ConfirmModal } from "@shared/components/ConfirmModal";
import { ErrorState } from "@shared/components/ErrorState";
import { ListPagination } from "@shared/components/ListPagination";
import { PageHeader } from "@shared/components/PageHeader";
import { useToast } from "@shared/feedback/useToast";
import { useAsync } from "@shared/hooks/useAsync";
import { useDocumentTitle } from "@shared/hooks/useDocumentTitle";
import { outranks, ROLE_LABELS } from "@shared/session/roles";
import type { Role } from "@shared/session/types";
import { useSession } from "@shared/session/useSession";

import { fetchUsers, setUserActive, USER_PAGE_SIZE, type AssignableRole, type User, type UserFilters as Filters } from "./api";
import { UserFilters } from "./components/UserFilters";
import { UserFormModal } from "./components/UserFormModal";
import { UsersList } from "./components/UsersList";

/**
 * Roles that can be given to an account, from the most to the least privileged.
 */
const ASSIGNABLE_ROLES: AssignableRole[] = ["admin", "user"];

/**
 * Reads the role filter kept in the address.
 *
 * @param value - Value of the `rol` query parameter.
 * @returns The role, or nothing to keep every role.
 */
function readRole(value: string | null): Role | undefined {
  return value && value in ROLE_LABELS ? (value as Role) : undefined;
}

/**
 * Writes the filters and the page to a query string, leaving out the defaults.
 *
 * @param filters - Filters to keep.
 * @param page - Page to keep.
 * @returns The query string values.
 */
function writeParams(filters: Filters, page: number = 1): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.search) {
    params.q = filters.search;
  }
  if (filters.role) {
    params.rol = filters.role;
  }
  if (filters.active !== "active") {
    params.estado = filters.active;
  }
  if (page > 1) {
    params.pagina = String(page);
  }
  return params;
}

/**
 * What the form is doing: creating an account, editing one, or nothing.
 */
type FormState = { mode: "create" } | { mode: "edit"; user: User } | null;

/**
 * Administration of the accounts that sign in to the app: search, filters by role and state,
 * creation, editing, deactivation and reactivation. Each account only manages accounts of a
 * lower role, the same rule auth-api enforces.
 *
 * @returns The page.
 */
export function UsersPage() {
  useDocumentTitle("Usuarios");
  const { profile } = useSession();
  const { notify } = useToast();
  const [params, setParams] = useSearchParams();
  const [form, setForm] = useState<FormState>(null);
  const [deactivating, setDeactivating] = useState<User | null>(null);
  const callerRole: Role = profile?.role ?? "user";
  const roles: AssignableRole[] = ASSIGNABLE_ROLES.filter((role) => outranks(callerRole, role));
  const filters: Filters = useMemo(
    () => ({ search: params.get("q") || undefined, role: readRole(params.get("rol")), active: readActiveFilter(params.get("estado")) }),
    [params],
  );
  const page: number = readPageNumber(params.get("pagina"));
  const list = useAsync<OffsetPage<User>>(() => fetchUsers(filters, page), `${JSON.stringify(filters)}#${page}`);
  const filtered: boolean = Boolean(filters.search || filters.role) || filters.active !== "active";

  const changeFilters = useCallback((next: Filters) => setParams(writeParams(next), { replace: true }), [setParams]);

  /**
   * Moves to another page and back to the top of the list.
   *
   * @param next - Page to show.
   */
  const changePage = (next: number): void => {
    setParams(writeParams(filters, next));
    window.scrollTo({ top: 0 });
  };

  /**
   * Confirms the saved account and reloads the list.
   *
   * @param user - Created or edited account.
   */
  const handleSaved = (user: User): void => {
    const created: boolean = form?.mode === "create";
    setForm(null);
    notify({
      tone: "success",
      title: created ? "Cuenta creada" : "Cuenta actualizada",
      description: created ? `${user.full_name} ya puede iniciar sesión con ${user.email}.` : `Los datos de ${user.full_name} quedaron guardados.`,
    });
    list.reload();
  };

  /**
   * Reactivates an account and reloads the list.
   *
   * @param user - Account to reactivate.
   */
  const handleReactivate = async (user: User): Promise<void> => {
    await setUserActive(user, true);
    notify({ tone: "success", title: "Cuenta reactivada", description: `${user.full_name} ya puede volver a iniciar sesión.` });
    list.reload();
  };

  /**
   * Deactivates the account waiting for confirmation and reloads the list.
   */
  const handleDeactivate = async (): Promise<void> => {
    if (!deactivating) {
      return;
    }
    await setUserActive(deactivating, false);
    notify({ tone: "success", title: "Cuenta desactivada", description: `${deactivating.full_name} ya no puede iniciar sesión.` });
    list.reload();
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Usuarios"
        description={`Cuentas que entran a Motorix. Como ${ROLE_LABELS[callerRole].toLowerCase()} administras las de rol inferior al tuyo.`}
        actions={
          roles.length > 0 && (
            <Button onClick={() => setForm({ mode: "create" })} data-tour="new-user">
              <LuPlus aria-hidden />
              Nueva cuenta
            </Button>
          )
        }
      />

      <UserFilters filters={filters} onChange={changeFilters} />

      <section aria-labelledby="users-results" aria-busy={list.loading} className="flex flex-col gap-4">
        <h2 id="users-results" className="sr-only">
          Resultados
        </h2>
        {list.error ? (
          <ErrorState error={list.error} onRetry={list.reload} />
        ) : !list.data ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-14 w-full" />
            ))}
          </div>
        ) : list.data.items.length === 0 ? (
          <p className="rounded-md border border-dashed border-line-strong p-8 text-center text-fg-muted">
            {filtered || page > 1 ? "Ninguna cuenta coincide con la búsqueda. Prueba con otros filtros o límpialos." : "Todavía no hay cuentas además de la tuya."}
          </p>
        ) : (
          <>
            <p className="text-sm text-fg-subtle" role="status">
              {list.data.total} {list.data.total === 1 ? "cuenta" : "cuentas"}
              {list.data.total > USER_PAGE_SIZE && `, página ${page} de ${Math.ceil(list.data.total / USER_PAGE_SIZE)}`}.
            </p>
            <div className={list.loading ? "opacity-60 transition-opacity" : undefined}>
              <UsersList
                users={list.data.items}
                callerRole={callerRole}
                onEdit={(user) => setForm({ mode: "edit", user })}
                onDeactivate={setDeactivating}
                onReactivate={handleReactivate}
              />
            </div>
            <ListPagination page={page} total={list.data.total} pageSize={USER_PAGE_SIZE} onChange={changePage} />
          </>
        )}
      </section>

      {form && <UserFormModal user={form.mode === "edit" ? form.user : undefined} roles={roles} onClose={() => setForm(null)} onSaved={handleSaved} />}
      <ConfirmModal
        open={deactivating !== null}
        onClose={() => setDeactivating(null)}
        title={`¿Desactivar a ${deactivating?.full_name ?? ""}?`}
        confirmLabel="Desactivar"
        pendingLabel="Desactivando..."
        onConfirm={handleDeactivate}
      >
        <p>No podrá iniciar sesión y se cerrarán todas sus sesiones abiertas. Lo que registró se conserva.</p>
        <p>Puedes reactivarla después desde esta misma lista.</p>
      </ConfirmModal>
    </div>
  );
}
