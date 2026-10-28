import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@shared/api/errors";
import { ToastProvider } from "@shared/feedback/ToastProvider";

import type { RepairOrderDetail } from "../api";
import { StatusChangeForm } from "./StatusChangeForm";

const changeOrderStatus = vi.fn();

vi.mock("../api", () => ({
  changeOrderStatus: (...args: unknown[]) => changeOrderStatus(...args),
}));

/**
 * Builds a repair order in a given stage.
 *
 * @param status - Stage of the order.
 * @returns The order.
 */
function order(status: RepairOrderDetail["status"]): RepairOrderDetail {
  return {
    id: "order-id",
    order_number: "RO-2026-0000ABCD",
    engine: { id: "engine-id", serial_number: "QSK-1", manufacturer: "Cummins", model: "QSK60" },
    client: { id: "client-id", name: "Minera El Roble", identification_number: "900222" },
    received_at: "2026-10-28T10:00:00Z",
    reported_issue: "Pierde presión",
    diagnosis: null,
    work_performed: null,
    technician_name: null,
    estimated_delivery_date: null,
    delivered_at: null,
    status,
    observations: null,
    created_by: "user-id",
    created_at: "2026-10-28T10:00:00Z",
    updated_at: "2026-10-28T10:00:00Z",
    history: [],
  };
}

beforeEach(() => {
  changeOrderStatus.mockReset();
});

describe("StatusChangeForm", () => {
  it("suggests the next stage and sends it with the trimmed note", async () => {
    changeOrderStatus.mockResolvedValue(order("in_diagnosis"));
    const onChanged = vi.fn();
    render(
      <ToastProvider>
        <StatusChangeForm order={order("received")} onChanged={onChanged} />
      </ToastProvider>,
    );

    expect(screen.getByRole("combobox", { name: /Nueva etapa/ })).toHaveTextContent("En diagnóstico");
    await userEvent.type(screen.getByLabelText("Nota para el historial"), "  Banco 2  ");
    await userEvent.click(screen.getByRole("button", { name: "Cambiar etapa" }));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(changeOrderStatus).toHaveBeenCalledWith("order-id", "in_diagnosis", "Banco 2");
    expect(await screen.findByRole("status")).toHaveTextContent("Orden movida a En diagnóstico");
  });

  it("asks for a stage when the order is already in the last one", async () => {
    render(
      <ToastProvider>
        <StatusChangeForm order={order("delivered")} onChanged={vi.fn()} />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Cambiar etapa" }));
    expect(screen.getByRole("combobox", { name: /Nueva etapa/ })).toHaveAccessibleDescription(
      "Elige la etapa a la que pasa la orden.",
    );
    expect(changeOrderStatus).not.toHaveBeenCalled();
  });

  it("announces a refused change", async () => {
    changeOrderStatus.mockRejectedValue(new ApiError(403, "forbidden", "No tienes permiso para hacer esto."));
    render(
      <ToastProvider>
        <StatusChangeForm order={order("received")} onChanged={vi.fn()} />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Cambiar etapa" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No tienes permiso para hacer esto.");
  });
});
