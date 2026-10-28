/**
 * @file Server-side verification of the Cloudflare Turnstile challenge solved on the login form.
 */

import { CaptchaError, ServiceUnavailableError } from "../errors";
import { log } from "../logging";

/**
 * Checks that a request comes from a person who solved the challenge.
 */
export interface CaptchaVerifier {
  /**
   * @param token - Token produced by the widget on the client.
   * @param remoteIp - Address of the client, sent to the provider as an extra signal.
   * @throws CaptchaError When the token is missing or rejected.
   * @throws ServiceUnavailableError When the provider cannot be reached.
   */
  verify(token: string | undefined, remoteIp?: string): Promise<void>;
}

/**
 * Answer of the Turnstile `siteverify` endpoint.
 */
interface SiteverifyResponse {
  success: boolean;
  "error-codes"?: string[];
}

/**
 * Verifies Turnstile tokens against Cloudflare.
 */
export class TurnstileVerifier implements CaptchaVerifier {
  /**
   * @param secretKey - Secret key of the Turnstile widget.
   * @param verifyUrl - `siteverify` endpoint.
   * @param fetcher - HTTP client, replaceable in tests.
   * @param timeoutMs - Maximum wait for Cloudflare.
   */
  constructor(
    private readonly secretKey: string,
    private readonly verifyUrl: string,
    private readonly fetcher: typeof fetch = fetch,
    private readonly timeoutMs: number = 5000,
  ) {}

  /**
   * @param token - Token produced by the widget on the client.
   * @param remoteIp - Address of the client.
   * @throws CaptchaError When the token is missing or rejected.
   * @throws ServiceUnavailableError When Cloudflare cannot be reached or answers with an error.
   */
  async verify(token: string | undefined, remoteIp?: string): Promise<void> {
    if (!token) {
      throw new CaptchaError("The human verification is required");
    }
    const form: URLSearchParams = new URLSearchParams({ secret: this.secretKey, response: token });
    if (remoteIp) {
      form.set("remoteip", remoteIp);
    }
    let result: SiteverifyResponse;
    try {
      const response: Response = await this.fetcher(this.verifyUrl, {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      result = (await response.json()) as SiteverifyResponse;
    } catch (error: unknown) {
      log("ERROR", `Turnstile verification unavailable: ${error instanceof Error ? error.message : String(error)}`);
      throw new ServiceUnavailableError("The human verification service is unavailable");
    }
    if (!result.success) {
      throw new CaptchaError("The human verification did not pass", { reasons: result["error-codes"] ?? [] });
    }
  }
}

/**
 * Accepts every request; used when no Turnstile secret is configured outside production.
 */
export class DisabledCaptchaVerifier implements CaptchaVerifier {
  /**
   * Accepts the request without checking anything.
   */
  async verify(): Promise<void> {}
}
