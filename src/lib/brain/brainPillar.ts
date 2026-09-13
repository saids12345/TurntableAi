import type {
  BrainContext,
} from "@/lib/brain/brainContext";

export interface BrainPillar {
  readonly name: string;

  execute(
    context: BrainContext,
  ): Promise<BrainContext>;
}