import type {
  RestaurantState,
} from "@/lib/restaurantState";
export type WorldStateSourceStatus =
  | "available"
  | "partial"
  | "unavailable"
  | "stale";

export interface WorldStateSource {
  name: string;

  status: WorldStateSourceStatus;

  recordCount: number;

  lastUpdatedAt: string | null;

  error: string | null;
}

export interface WorldStateEnvironment {
  weather: unknown | null;

  localEvents: unknown[];

  competitors: unknown[];

  economicConditions: unknown | null;
}

export interface WorldStateOperations {
  restaurantStates: RestaurantState[];

  sales: unknown[];

  orders: unknown[];

  labor: unknown[];

  inventory: unknown[];

  reservations: unknown[];

  reviews: unknown[];

  marketing: unknown[];

  recentExecutions: unknown[];
}

export interface WorldState {
  operations: WorldStateOperations;

  environment: WorldStateEnvironment;

  sources: WorldStateSource[];

  locationNames: string[];

  mode: "single_location" | "network";

  generatedAt: string;
}

interface BuildWorldStateInput {
  restaurantStates: RestaurantState[];

  locationNames?: string[];

  mode: "single_location" | "network";
}

export function buildWorldState(
  input: BuildWorldStateInput,
): WorldState {
  const now = new Date().toISOString();

  return {
    operations: {
      restaurantStates:
        [...input.restaurantStates],

      sales: [],

      orders: [],

      labor: [],

      inventory: [],

      reservations: [],

      reviews: [],

      marketing: [],

      recentExecutions: [],
    },

    environment: {
      weather: null,

      localEvents: [],

      competitors: [],

      economicConditions: null,
    },

    sources: [
      {
        name: "restaurant_state",

        status:
          input.restaurantStates.length > 0
            ? "available"
            : "unavailable",

        recordCount:
          input.restaurantStates.length,

        lastUpdatedAt:
          input.restaurantStates.length > 0
            ? now
            : null,

        error: null,
      },
    ],

    locationNames:
      input.locationNames
        ? [...input.locationNames]
        : [],

    mode: input.mode,

    generatedAt: now,
  };
}