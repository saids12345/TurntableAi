export type KnowledgeType =
  | "foundational"
  | "learned"
  | "predicted"
  | "observed";

export interface KnowledgeNode {
  id: string;

  type: KnowledgeType;

  subject: string;

  value: unknown;

  confidence: number;

  evidence: number;

  source: string;

  createdAt: string;

  updatedAt: string;
}

export interface KnowledgeRelationship {
  id: string;

  from: string;

  to: string;

  relationship: string;

  strength: number;

  confidence: number;
}

export interface KnowledgeModel {
  nodes: KnowledgeNode[];

  relationships: KnowledgeRelationship[];

  generatedAt: string;
}

export function createKnowledgeModel(): KnowledgeModel {
  return {
    nodes: [],

    relationships: [],

    generatedAt:
      new Date().toISOString(),
  };
}
export function addKnowledgeNode(
  model: KnowledgeModel | undefined,
  node: KnowledgeNode,
): KnowledgeModel {
  const currentModel =
    model ??
    createKnowledgeModel();

  const now =
    new Date().toISOString();

  const currentNodes =
    Array.isArray(
      currentModel.nodes,
    )
      ? currentModel.nodes
      : [];

  const existingNode =
    currentNodes.find(
      (candidate) =>
        candidate.id === node.id,
    );

  const updatedNode: KnowledgeNode = {
    ...node,

    createdAt:
      existingNode?.createdAt ??
      node.createdAt ??
      now,

    updatedAt:
      now,
  };

  const nodes =
    existingNode
      ? currentNodes.map(
          (candidate) =>
            candidate.id ===
            node.id
              ? updatedNode
              : candidate,
        )
      : [
          ...currentNodes,

          updatedNode,
        ];

  return {
    ...currentModel,

    nodes,

    relationships:
      Array.isArray(
        currentModel.relationships,
      )
        ? currentModel.relationships
        : [],

    generatedAt:
      now,
  };
}