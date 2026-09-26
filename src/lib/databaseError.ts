const CONNECTION_ERROR_CODES = new Set([
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
  "ECONNRESET",
  "ECONNREFUSED",
  "ENETUNREACH",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "P1001",
  "P1002",
]);

/** Detect transient database/network failures through nested adapter causes. */
export function isDatabaseUnavailable(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5; depth++) {
    if (typeof current !== "object" || current === null) return false;
    const candidate = current as {
      cause?: unknown;
      code?: unknown;
      message?: unknown;
      name?: unknown;
    };
    if (
      (typeof candidate.code === "string" && CONNECTION_ERROR_CODES.has(candidate.code)) ||
      candidate.name === "ConnectTimeoutError" ||
      candidate.message === "fetch failed"
    ) {
      return true;
    }
    current = candidate.cause;
  }
  return false;
}