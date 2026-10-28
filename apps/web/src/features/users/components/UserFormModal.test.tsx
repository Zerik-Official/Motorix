import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@shared/api/errors";

import type { User } from "../api";
import { UserFormModal } from "./UserFormModal";

const createUser = vi.fn();
const updateUser = vi.fn();

vi.mock("../api", () => ({
  createUser: (...args: unknown[]) => createUser(...args),
  updateUser: (...args: unknown[]) => updateUser(...args),
}));

/**
 * Builds an operative account.
 *
 * @returns The account.
 */
function user(): User {
  return {
    id: "user-id",
    email: "ana@taller.com",
    full_name: "Ana Torres",
    role: "user",
    is_active: true,
    created_at: "2026-10-28T10:00:00Z",
    updated_at: "2026-10-28T10:00:00Z",
  };
}

beforeEach(() => {
  createUser.mockReset();
  updateUser.mockReset();
});

describe("UserFormModal", () => {
  it("asks for every field of a new account without calling the API", async () => {
    render(<UserFormModal roles={["admin", "user"]} onClose={vi.fn()} onSaved={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/^Correo/), "ana");
    await userEvent.type(screen.getByLabelText(/^Contraseña/), "corta");
    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(screen.getByLabelText(/Nombre completo/)).toHaveAccessibleDescription("Escribe el nombre de la persona.");
    expect(screen.getByLabelText(/^Correo/)).toHaveAccessibleDescription("Escribe un correo válido, como nombre@taller.com.");
    expect(screen.getByLabelText(/^Contraseña/)).toHaveAccessibleDescription("Usa al menos 8 caracteres.");
    expect(createUser).not.toHaveBeenCalled();
  });

  it("creates an operative account by default", async () => {
    createUser.mockResolvedValue(user());
    const onSaved = vi.fn();
    render(<UserFormModal roles={["admin", "user"]} onClose={vi.fn()} onSaved={onSaved} />);
    expect(screen.getByRole("combobox", { name: /Rol/ })).toHaveTextContent("Operativo");
    await userEvent.type(screen.getByLabelText(/Nombre completo/), " Ana Torres ");
    await userEvent.type(screen.getByLabelText(/^Correo/), "ana@taller.com");
    await userEvent.type(screen.getByLabelText(/^Contraseña/), "segura-123");
    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(user()));
    expect(createUser).toHaveBeenCalledWith({ full_name: "Ana Torres", email: "ana@taller.com", role: "user", password: "segura-123" });
  });

  it("keeps the password when editing with it empty and points a taken email to its field", async () => {
    updateUser.mockRejectedValue(new ApiError(409, "conflict", "Ya existe un registro con esos datos."));
    render(<UserFormModal user={user()} roles={["user"]} onClose={vi.fn()} onSaved={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(screen.getByLabelText(/^Correo/)).toHaveAccessibleDescription("Ya hay una cuenta con ese correo."));
    expect(updateUser).toHaveBeenCalledWith("user-id", {
      full_name: "Ana Torres",
      email: "ana@taller.com",
      role: "user",
      is_active: true,
      password: undefined,
    });
  });
});
