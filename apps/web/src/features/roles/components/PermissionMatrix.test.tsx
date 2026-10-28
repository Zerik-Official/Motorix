import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Permission } from "@shared/session/types";

import type { RolePermissions } from "../api";
import { PermissionMatrix } from "./PermissionMatrix";

/**
 * Roles as an administrator sees them: only `user` can be changed.
 */
const ROLES: RolePermissions[] = [
  { role: "root", permissions: ["clients:read", "clients:write"], editable: false },
  { role: "admin", permissions: ["clients:read", "clients:write"], editable: false },
  { role: "user", permissions: ["clients:read"], editable: true },
];

/**
 * Permissions held by the administrator in these tests.
 */
const HELD: Permission[] = ["clients:read"];

describe("PermissionMatrix", () => {
  it("only enables the permissions the account holds on roles below it", () => {
    render(<PermissionMatrix catalog={["clients:read", "clients:write"]} roles={ROLES} holds={(permission) => HELD.includes(permission)} pending={null} onToggle={vi.fn()} />);

    expect(screen.getByRole("checkbox", { name: "Ver clientes: Operativo" })).not.toHaveAttribute("aria-disabled");
    expect(screen.getByRole("checkbox", { name: "Registrar, editar y desactivar clientes: Operativo" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("checkbox", { name: "Ver clientes: Administrador" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("checkbox", { name: "Ver clientes: Superadministrador" })).toBeChecked();
  });

  it("revokes a granted permission when it is unchecked", async () => {
    const onToggle = vi.fn();
    render(<PermissionMatrix catalog={["clients:read"]} roles={ROLES} holds={() => true} pending={null} onToggle={onToggle} />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Ver clientes: Operativo" }));
    expect(onToggle).toHaveBeenCalledWith("user", "clients:read", false);
  });

  it("locks every cell while one is saving", () => {
    render(<PermissionMatrix catalog={["clients:read", "clients:write"]} roles={ROLES} holds={() => true} pending="user:clients:read" onToggle={vi.fn()} />);
    expect(screen.getByLabelText("Guardando")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Registrar, editar y desactivar clientes: Operativo" })).toHaveAttribute("aria-disabled", "true");
  });
});
