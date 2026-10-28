import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@shared/api/errors";

import type { Client } from "../api";
import { ClientFormModal } from "./ClientFormModal";

const createClient = vi.fn();
const updateClient = vi.fn();

vi.mock("../api", () => ({
  createClient: (...args: unknown[]) => createClient(...args),
  updateClient: (...args: unknown[]) => updateClient(...args),
}));

/**
 * Builds a registered client.
 *
 * @returns The client.
 */
function client(): Client {
  return {
    id: "client-id",
    name: "Minera El Roble",
    identification_type: "nit",
    identification_number: "900222333-1",
    email: "compras@roble.com",
    is_active: true,
    created_at: "2026-10-28T10:00:00Z",
    updated_at: "2026-10-28T10:00:00Z",
  };
}

beforeEach(() => {
  createClient.mockReset();
  updateClient.mockReset();
});

describe("ClientFormModal", () => {
  it("explains every invalid field without calling the API", async () => {
    render(<ClientFormModal onClose={vi.fn()} onSaved={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/Número de identificación/), "900.222");
    await userEvent.type(screen.getByLabelText(/Correo de contacto/), "compras");
    await userEvent.click(screen.getByRole("button", { name: "Registrar cliente" }));

    expect(screen.getByLabelText(/Nombre o razón social/)).toHaveAccessibleDescription("Escribe el nombre o la razón social.");
    expect(screen.getByLabelText(/Número de identificación/)).toHaveAccessibleDescription(
      "Usa solo letras, números y guiones, sin espacios ni puntos.",
    );
    expect(screen.getByLabelText(/Correo de contacto/)).toHaveAccessibleDescription("Escribe un correo válido, como compras@minera.com.");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("registers the client with the trimmed values", async () => {
    createClient.mockResolvedValue(client());
    const onSaved = vi.fn();
    render(<ClientFormModal onClose={vi.fn()} onSaved={onSaved} />);
    await userEvent.type(screen.getByLabelText(/Nombre o razón social/), "  Minera El Roble ");
    await userEvent.type(screen.getByLabelText(/Número de identificación/), "900222333-1");
    await userEvent.type(screen.getByLabelText(/Correo de contacto/), "compras@roble.com ");
    await userEvent.click(screen.getByRole("button", { name: "Registrar cliente" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(client()));
    expect(createClient).toHaveBeenCalledWith({
      name: "Minera El Roble",
      identification_type: "nit",
      identification_number: "900222333-1",
      email: "compras@roble.com",
    });
  });

  it("points a duplicate identification to the number field", async () => {
    updateClient.mockRejectedValue(new ApiError(409, "conflict", "Ya existe un registro con esos datos."));
    render(<ClientFormModal client={client()} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByLabelText(/Nombre o razón social/)).toHaveValue("Minera El Roble");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() =>
      expect(screen.getByLabelText(/Número de identificación/)).toHaveAccessibleDescription(
        "Ya hay un cliente registrado con ese tipo y número de identificación.",
      ),
    );
    expect(updateClient).toHaveBeenCalledWith("client-id", expect.objectContaining({ identification_number: "900222333-1" }));
  });
});
