/**
 * Shared abort utilities for consistent AbortError creation and signal checking.
 */

export function makeAbortError(message = "Aborted"): Error {
  const err = new Error(message);
  err.name = "AbortError";
  return err;
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw makeAbortError();
}
