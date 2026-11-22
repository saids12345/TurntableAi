export const RESTAURANT_GOALS = [
  "operations",
  "reputation",
  "revenue",
  "growth",
  "all",
] as const;

export type RestaurantGoal =
  (typeof RESTAURANT_GOALS)[number];

export type RestaurantIdentity = {
  name: string;
  expectedLocationCount: number;
  primaryGoal: RestaurantGoal;
};

type ParseResult =
  | { ok: true; value: RestaurantIdentity }
  | { ok: false; error: string };

export function parseRestaurantIdentity(
  input: unknown,
): ParseResult {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input)
  ) {
    return {
      ok: false,
      error: "Enter your restaurant details.",
    };
  }

  const data = input as Record<string, unknown>;

  const allowed = new Set([
    "name",
    "expectedLocationCount",
    "primaryGoal",
  ]);

  if (Object.keys(data).some(key => !allowed.has(key))) {
    return {
      ok: false,
      error: "Unexpected restaurant setup field.",
    };
  }

  if (typeof data.name !== "string") {
    return {
      ok: false,
      error: "Enter your restaurant or group name.",
    };
  }

  const name = data.name.trim();

  if (
    name.length < 1 ||
    name.length > 160 ||
    /[\u0000-\u001F\u007F]/.test(name)
  ) {
    return {
      ok: false,
      error: "Restaurant name must be 1–160 characters.",
    };
  }

  const count = data.expectedLocationCount;

  if (
    typeof count !== "number" ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > 100
  ) {
    return {
      ok: false,
      error: "Choose between 1 and 100 locations.",
    };
  }

  const goal = data.primaryGoal;

  if (
    typeof goal !== "string" ||
    !RESTAURANT_GOALS.some(value => value === goal)
  ) {
    return {
      ok: false,
      error: "Choose a valid restaurant goal.",
    };
  }

  return {
    ok: true,
    value: {
      name,
      expectedLocationCount: count,
      primaryGoal: goal as RestaurantGoal,
    },
  };
}
