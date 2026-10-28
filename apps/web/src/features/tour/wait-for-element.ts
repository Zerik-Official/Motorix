/**
 * How often the page is checked for the element of a step, in milliseconds.
 */
const POLL_INTERVAL_MS = 100;

/**
 * Waits until an element matching a selector is on the page and visible, since a step may point
 * at a page that is still loading.
 *
 * @param selector - CSS selector of the element.
 * @param timeoutMs - How long to wait before giving up, in milliseconds.
 * @param isCancelled - Tells whether the wait is no longer needed.
 * @returns The element, or null when it did not appear in time or the wait was cancelled.
 */
export function waitForElement(selector: string, timeoutMs: number, isCancelled: () => boolean): Promise<Element | null> {
  const deadline: number = Date.now() + timeoutMs;
  return new Promise((resolve) => {
    const check = (): void => {
      if (isCancelled()) {
        resolve(null);
        return;
      }
      const element: Element | null = document.querySelector(selector);
      if (element && element.getClientRects().length > 0) {
        resolve(element);
        return;
      }
      if (Date.now() >= deadline) {
        resolve(null);
        return;
      }
      window.setTimeout(check, POLL_INTERVAL_MS);
    };
    check();
  });
}
