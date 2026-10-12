type ErrorLike = {
  name?: unknown;
  message?: unknown;
  code?: unknown;
  cause?: unknown;
};

function asLowerText(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

function asUpperText(value: unknown): string {
  return typeof value === "string" ? value.toUpperCase() : "";
}

function isAbortMessage(message: string): boolean {
  return (
    message === "aborted" ||
    message.includes("operation was aborted") ||
    message.includes("request aborted") ||
    message.includes("client aborted") ||
    message.includes("body was aborted") ||
    message.includes("socket hang up")
  );
}

/** Treat browser/server disconnects as cancellation, not app failures. */
export function isAbortError(error: unknown, depth = 0): boolean {
  if (!error || depth > 3) return false;
  if (typeof error === "string") return isAbortMessage(error.toLowerCase());
  if (typeof error !== "object") return false;

  const err = error as ErrorLike;
  const name = asLowerText(err.name);
  const message = asLowerText(err.message);
  const code = asUpperText(err.code);

  if (name === "aborterror") return true;
  if (code === "ECONNRESET" || code === "ERR_STREAM_PREMATURE_CLOSE") return true;
  if (isAbortMessage(message)) return true;

  return isAbortError(err.cause, depth + 1);
}