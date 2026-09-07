export interface FocusItem {
  id: string;
  title: string;
  priority: number;
}

export interface FocusSelection {
  primary: FocusItem | null;
  candidates: FocusItem[];
  generatedAt: string;
}

export function buildFocusSelection(
  items: FocusItem[],
): FocusSelection {
  const candidates = [...items].sort(
    (a, b) => b.priority - a.priority,
  );

  return {
    primary: candidates[0] ?? null,
    candidates,
    generatedAt: new Date().toISOString(),
  };
}