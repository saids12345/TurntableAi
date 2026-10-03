export function getSquareCronHttpStatus(
  failureCount: number,
) {
  return failureCount === 0
    ? 200
    : 500;
}
