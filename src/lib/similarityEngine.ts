import {
  OperatorMemory,
  getReusableMemories,
} from "./operatorMemory";

export interface SimilarityContext {
  locationName: string;

  operations: number;
  profitability: number;
  demand: number;
  staffing: number;
  marketing: number;
  service: number;

  refunds: number;
  rating: number;
}

export interface SimilarityResult {
  memory: OperatorMemory;

  similarity: number;
}

function scoreDifference(
  a: number,
  b: number,
) {
  return Math.abs(a - b);
}

function similarityScore(
  context: SimilarityContext,
  memory: OperatorMemory,
) {
  /*
    For now we compare simple text/category.
    Later we'll compare full restaurant snapshots
    from Supabase.
  */

  let score = 0;

  if (
    context.locationName ===
    memory.locationName
  ) {
    score += 20;
  }

  if (memory.reusable) {
    score += 25;
  }

  score += memory.successScore * 0.30;

  score += memory.confidence * 0.25;

  score += memory.reuseCount * 4;

  return score;
}

export function findSimilarMemories(
  context: SimilarityContext,
): SimilarityResult[] {
  return getReusableMemories()
    .map((memory) => ({
      memory,
      similarity: similarityScore(
        context,
        memory,
      ),
    }))
    .sort(
      (a, b) =>
        b.similarity -
        a.similarity,
    );
}

export function getBestHistoricalMatch(
  context: SimilarityContext,
) {
  const results =
    findSimilarMemories(context);

  return results[0] ?? null;
}