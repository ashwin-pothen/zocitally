export function redactAPIKey(text: string, apiKey?: string): string {
  let redacted = text.replace(/([?&]api_key=)[^&\s]+/giu, "$1[REDACTED]");
  if (apiKey && apiKey.length > 0) redacted = redacted.split(apiKey).join("[REDACTED]");
  return redacted;
}

export function shortErrorCode(error: unknown): string {
  if (error instanceof Error) return error.name.slice(0, 64) || "error";
  return "error";
}
