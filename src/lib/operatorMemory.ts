export type MemoryCategory =
  | "operations"
  | "staffing"
  | "marketing"
  | "refunds"
  | "reviews"
  | "menu"
  | "inventory"
  | "pricing"
  | "profitability";

export interface OperatorMemory {
  id: string;

  locationName: string;

  category: MemoryCategory;

  situation: string;

  action: string;

  outcome: string;

  lesson: string;

  successScore: number;

  confidence: number;

  reusable: boolean;

  reuseCount: number;

  createdAt: string;
}

const memoryStore: OperatorMemory[] = [];

export function remember(memory: OperatorMemory) {
  memoryStore.push(memory);
}

export function getAllMemories() {
  return [...memoryStore];
}

export function searchMemories(category?: MemoryCategory) {
  if (!category) {
    return [...memoryStore];
  }

  return memoryStore.filter(
    (memory) => memory.category === category,
  );
}

export function getReusableMemories() {
  return memoryStore.filter(
    (memory) => memory.reusable,
  );
}

export function findBestPractice(
  category: MemoryCategory,
) {
  const candidates = memoryStore
    .filter(
      (memory) =>
        memory.category === category &&
        memory.reusable,
    )
    .sort((a, b) => {
      const scoreA =
        a.successScore +
        a.confidence +
        a.reuseCount * 10;

      const scoreB =
        b.successScore +
        b.confidence +
        b.reuseCount * 10;

      return scoreB - scoreA;
    });

  return candidates[0] ?? null;
}

export function rememberOutcome(
  category: MemoryCategory,
  locationName: string,
  situation: string,
  action: string,
  outcome: string,
  lesson: string,
  successScore: number,
) {
  const reusable = successScore >= 75;

  remember({
    id: crypto.randomUUID(),
    category,
    locationName,
    situation,
    action,
    outcome,
    lesson,
    successScore,
    confidence: successScore,
    reusable,
    reuseCount: 0,
    createdAt: new Date().toISOString(),
  });
}

export function reuseMemory(id: string) {
  const memory = memoryStore.find(
    (memory) => memory.id === id,
  );

  if (!memory) return;

  memory.reuseCount += 1;
}

export function clearMemory() {
  memoryStore.length = 0;
}