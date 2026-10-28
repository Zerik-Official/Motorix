import { isAxiosError } from "axios";

/**
 * Field that failed validation on the server.
 */
export interface ApiFieldError {
  /** Dotted path of the field, such as `email` or `body.email`. */
  field: string;
  /** Message of the server, in English. */
  message: string;
}

/**
 * Failure of a request to either API, already reduced to the shared error body.
 */
export class ApiError extends Error {
  /** HTTP status, or 0 when the server could not be reached. */
  readonly status: number;
  /** Machine readable code of the error body, such as `forbidden`. */
  readonly code: string;
  /** Structured data of the error body. */
  readonly details: unknown;

  /**
   * @param status - HTTP status, or 0 when the server could not be reached.
   * @param code - Machine readable code of the error body, such as `forbidden`.
   * @param message - Message in Spanish, ready to show to the user.
   * @param details - Structured data of the error body.
   */
  constructor(status: number, code: string, message: string, details: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /**
   * Fields that failed validation, with the name of the field without the `body.` prefix.
   *
   * @returns The invalid fields, or an empty list.
   */
  get fieldErrors(): ApiFieldError[] {
    if (!Array.isArray(this.details)) {
      return [];
    }
    return this.details
      .filter((item): item is ApiFieldError => typeof item?.field === "string")
      .map((item) => ({ field: item.field.replace(/^(body|query|path)\./, ""), message: item.message }));
  }
}

/**
 * Spanish message of each error code shared by both APIs.
 */
const MESSAGES: Record<string, string> = {
  unauthorized: "Tu sesión terminó. Vuelve a iniciar sesión.",
  forbidden: "No tienes permiso para hacer esto.",
  not_found: "No encontramos lo que buscas. Puede que lo hayan eliminado.",
  conflict: "Ya existe un registro con esos datos.",
  validation_error: "Revisa los campos marcados.",
  business_rule_violation: "La operación no cumple las reglas del taller.",
  too_many_requests: "Demasiadas solicitudes seguidas. Espera unos minutos e inténtalo de nuevo.",
  captcha_failed: "No pudimos verificar que eres una persona. Vuelve a intentarlo.",
  service_unavailable: "El servicio no está disponible en este momento. Inténtalo en unos minutos.",
  invalid_json: "La solicitud no es válida.",
  internal_error: "Ocurrió un error inesperado en el servidor. Inténtalo de nuevo.",
  network_error: "No hay conexión con el servidor. Revisa tu conexión e inténtalo de nuevo.",
};

/**
 * Reads the shared error body `{"error": {code, message, details}}` of a response.
 *
 * @param data - Body of the response.
 * @returns The error object, or null when the body has another shape.
 */
function readErrorBody(data: unknown): { code: string; details: unknown } | null {
  if (typeof data !== "object" || data === null || !("error" in data)) {
    return null;
  }
  const error: unknown = (data as { error: unknown }).error;
  if (typeof error !== "object" || error === null || typeof (error as { code?: unknown }).code !== "string") {
    return null;
  }
  return { code: (error as { code: string }).code, details: (error as { details?: unknown }).details ?? null };
}

/**
 * Turns anything thrown by a request into an {@link ApiError} with a Spanish message.
 *
 * @param error - Error thrown by axios or by the app.
 * @param overrides - Messages that replace the defaults for some codes in this context.
 * @returns The normalized error.
 */
export function toApiError(error: unknown, overrides: Partial<Record<string, string>> = {}): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  if (isAxiosError(error)) {
    if (!error.response) {
      return new ApiError(0, "network_error", overrides.network_error ?? MESSAGES.network_error);
    }
    const body = readErrorBody(error.response.data);
    const code: string = body?.code ?? "internal_error";
    const message: string = overrides[code] ?? MESSAGES[code] ?? MESSAGES.internal_error;
    return new ApiError(error.response.status, code, message, body?.details ?? null);
  }
  return new ApiError(0, "internal_error", MESSAGES.internal_error);
}
