export const TRUSTED_PERFORMANCE_SOURCES = [
  "toast",
  "square",
  "clover",
  "lightspeed",
] as const;

export type TrustedPerformanceSource =
  (typeof TRUSTED_PERFORMANCE_SOURCES)[number];
