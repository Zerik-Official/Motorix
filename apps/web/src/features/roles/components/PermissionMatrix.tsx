import { LuLoaderCircle } from "react-icons/lu";

import { Checkbox } from "@/components/ui/Checkbox";
import { PERMISSION_LABELS } from "@shared/domain/permissions";
import { ROLE_LABELS } from "@shared/session/roles";
import type { Permission, Role } from "@shared/session/types";

import { cellKey, type RolePermissions } from "../api";

/**
 * Props of {@link PermissionMatrix}.
 */
interface PermissionMatrixProps {
  /** Permissions of the catalog, one per row. */
  catalog: Permission[];
  /** Roles, one per column, from the most to the least privileged. */
  roles: RolePermissions[];
  /** Tells whether the signed in account holds a permission, the only ones it may grant or revoke. */
  holds: (permission: Permission) => boolean;
  /** Cell being saved, as `role:permission`, if any. */
  pending: string | null;
  /** Grants or revokes a permission of a role. */
  onToggle: (role: Role, permission: Permission, granted: boolean) => void;
}

/**
 * Permissions of the catalog against the roles, with a checkbox per pair. A checkbox can only
 * change when the role is below the signed in one and the signed in account holds the
 * permission itself; `root` always holds everything.
 *
 * @param props - Catalog, roles, held permissions, pending cell and toggle callback.
 * @returns The matrix.
 */
export function PermissionMatrix({ catalog, roles, holds, pending, onToggle }: PermissionMatrixProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-panel">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Permisos de cada rol</caption>
        <thead>
          <tr className="border-b border-line bg-raised/50 text-left text-xs text-fg-subtle">
            <th scope="col" className="px-4 py-2.5 font-medium">Permiso</th>
            {roles.map((entry) => (
              <th key={entry.role} scope="col" className="px-3 py-2.5 text-center font-medium">
                {ROLE_LABELS[entry.role]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {catalog.map((permission) => (
            <tr key={permission} className="border-b border-line last:border-b-0">
              <th scope="row" className="px-4 py-3 text-left font-normal text-fg">
                {PERMISSION_LABELS[permission]}
              </th>
              {roles.map((entry) => {
                const key: string = cellKey(entry.role, permission);
                const granted: boolean = entry.permissions.includes(permission);
                const changeable: boolean = entry.editable && holds(permission);
                return (
                  <td key={key} className="px-3 py-3 text-center">
                    <span className="inline-flex size-6 items-center justify-center">
                      {pending === key ? (
                        <LuLoaderCircle aria-label="Guardando" className="size-4 animate-spin text-fg-subtle" />
                      ) : (
                        <Checkbox
                          checked={granted}
                          disabled={!changeable || pending !== null}
                          onCheckedChange={(checked) => onToggle(entry.role, permission, checked)}
                          aria-label={`${PERMISSION_LABELS[permission]}: ${ROLE_LABELS[entry.role]}`}
                        />
                      )}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
