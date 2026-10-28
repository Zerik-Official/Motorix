import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@shared/api/errors";
import { makeSession, TestSession } from "@/test/session";

import { LoginForm } from "./LoginForm";

vi.mock("@shared/config/env", () => ({
  env: { authApiUrl: "http://auth.test", businessApiUrl: "http://business.test", turnstileSiteKey: "" },
}));

describe("LoginForm", () => {
  it("explains each missing field and links the message to it", async () => {
    const session = makeSession({ profile: null });
    render(
      <TestSession value={session}>
        <LoginForm onSuccess={vi.fn()} />
      </TestSession>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Entrar al taller" }));

    const email = screen.getByLabelText(/Correo/);
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription("Escribe tu correo.");
    expect(screen.getByLabelText(/Contraseña/)).toHaveAccessibleDescription("Escribe tu contraseña.");
    expect(session.login).not.toHaveBeenCalled();
  });

  it("rejects an email without a domain", async () => {
    render(
      <TestSession value={makeSession({ profile: null })}>
        <LoginForm onSuccess={vi.fn()} />
      </TestSession>,
    );
    await userEvent.type(screen.getByLabelText(/Correo/), "ana");
    await userEvent.type(screen.getByLabelText(/Contraseña/), "secreto");
    await userEvent.click(screen.getByRole("button", { name: "Entrar al taller" }));
    expect(screen.getByLabelText(/Correo/)).toHaveAccessibleDescription(/correo válido/);
  });

  it("logs in with the normalized email and reports success", async () => {
    const session = makeSession({ profile: null });
    const onSuccess = vi.fn();
    render(
      <TestSession value={session}>
        <LoginForm onSuccess={onSuccess} />
      </TestSession>,
    );
    await userEvent.type(screen.getByLabelText(/Correo/), "  Ana@Taller.com ");
    await userEvent.type(screen.getByLabelText(/Contraseña/), "secreto");
    await userEvent.click(screen.getByRole("button", { name: "Entrar al taller" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(session.login).toHaveBeenCalledWith({ email: "Ana@Taller.com", password: "secreto", turnstileToken: "" });
  });

  it("announces a server error", async () => {
    const session = makeSession({
      profile: null,
      login: vi.fn().mockRejectedValue(new ApiError(401, "unauthorized", "El correo o la contraseña no son correctos.")),
    });
    render(
      <TestSession value={session}>
        <LoginForm onSuccess={vi.fn()} />
      </TestSession>,
    );
    await userEvent.type(screen.getByLabelText(/Correo/), "ana@taller.com");
    await userEvent.type(screen.getByLabelText(/Contraseña/), "equivocada");
    await userEvent.click(screen.getByRole("button", { name: "Entrar al taller" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("El correo o la contraseña no son correctos.");
  });

  it("lets the password be shown and hidden", async () => {
    render(
      <TestSession value={makeSession({ profile: null })}>
        <LoginForm onSuccess={vi.fn()} />
      </TestSession>,
    );
    const toggle = screen.getByRole("button", { name: "Mostrar contraseña" });
    await userEvent.click(toggle);
    expect(screen.getByLabelText(/Contraseña/)).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Ocultar contraseña" })).toHaveAttribute("aria-pressed", "true");
  });
});
