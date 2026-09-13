import type { BrainContext } from "@/lib/brain/brainContext";

export type BrainLayer = (
  context: BrainContext,
) => Promise<void>;