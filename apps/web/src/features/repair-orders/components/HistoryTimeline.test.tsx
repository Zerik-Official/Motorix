import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { makeProfile, makeSession, TestSession } from "@/test/session";

import { HistoryTimeline } from "./HistoryTimeline";

describe("HistoryTimeline", () => {
  it("lists the newest change first and names the signed in account as you", () => {
    const me: string = makeProfile().id;
    render(
      <TestSession value={makeSession()}>
        <HistoryTimeline
          entries={[
            { id: "1", from_status: null, to_status: "received", note: null, changed_by: "abcdef12-0000-0000-0000-000000000000", changed_at: "2026-10-28T10:00:00Z" },
            { id: "2", from_status: "received", to_status: "in_diagnosis", note: "Banco 2", changed_by: me, changed_at: "2026-10-28T11:00:00Z" },
          ]}
        />
      </TestSession>,
    );
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("De Recibido a En diagnóstico");
    expect(items[0]).toHaveTextContent("por ti");
    expect(items[0]).toHaveTextContent("Banco 2");
    expect(items[1]).toHaveTextContent("Orden abierta en Recibido");
    expect(items[1]).toHaveTextContent("la cuenta abcdef12");
  });
});
