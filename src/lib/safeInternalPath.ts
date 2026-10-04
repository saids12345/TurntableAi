export function sanitizeInternalPath(
  value: unknown,
  fallback = "/",
) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\")
  ) {
    return fallback;
  }

  return value;
}
