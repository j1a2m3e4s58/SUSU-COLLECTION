export const RETRYABLE_STATUS_CODES = new Set([502, 503, 504]);

export function emitNetworkState(status, detail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("portal-network-state", {
    detail: { status, ...detail },
  }));
}

export function isRetryableFailure(error) {
  return !error?.status || RETRYABLE_STATUS_CODES.has(error.status);
}

export function retryDelay(attempt) {
  return Math.min(800 * (2 ** attempt), 3200);
}

export function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
