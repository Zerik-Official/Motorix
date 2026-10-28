import { useState } from "react";

import { Skeleton } from "@/components/ui/Skeleton";
import { toApiError } from "@shared/api/errors";
import { ErrorState } from "@shared/components/ErrorState";
import { PageHeader } from "@shared/components/PageHeader";
import { PERMISSION_LABELS } from "@shared/domain/permissions";
import { useToast } from "@shared/feedback/useToast";
import { useAsync } from "@shared/hooks/useAsync";
import { useDocumentTitle } from "@shared/hooks/useDocumentTitle";
import { ROLE_LABELS } from "@shared/session/roles";
import type { Permission, Role } from "@shared/session/types";
import { useSession } from "@shared/session/useSession";

import { cellKey, fetchRoles, setRolePermission, type RoleList, type RolePermissions } from "./api";
import { PermissionMatrix } from "./components/PermissionMatrix";

/**
 * Permissions of each role, granted or revoked one at a time. A role is only changed by a higher
 * one, and only with permissions the signed in account holds; auth-api checks the same rules.
 *
 * @returns The page.
 */
export function RolesPage() {
  useDocumentTitle("Permisos");
  const { can } = useSession();
  const { notify } = useToast();
  const loaded = useAsync<RoleList>(fetchRoles);
  const [changed, setChanged] = useState<Partial<Record<Role, RolePermissions>>>({});
  const [pending, setPending] = useState<string | null>(null);
  const roles: RolePermissions[] = loaded.data?.roles.map((entry) => changed[entry.role] ?? entry) ?? [];

  /**
   * Grants or revokes one permission and announces the result.
   *
   * @param role - Role to change.
   * @param permission - Permission to grant or revoke.
   * @param granted - True to grant it, false to revoke it.
   */
  const toggle = async (role: Role, permission: Permission, granted: boolean): Promise<void> => {
    setPending(cellKey(role, permission));
    try {
      const saved: RolePermissions = await setRolePermission(role, permission, granted);
      setChanged((previous) => ({ ...previous, [role]: saved }));
      notify({
        tone: "success",
        title: granted ? "Permiso otorgado" : "Permiso revocado",
        description: `${ROLE_LABELS[role]}: ${PERMISSION_LABELS[permission].toLowerCase()}.`,
      });
    } catch (caught: unknown) {
      notify({ tone: "error", title: "No se pudo cambiar el permiso", description: toApiError(caught).message });
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Permisos"
        description="Qué puede hacer cada rol. Solo cambias los roles inferiores al tuyo y solo con permisos que tú tienes."
      />

      <section aria-labelledby="roles-title" aria-busy={loaded.loading} className="flex flex-col gap-4">
        <h2 id="roles-title" className="sr-only">
          Permisos de cada rol
        </h2>
        {loaded.error ? (
          <ErrorState error={loaded.error} onRetry={loaded.reload} />
        ) : !loaded.data ? (
          <Skeleton className="h-96 w-full" />
        ) : (
          <>
            <PermissionMatrix catalog={loaded.data.catalog} roles={roles} holds={can} pending={pending} onToggle={toggle} />
            <p className="max-w-prose text-sm text-fg-subtle">
              El Superadministrador siempre tiene todos los permisos. Un cambio se aplica a las cuentas del rol en su próxima
              acción en usuarios y permisos, y en clientes, motores y órdenes cuando renuevan su sesión, en 15 minutos como máximo.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
