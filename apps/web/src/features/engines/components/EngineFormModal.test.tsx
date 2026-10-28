import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ClientOption } from "@shared/api/catalog";
import { ApiError } from "@shared/api/errors";

import type { Engine } from "../api";
import { EngineFormModal } from "./EngineFormModal";

const createEngine = vi.fn();
const updateEngine = vi.fn();

vi.mock("../api", () => ({
  createEngine: (...args: unknown[]) => createEngine(...args),
  updateEngine: (...args: unknown[]) => updateEngine(...args),
}));

vi.mock("@shared/api/catalog", () => ({
  searchClients: vi.fn().mockResolvedValue([]),
}));

/**
 * Owner used by the tests.
 */
const OWNER: ClientOption = {
  id: "client-id",
  name: "Minera El Roble",
  identification_type: "nit",
  identification_number: "900222333",
  email: "compras@roble.com",
  is_active: true,
};

/**
 * Builds a registered engine of {@link OWNER}.
 *
 * @returns The engine.
 */
function engine(): Engine {
  return {
    id: "engine-id",
    serial_number: "CAT-3516-0012",
    manufacturer: "Caterpillar",
    model: "3516B",
    engine_type: "Diésel V16",
    power_rating: "2500 HP",
    client_id: OWNER.id,
    is_active: true,
    registered_at: "2026-10-28T10:00:00Z",
    updated_at: "2026-10-28T10:00:00Z",
    client: {
      id: OWNER.id,
      name: OWNER.name,
      identification_type: OWNER.identification_type,
      identification_number: OWNER.identification_number,
      is_active: true,
    },
  };
}

/**
 * Fills every text field of the form.
 */
async function fillFields(): Promise<void> {
  await userEvent.type(screen.getByLabelText(/Número de serie/), " CAT-3516-0012 ");
  await userEvent.type(screen.getByLabelText(/Fabricante/), "Caterpillar");
  await userEvent.type(screen.getByLabelText(/^Modelo/), "3516B");
  await userEvent.type(screen.getByLabelText(/Tipo de motor/), "Diésel V16");
  await userEvent.type(screen.getByLabelText(/Potencia o capacidad/), "2500 HP");
}

beforeEach(() => {
  createEngine.mockReset();
  updateEngine.mockReset();
});

describe("EngineFormModal", () => {
  it("asks for the owner before registering", async () => {
    render(<EngineFormModal onClose={vi.fn()} onSaved={vi.fn()} />);
    await fillFields();
    await userEvent.click(screen.getByRole("button", { name: "Registrar motor" }));

    expect(screen.getByLabelText(/Cliente dueño/)).toHaveAccessibleDescription("Elige el cliente dueño del motor.");
    expect(createEngine).not.toHaveBeenCalled();
  });

  it("registers the engine for the given owner", async () => {
    createEngine.mockResolvedValue(engine());
    const onSaved = vi.fn();
    render(<EngineFormModal owner={OWNER} onClose={vi.fn()} onSaved={onSaved} />);
    await fillFields();
    await userEvent.click(screen.getByRole("button", { name: "Registrar motor" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(engine()));
    expect(createEngine).toHaveBeenCalledWith({
      serial_number: "CAT-3516-0012",
      manufacturer: "Caterpillar",
      model: "3516B",
      engine_type: "Diésel V16",
      power_rating: "2500 HP",
      client_id: "client-id",
    });
  });

  it("points a duplicate serial to the serial field", async () => {
    updateEngine.mockRejectedValue(new ApiError(409, "conflict", "Ya existe un registro con esos datos."));
    render(<EngineFormModal engine={engine()} owner={OWNER} onClose={vi.fn()} onSaved={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() =>
      expect(screen.getByLabelText(/Número de serie/)).toHaveAccessibleDescription("Ya hay un motor registrado con ese número de serie."),
    );
    expect(updateEngine).toHaveBeenCalledWith("engine-id", expect.objectContaining({ client_id: "client-id" }));
  });
});
