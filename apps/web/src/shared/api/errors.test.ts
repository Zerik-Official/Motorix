import { AxiosError, AxiosHeaders, type AxiosResponse } from "axios";
import { describe, expect, it } from "vitest";

import { ApiError, toApiError } from "./errors";

/**
 * Builds an axios error with a response, as the APIs return them.
 *
 * @param status - HTTP status.
 * @param data - Body of the response.
 * @returns The error.
 */
function responseError(status: number, data: unknown): AxiosError {
  const response = { status, data, statusText: "", headers: {}, config: { headers: new AxiosHeaders() } } as AxiosResponse;
  return new AxiosError("Request failed", "ERR_BAD_RESPONSE", undefined, undefined, response);
}

describe("toApiError", () => {
  it("translates the shared error body into a Spanish message", () => {
    const error: ApiError = toApiError(responseError(403, { error: { code: "forbidden", message: "This operation requires 'clients:write'", details: { permission: "clients:write" } } }));
    expect(error.status).toBe(403);
    expect(error.code).toBe("forbidden");
    expect(error.message).toBe("No tienes permiso para hacer esto.");
    expect(error.details).toEqual({ permission: "clients:write" });
  });

  it("lets a screen replace the message of a code", () => {
    const error: ApiError = toApiError(responseError(401, { error: { code: "unauthorized", message: "Invalid email or password", details: null } }), {
      unauthorized: "El correo o la contraseña no son correctos.",
    });
    expect(error.message).toBe("El correo o la contraseña no son correctos.");
  });

  it("reports a server that cannot be reached", () => {
    const error: ApiError = toApiError(new AxiosError("Network Error", "ERR_NETWORK"));
    expect(error.status).toBe(0);
    expect(error.code).toBe("network_error");
  });

  it("falls back to a generic message for unknown bodies", () => {
    expect(toApiError(responseError(502, "Bad gateway")).code).toBe("internal_error");
  });

  it("lists invalid fields without the body prefix", () => {
    const error: ApiError = toApiError(
      responseError(422, { error: { code: "validation_error", message: "", details: [{ field: "body.email", message: "bad" }, { field: "name", message: "bad" }] } }),
    );
    expect(error.fieldErrors.map((field) => field.field)).toEqual(["email", "name"]);
  });
});
