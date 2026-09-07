import type { BrainContext } from "@/lib/brain/brainContext";
import type { BrainLayer } from "@/lib/brain/layers/types";

export class BrainPipeline {
  constructor(
    private readonly layers: BrainLayer[],
  ) {}

  async execute(
    context: BrainContext,
  ): Promise<void> {
    for (const layer of this.layers) {
      await layer(context);
    }
  }
}