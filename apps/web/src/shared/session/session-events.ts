import type { Profile } from "./types";

/**
 * Listener of session changes made outside React, such as a refresh triggered by a request.
 */
export interface SessionListener {
  /** Called with the account each time a session is opened or renewed. */
  renewed?: (profile: Profile) => void;
  /** Called when the session can no longer be renewed. */
  ended?: () => void;
}

const listeners: Set<SessionListener> = new Set();

/**
 * Subscribes to session changes.
 *
 * @param listener - Callbacks to run.
 * @returns A function that removes the subscription.
 */
export function subscribeSession(listener: SessionListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Tells every listener that the session was opened or renewed.
 *
 * @param profile - Account of the session, with its current permissions.
 */
export function emitRenewed(profile: Profile): void {
  for (const listener of listeners) {
    listener.renewed?.(profile);
  }
}

/**
 * Tells every listener that the session ended.
 */
export function emitEnded(): void {
  for (const listener of listeners) {
    listener.ended?.();
  }
}
