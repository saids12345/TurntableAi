export type BusinessMetric =
  | "revenue"
  | "orders"
  | "demand"
  | "avg_rating"
  | "review_issues"
  | "refunds"
  | "labor_pct"
  | "margin_pct"
  | "service_quality"
  | "staffing"
  | "marketing"
  | "inventory"
  | "waste"
  | "wait_time";

export type RelationshipDirection =
  | "positive"
  | "negative";

export type KnowledgeSource =
  | "foundational"
  | "learned";

export interface BusinessRelationship {
  id: string;

  cause: BusinessMetric;

  effect: BusinessMetric;

  direction: RelationshipDirection;

  strength: number;

  confidence: number;

  source: KnowledgeSource;

  explanation: string;

  locationName?: string | null;

  evidenceCount?: number;

  createdAt: string;

  updatedAt: string;
}

export interface BusinessKnowledge {
  relationships: BusinessRelationship[];

  foundationalRelationships: BusinessRelationship[];

  learnedRelationships: BusinessRelationship[];

  generatedAt: string;
}

const FOUNDATIONAL_RELATIONSHIPS: BusinessRelationship[] = [
  {
    id: "ratings-to-demand",

    cause: "avg_rating",

    effect: "demand",

    direction: "positive",

    strength: 0.8,

    confidence: 0.9,

    source: "foundational",

    explanation:
      "Stronger guest ratings generally improve trust, discovery, and customer demand.",

    evidenceCount: 0,

    createdAt: "2026-01-01T00:00:00.000Z",

    updatedAt: "2026-01-01T00:00:00.000Z",
  },

  {
    id: "demand-to-orders",

    cause: "demand",

    effect: "orders",

    direction: "positive",

    strength: 0.9,

    confidence: 0.95,

    source: "foundational",

    explanation:
      "Higher customer demand generally produces more completed orders.",

    evidenceCount: 0,

    createdAt: "2026-01-01T00:00:00.000Z",

    updatedAt: "2026-01-01T00:00:00.000Z",
  },

  {
    id: "orders-to-revenue",

    cause: "orders",

    effect: "revenue",

    direction: "positive",

    strength: 0.95,

    confidence: 0.98,

    source: "foundational",

    explanation:
      "More completed orders generally increase restaurant revenue.",

    evidenceCount: 0,

    createdAt: "2026-01-01T00:00:00.000Z",

    updatedAt: "2026-01-01T00:00:00.000Z",
  },

  {
    id: "refunds-to-margin",

    cause: "refunds",

    effect: "margin_pct",

    direction: "negative",

    strength: 0.75,

    confidence: 0.9,

    source: "foundational",

    explanation:
      "Higher refund volume usually reduces realized revenue and operating margin.",

    evidenceCount: 0,

    createdAt: "2026-01-01T00:00:00.000Z",

    updatedAt: "2026-01-01T00:00:00.000Z",
  },

  {
    id: "refunds-to-ratings",

    cause: "refunds",

    effect: "avg_rating",

    direction: "negative",

    strength: 0.65,

    confidence: 0.82,

    source: "foundational",

    explanation:
      "Frequent refunds often signal guest dissatisfaction and can weaken ratings.",

    evidenceCount: 0,

    createdAt: "2026-01-01T00:00:00.000Z",

    updatedAt: "2026-01-01T00:00:00.000Z",
  },

  {
    id: "wait-time-to-ratings",

    cause: "wait_time",

    effect: "avg_rating",

    direction: "negative",

    strength: 0.75,

    confidence: 0.88,

    source: "foundational",

    explanation:
      "Longer guest wait times commonly reduce satisfaction and review ratings.",

    evidenceCount: 0,

    createdAt: "2026-01-01T00:00:00.000Z",

    updatedAt: "2026-01-01T00:00:00.000Z",
  },

  {
    id: "staffing-to-service-quality",

    cause: "staffing",

    effect: "service_quality",

    direction: "positive",

    strength: 0.7,

    confidence: 0.82,

    source: "foundational",

    explanation:
      "Adequate staffing generally improves service consistency and execution quality.",

    evidenceCount: 0,

    createdAt: "2026-01-01T00:00:00.000Z",

    updatedAt: "2026-01-01T00:00:00.000Z",
  },

  {
    id: "service-quality-to-ratings",

    cause: "service_quality",

    effect: "avg_rating",

    direction: "positive",

    strength: 0.85,

    confidence: 0.92,

    source: "foundational",

    explanation:
      "Better service quality generally improves guest satisfaction and ratings.",

    evidenceCount: 0,

    createdAt: "2026-01-01T00:00:00.000Z",

    updatedAt: "2026-01-01T00:00:00.000Z",
  },

  {
    id: "labor-to-margin",

    cause: "labor_pct",

    effect: "margin_pct",

    direction: "negative",

    strength: 0.8,

    confidence: 0.9,

    source: "foundational",

    explanation:
      "Higher labor cost as a percentage of sales usually compresses operating margin.",

    evidenceCount: 0,

    createdAt: "2026-01-01T00:00:00.000Z",

    updatedAt: "2026-01-01T00:00:00.000Z",
  },

  {
    id: "marketing-to-demand",

    cause: "marketing",

    effect: "demand",

    direction: "positive",

    strength: 0.6,

    confidence: 0.72,

    source: "foundational",

    explanation:
      "Effective marketing can increase awareness, visits, and customer demand.",

    evidenceCount: 0,

    createdAt: "2026-01-01T00:00:00.000Z",

    updatedAt: "2026-01-01T00:00:00.000Z",
  },

  {
    id: "waste-to-margin",

    cause: "waste",

    effect: "margin_pct",

    direction: "negative",

    strength: 0.8,

    confidence: 0.9,

    source: "foundational",

    explanation:
      "Higher food and inventory waste generally reduces restaurant profitability.",

    evidenceCount: 0,

    createdAt: "2026-01-01T00:00:00.000Z",

    updatedAt: "2026-01-01T00:00:00.000Z",
  },

  {
    id: "inventory-to-waste",

    cause: "inventory",

    effect: "waste",

    direction: "positive",

    strength: 0.55,

    confidence: 0.65,

    source: "foundational",

    explanation:
      "Excess inventory can increase spoilage, overproduction, and avoidable waste.",

    evidenceCount: 0,

    createdAt: "2026-01-01T00:00:00.000Z",

    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

export function buildBusinessKnowledge(
  learnedRelationships: BusinessRelationship[] = [],
): BusinessKnowledge {
  const foundationalRelationships =
    FOUNDATIONAL_RELATIONSHIPS.map(
      (relationship) => ({
        ...relationship,
      }),
    );

  const validLearnedRelationships =
    learnedRelationships.filter(
      (relationship) =>
        relationship.source === "learned",
    );

  return {
    relationships: [
      ...foundationalRelationships,
      ...validLearnedRelationships,
    ],

    foundationalRelationships,

    learnedRelationships:
      validLearnedRelationships,

    generatedAt:
      new Date().toISOString(),
  };
}

export function findBusinessRelationships(
  knowledge: BusinessKnowledge,
  metric: BusinessMetric,
): BusinessRelationship[] {
  return knowledge.relationships.filter(
    (relationship) =>
      relationship.cause === metric ||
      relationship.effect === metric,
  );
}