import { LuBan, LuPencil } from "react-icons/lu";

import { Button } from "@/components/ui/Button";
import { ActiveBadge } from "@shared/components/ActiveBadge";
import { ReactivateButton } from "@shared/components/ReactivateButton";
import { formatDate } from "@shared/format";
import { outranks, ROLE_LABELS } from "@shared/session/roles";
import type { Role } from "@shared/session/types";

import type { User } from "../api";

/**
 * Props of {@link UsersList}.
 */
interface UsersListProps {
  /** Accounts to list. */
  users: User[];
  /** Role of the signed in account; only lower roles get actions. */
  callerRole: Role;
  /** Opens the edit form of an account. */
  onEdit: (user: User) => void;
  /** Asks to deactivate an account. */
  onDeactivate: (user: User) => void;
  /** Reactivates an account. */
  onReactivate: (user: User) => Promise<void>;
}

/**
 * Props of {@link UserActions}.
 */
interface UserActionsProps extends Omit<UsersListProps, "users" | "callerRole"> {
  /** Account the actions apply to. */
  user: User;
}

/**
 * Edit and deactivate or reactivate buttons of one account.
 *
 * @param props - Account and action callbacks.
 * @returns The buttons.
 */
function UserActions({ user, onEdit, onDeactivate, onReactivate }: UserActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={() => onEdit(user)} aria-label={`Editar a ${user.full_name}`}>
        <LuPencil aria-hidden />
        Editar
      </Button>
      {user.is_active ? (
        <Button variant="destructive" size="sm" onClick={() => onDeactivate(user)} aria-label={`Desactivar a ${user.full_name}`}>
          <LuBan aria-hidden />
          Desactivar
        </Button>
      ) : (
        <ReactivateButton size="sm" onReactivate={() => onReactivate(user)} aria-label={`Reactivar a ${user.full_name}`} />
      )}
    </div>
  );
}

/**
 * Accounts as a table on wide screens and as cards on phones. Only accounts of a role below the
 * signed in one can be edited, deactivated or reactivated; the rest show why.
 *
 * @param props - Accounts, role of the signed in account and action callbacks.
 * @returns The list.
 */
export function UsersList({ users, callerRole, ...actions }: UsersListProps) {
  const locked = (user: User): string => (user.role === "root" ? "Cuenta del sistema" : "Rol igual o superior al tuyo");

  return (
    <>
      <div className="hidden overflow-hidden rounded-lg border border-line bg-panel md:block">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Cuentas</caption>
          <thead>
            <tr className="border-b border-line bg-raised/50 text-left text-xs text-fg-subtle">
              <th scope="col" className="px-4 py-2.5 font-medium">Persona</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Rol</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Creada</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Estado</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-line last:border-b-0 hover:bg-raised/40">
                <td className="px-4 py-3">
                  <span className="block font-semibold text-fg">{user.full_name}</span>
                  <span className="block text-xs text-fg-subtle">{user.email}</span>
                </td>
                <td className="px-4 py-3 text-fg-muted">{ROLE_LABELS[user.role]}</td>
                <td className="px-4 py-3 whitespace-nowrap text-fg-muted tabular">{formatDate(user.created_at)}</td>
                <td className="px-4 py-3">
                  <ActiveBadge active={user.is_active} />
                </td>
                <td className="px-4 py-3">
                  {outranks(callerRole, user.role) ? <UserActions user={user} {...actions} /> : <span className="text-xs text-fg-faint">{locked(user)}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-2 md:hidden" aria-label="Cuentas">
        {users.map((user) => (
          <li key={user.id} className="flex flex-col gap-3 rounded-md border border-line bg-panel p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold wrap-break-word text-fg">{user.full_name}</p>
                <p className="truncate text-sm text-fg-subtle">{user.email}</p>
                <p className="text-sm text-fg-muted">{ROLE_LABELS[user.role]}</p>
              </div>
              <ActiveBadge active={user.is_active} />
            </div>
            {outranks(callerRole, user.role) ? <UserActions user={user} {...actions} /> : <p className="text-xs text-fg-faint">{locked(user)}</p>}
          </li>
        ))}
      </ul>
    </>
  );
}
