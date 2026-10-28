import { describe, expect, it } from "vitest";

import type { Permission, Role } from "@shared/session/types";

import { buildTourSteps, describeAbilities, joinList, type TourContext, type TourStepDefinition } from "./steps";

/**
 * Default permissions of the operative role.
 */
const OPERATIVE: Permission[] = ["clients:read", "engines:read", "repair_orders:read", "repair_orders:write"];

/**
 * Every permission of the catalog.
 */
const ALL: Permission[] = [
  "clients:read",
  "clients:write",
  "engines:read",
  "engines:write",
  "repair_orders:read",
  "repair_orders:write",
  "users:manage",
  "permissions:manage",
];

/**
 * Builds the tour for a role holding some permissions.
 *
 * @param role - Role of the account.
 * @param permissions - Permissions the role holds.
 * @param overrides - Other values of the context.
 * @returns The steps.
 */
function tour(role: Role, permissions: Permission[], overrides: Partial<TourContext> = {}): TourStepDefinition[] {
  return buildTourSteps({
    firstName: "Ana",
    role,
    can: (permission) => permissions.includes(permission),
    sections: ["Tablero", "Órdenes"],
    wideNavigation: true,
    sampleOrderId: "order-id",
    ...overrides,
  });
}

/**
 * Finds a step by its name.
 *
 * @param steps - Steps of the tour.
 * @param id - Name of the step.
 * @returns The step, or undefined.
 */
function step(steps: TourStepDefinition[], id: string): TourStepDefinition | undefined {
  return steps.find((item) => item.id === id);
}

describe("buildTourSteps", () => {
  it("shows an operative how to work orders and only how to look at clients and engines", () => {
    const steps: TourStepDefinition[] = tour("user", OPERATIVE);
    const ids: string[] = steps.map((item) => item.id);

    expect(ids).toEqual(expect.arrayContaining(["new-order", "status-change", "clients-results", "engines-results"]));
    expect(ids).not.toEqual(expect.arrayContaining(["new-client"]));
    expect(ids.some((id) => ["new-client", "new-engine", "users-results", "permission-matrix"].includes(id))).toBe(false);
    expect(step(steps, "welcome")?.body).toContain("Entraste como Operativo");
    expect(step(steps, "clients-results")?.body).toContain("no registrarlos ni editarlos");
  });

  it("tells a read only role that it cannot open or move orders", () => {
    const steps: TourStepDefinition[] = tour("user", ["repair_orders:read"]);
    expect(step(steps, "new-order")).toBeUndefined();
    expect(step(steps, "status-change")).toBeUndefined();
    expect(step(steps, "orders-results")?.body).toContain("no abrir órdenes ni moverlas de etapa");
    expect(step(steps, "history")?.body).toContain("no mover la orden");
  });

  it("tells an administrator it manages operatives only", () => {
    const steps: TourStepDefinition[] = tour("admin", ALL);
    expect(step(steps, "new-client")).toBeDefined();
    expect(step(steps, "users-results")?.body).toContain("Como Administrador administras las cuentas de rol Operativo:");
    expect(step(steps, "new-user")?.body).toContain("inferior al tuyo: Operativo.");
    expect(step(steps, "permission-matrix")?.body).toContain("cambias los de Operativo");
  });

  it("tells the superadministrator it manages administrators and operatives", () => {
    const steps: TourStepDefinition[] = tour("root", ALL);
    expect(step(steps, "users-results")?.body).toContain("las cuentas de rol Administrador y Operativo");
    expect(step(steps, "new-user")?.body).toContain("inferior al tuyo: Administrador u Operativo.");
  });

  it("skips the order detail without orders and points at the menu on narrow screens", () => {
    const steps: TourStepDefinition[] = tour("user", OPERATIVE, { sampleOrderId: null, wideNavigation: false });
    expect(step(steps, "stage-track")).toBeUndefined();
    expect(step(steps, "navigation")?.selector).toBe("[data-tour='menu-toggle']");
  });

  it("opens and closes on the dashboard, with the order detail on its own page", () => {
    const steps: TourStepDefinition[] = tour("user", OPERATIVE);
    expect(steps[0]?.route).toBe("/app");
    expect(steps[steps.length - 1]?.id).toBe("replay");
    expect(step(steps, "stage-track")?.route).toBe("/app/ordenes/order-id");
  });
});

describe("describeAbilities", () => {
  it("prefers the write ability over the read one", () => {
    expect(describeAbilities((permission) => ["clients:read", "clients:write"].includes(permission))).toEqual([
      "registrar, editar y desactivar clientes",
    ]);
  });

  it("falls back to the dashboard when the role holds nothing", () => {
    expect(describeAbilities(() => false)).toEqual(["ver el tablero"]);
  });
});

describe("joinList", () => {
  it("joins phrases as a Spanish list", () => {
    expect(joinList(["a"])).toBe("a");
    expect(joinList(["a", "b", "c"])).toBe("a, b y c");
    expect(joinList(["Administrador", "Operativo"], "o")).toBe("Administrador u Operativo");
    expect(joinList(["a", "b"], "o")).toBe("a o b");
  });
});
