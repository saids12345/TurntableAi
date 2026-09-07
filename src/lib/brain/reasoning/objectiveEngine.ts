import type {
    BrainContext,
  } from "@/lib/brain/brainContext";
  
  export interface CurrentObjective {
    id: string;
  
    title: string;
  
    reason: string;
  
    confidence: number;
  }
  
  export function determineObjective(
    context: BrainContext,
  ): CurrentObjective {
    const understanding =
      context.perception
        .businessUnderstanding;
  
    if (!understanding) {
      return {
        id: "maintain",
  
        title:
          "Maintain Stable Operations",
  
        reason:
          "No significant business risks have been identified.",
  
        confidence: 0.80,
      };
    }
  
    return {
      id:
        understanding.focus?.id ??
        "maintain",
  
      title:
        understanding.focus?.title ??
        "Maintain Stable Operations",
  
      reason:
        understanding.situation.summary,
  
      confidence: 0.90,
    };
  }