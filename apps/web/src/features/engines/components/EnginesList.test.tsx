import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { makeProfile, makeSession, TestSession } from "@/test/session";
import type { Permission } from "@shared/session/types";

import type { Engine } from "../api";
import { EnginesList } from "./EnginesList";

/**
 * Engine of Minera El Roble used by the tests.
 */
const ENGINE: Engine = {
  id: "engine-id",
  serial_number: "CAT-3516-0012",
  manufacturer: "Caterpillar",
  model: "3516B",
  engine_type: "Diésel V16",
  power_rating: "2500 HP",
  client_id: "client-id",
  is_active: true,
  registered_at: "2026-10-28T10:00:00Z",
  updated_at: "2026-10-28T10:00:00Z",
  client: { id: "client-id", name: "Minera El Roble", identification_type: "nit", identification_number: "900222333", is_active: true },
};

/**
 * Renders the list for an account with the given permissions.
 *
 * @param permissions - Permissions of the signed in account.
 * @param showOwner - Whether the list shows the owner.
 */
function renderList(permissions: Permission[], showOwner?: boolean): void {
  render(
    <TestSession value={makeSession({ profile: makeProfile({ permissions }) })}>
      <MemoryRouter>
        <EnginesList engines={[ENGINE]} showOwner={showOwner} />
      </MemoryRouter>
    </TestSession>,
  );
}

describe("EnginesList", () => {
  it("links the owner to the client when the role can read clients", () => {
    renderList(["engines:read", "clients:read"]);
    const table = screen.getByRole("table", { name: "Motores" });
    expect(within(table).getByRole("link", { name: "Minera El Roble" })).toHaveAttribute("href", "/app/clientes/client-id");
    expect(within(table).getByText("NIT 900222333")).toBeInTheDocument();
  });

  it("shows the owner as text when the role cannot read clients", () => {
    renderList(["engines:read"]);
    const table = screen.getByRole("table", { name: "Motores" });
    expect(within(table).getByText("Minera El Roble")).toBeInTheDocument();
    expect(within(table).queryByRole("link", { name: "Minera El Roble" })).not.toBeInTheDocument();
  });

  it("hides the owner when asked", () => {
    renderList(["engines:read", "clients:read"], false);
    expect(screen.queryByText("Minera El Roble")).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Cliente" })).not.toBeInTheDocument();
  });
});
