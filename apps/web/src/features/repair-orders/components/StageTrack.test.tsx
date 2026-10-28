import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StageTrack } from "./StageTrack";

describe("StageTrack", () => {
  it("marks the current stage as the current step and tells done from pending", () => {
    render(<StageTrack status="in_repair" />);
    const steps = screen.getAllByRole("listitem");
    expect(steps).toHaveLength(7);
    expect(steps[3]).toHaveAttribute("aria-current", "step");
    expect(steps[0]).toHaveTextContent("Recibido: completada");
    expect(steps[3]).toHaveTextContent("En reparación: etapa actual");
    expect(steps[6]).toHaveTextContent("Entregado: pendiente");
  });
});
