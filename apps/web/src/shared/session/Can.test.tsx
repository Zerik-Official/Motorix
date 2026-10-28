import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { makeProfile, makeSession, TestSession } from "@/test/session";

import { Can } from "./Can";

describe("Can", () => {
  it("hides an action from an account without the permission", () => {
    render(
      <TestSession value={makeSession()}>
        <Can permission="clients:write">
          <button type="button">Registrar cliente</button>
        </Can>
      </TestSession>,
    );
    expect(screen.queryByRole("button", { name: "Registrar cliente" })).not.toBeInTheDocument();
  });

  it("shows it to an account that holds the permission", () => {
    render(
      <TestSession value={makeSession({ profile: makeProfile({ permissions: ["clients:write"] }) })}>
        <Can permission="clients:write">
          <button type="button">Registrar cliente</button>
        </Can>
      </TestSession>,
    );
    expect(screen.getByRole("button", { name: "Registrar cliente" })).toBeInTheDocument();
  });

  it("always shows it to root", () => {
    render(
      <TestSession value={makeSession({ profile: makeProfile({ role: "root", permissions: [] }) })}>
        <Can permission="permissions:manage" fallback={<p>Sin acceso</p>}>
          <button type="button">Permisos</button>
        </Can>
      </TestSession>,
    );
    expect(screen.getByRole("button", { name: "Permisos" })).toBeInTheDocument();
  });

  it("renders the fallback when given one", () => {
    render(
      <TestSession value={makeSession()}>
        <Can permission="users:manage" fallback={<p>Sin acceso</p>}>
          <button type="button">Usuarios</button>
        </Can>
      </TestSession>,
    );
    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
  });
});
