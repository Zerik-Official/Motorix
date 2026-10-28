import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Modal } from "./Modal";

describe("Modal", () => {
  it("is announced as a modal dialog named by its title and described by its description", () => {
    render(
      <Modal open onClose={vi.fn()} title="Registrar cliente" description="Los campos marcados son obligatorios.">
        <input aria-label="Nombre" />
      </Modal>,
    );
    const dialog = screen.getByRole("dialog", { name: "Registrar cliente" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("Los campos marcados son obligatorios.");
  });

  it("moves focus inside and closes with Escape", async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Registrar cliente">
        <input aria-label="Nombre" />
      </Modal>,
    );
    expect(screen.getByRole("button", { name: "Cerrar" })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("cannot be closed while an action runs", async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Guardando" closable={false}>
        <p>Espera</p>
      </Modal>,
    );
    await userEvent.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Cerrar" })).not.toBeInTheDocument();
  });

  it("renders nothing while closed", () => {
    render(
      <Modal open={false} onClose={vi.fn()} title="Oculto">
        <p>Contenido</p>
      </Modal>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
