import type {
    BrainContext,
  } from "@/lib/brain/brainContext";
  
  import {
    addKnowledgeNode,
  } from "@/lib/brain/knowledgeModel";
  
  export async function runKnowledge(
    context: BrainContext,
  ): Promise<BrainContext> {
    const understanding =
      context.perception
        .businessUnderstanding;
  
    if (!understanding) {
      return context;
    }
  
    context.knowledge.knowledgeModel =
      addKnowledgeNode(
        context.knowledge.knowledgeModel!,
        {
          id: `business-understanding-${Date.now()}`,
  
          type: "observed",
  
          subject:
            "business_understanding",
  
          value: understanding,
  
          confidence:
            understanding.situation.confidence,
  
          evidence: 1,
  
          source: "perception",
  
          createdAt:
            new Date().toISOString(),
  
          updatedAt:
            new Date().toISOString(),
        },
      );
  
    return context;
  }