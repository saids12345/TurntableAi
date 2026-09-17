import type {
  Belief,
  BeliefSystem,
} from "@/lib/brain/reasoning/beliefSystem";

import {
  getSupabaseRouteClient,
} from "@/lib/supabaseRoute";

export type BrainBeliefScopeMode =
  | "single_location"
  | "network";

export interface BrainBeliefScope {
  mode: BrainBeliefScopeMode;

  locationName?: string | null;
}

export interface LoadBeliefStateInput
  extends BrainBeliefScope {
  userId: string;
}

export interface SaveBeliefStateInput
  extends BrainBeliefScope {
  userId: string;

  sourceRunId: string;

  beliefSystem: BeliefSystem;
}

export interface PersistedBrainBeliefState {
  scopeKey: string;

  mode: BrainBeliefScopeMode;

  locationName: string | null;

  beliefSystem: BeliefSystem;

  sourceRunId: string;

  createdAt: string | null;

  updatedAt: string | null;
}

type BrainBeliefStateRow = {
  scope_key: string;

  mode: string;

  location_name: string | null;

  belief_system: unknown;

  source_run_id: string;

  created_at: string | null;

  updated_at: string | null;
};

function isRecord(
  value: unknown,
): value is Record<
  string,
  unknown
> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function isFiniteNumber(
  value: unknown,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  );
}

function normalizeLocationName(
  value:
    | string
    | null
    | undefined,
) {
  return (
    value ?? ""
  )
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(
      /[^a-z0-9]+/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

export function buildBeliefScopeKey(
  scope: BrainBeliefScope,
) {
  if (
    scope.mode === "network"
  ) {
    return "network";
  }

  const normalizedLocation =
    normalizeLocationName(
      scope.locationName,
    );

  if (!normalizedLocation) {
    throw new Error(
      "A location name is required for single-location belief state.",
    );
  }

  return (
    `location:${normalizedLocation}`
  );
}

function normalizeStoredLocationName(
  scope: BrainBeliefScope,
) {
  if (
    scope.mode === "network"
  ) {
    return null;
  }

  const locationName =
    scope.locationName?.trim();

  if (!locationName) {
    throw new Error(
      "A location name is required for single-location belief state.",
    );
  }

  return locationName;
}

function isBelief(
  value: unknown,
): value is Belief {
  if (!isRecord(value)) {
    return false;
  }

  if (
    typeof value.id !==
      "string" ||
    !value.id.trim()
  ) {
    return false;
  }

  if (
    typeof value.statement !==
      "string"
  ) {
    return false;
  }

  if (
    !isFiniteNumber(
      value.confidence,
    )
  ) {
    return false;
  }

  if (
    !Array.isArray(
      value.evidence,
    ) ||
    !value.evidence.every(
      (item) =>
        typeof item ===
        "string",
    )
  ) {
    return false;
  }

  if (
    typeof value.updatedAt !==
    "string"
  ) {
    return false;
  }

  return true;
}

export function isBeliefSystem(
  value: unknown,
): value is BeliefSystem {
  if (!isRecord(value)) {
    return false;
  }

  if (
    !Array.isArray(
      value.beliefs,
    )
  ) {
    return false;
  }

  if (
    !value.beliefs.every(
      isBelief,
    )
  ) {
    return false;
  }

  if (
    value.primaryBelief !==
      undefined &&
    !isBelief(
      value.primaryBelief,
    )
  ) {
    return false;
  }

  if (
    value.alternativeBeliefs !==
      undefined &&
    (
      !Array.isArray(
        value.alternativeBeliefs,
      ) ||
      !value.alternativeBeliefs.every(
        isBelief,
      )
    )
  ) {
    return false;
  }

  if (
    value.contestedBeliefs !==
      undefined &&
    (
      !Array.isArray(
        value.contestedBeliefs,
      ) ||
      !value.contestedBeliefs.every(
        isBelief,
      )
    )
  ) {
    return false;
  }

  if (
    value.overallConfidence !==
      undefined &&
    !isFiniteNumber(
      value.overallConfidence,
    )
  ) {
    return false;
  }

  if (
    value.evidenceCoverage !==
      undefined &&
    !isFiniteNumber(
      value.evidenceCoverage,
    )
  ) {
    return false;
  }

  if (
    value.uncertainty !==
      undefined &&
    !isFiniteNumber(
      value.uncertainty,
    )
  ) {
    return false;
  }

  return true;
}

function validateUserId(
  userId: string,
) {
  if (!userId.trim()) {
    throw new Error(
      "A user ID is required for persisted Brain belief state.",
    );
  }
}

function validateSourceRunId(
  sourceRunId: string,
) {
  if (!sourceRunId.trim()) {
    throw new Error(
      "A Brain run ID is required when saving belief state.",
    );
  }
}

export async function loadBeliefState(
  input: LoadBeliefStateInput,
): Promise<
  PersistedBrainBeliefState | null
> {
  validateUserId(
    input.userId,
  );

  const scopeKey =
    buildBeliefScopeKey(
      input,
    );

  const supabase =
    await getSupabaseRouteClient();

  const {
    data,
    error,
  } = await supabase
    .from(
      "brain_belief_state",
    )
    .select(
      [
        "scope_key",
        "mode",
        "location_name",
        "belief_system",
        "source_run_id",
        "created_at",
        "updated_at",
      ].join(","),
    )
    .eq(
      "user_id",
      input.userId,
    )
    .eq(
      "scope_key",
      scopeKey,
    )
    .maybeSingle();

  if (error) {
    throw new Error(
      `Brain belief state load failed: ${error.message}`,
    );
  }

  if (!data) {
    return null;
  }

  const row =
  data as unknown as BrainBeliefStateRow;

  if (
    row.mode !==
      "single_location" &&
    row.mode !==
      "network"
  ) {
    throw new Error(
      "Persisted Brain belief state has an invalid mode.",
    );
  }

  if (
    !isBeliefSystem(
      row.belief_system,
    )
  ) {
    throw new Error(
      "Persisted Brain belief state has an invalid belief system.",
    );
  }

  if (
    typeof row.source_run_id !==
      "string" ||
    !row.source_run_id.trim()
  ) {
    throw new Error(
      "Persisted Brain belief state is missing its source run ID.",
    );
  }

  return {
    scopeKey:
      row.scope_key,

    mode:
      row.mode,

    locationName:
      row.location_name,

    beliefSystem:
      row.belief_system,

    sourceRunId:
      row.source_run_id,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,
  };
}

export async function saveBeliefState(
  input: SaveBeliefStateInput,
): Promise<void> {
  validateUserId(
    input.userId,
  );

  validateSourceRunId(
    input.sourceRunId,
  );

  if (
    !isBeliefSystem(
      input.beliefSystem,
    )
  ) {
    throw new Error(
      "Brain belief state cannot be saved because the belief system is invalid.",
    );
  }

  const scopeKey =
    buildBeliefScopeKey(
      input,
    );

  const locationName =
    normalizeStoredLocationName(
      input,
    );

  const supabase =
    await getSupabaseRouteClient();

  const {
    error,
  } = await supabase
    .from(
      "brain_belief_state",
    )
    .upsert(
      {
        user_id:
          input.userId,

        scope_key:
          scopeKey,

        mode:
          input.mode,

        location_name:
          locationName,

        belief_system:
          input.beliefSystem,

        source_run_id:
          input.sourceRunId.trim(),

        updated_at:
          new Date()
            .toISOString(),
      },
      {
        onConflict:
          "user_id,scope_key",
      },
    );

  if (error) {
    throw new Error(
      `Brain belief state save failed: ${error.message}`,
    );
  }
}