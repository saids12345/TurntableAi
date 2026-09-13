import type {
  DecisionAuthorityResult,
} from "./decisionAuthority";

import {
  evaluateAuthorityPolicy,
  type AuthorityPolicyResult,
} from "./authorityPolicy";

import type {
  OperatorWorkflow,
} from "@/lib/operatorWorkflowEngine";

export type WorkflowAuthorityHandoffResult = {
  available: boolean;

  identityVerified: boolean;

  workflowStrategyId:
    string | null;

  authorityStrategyId:
    string | null;

  policy:
    AuthorityPolicyResult;

  reason:
    string;

  generatedAt:
    string;
};

function getWorkflowStrategyId(
  workflow:
    | OperatorWorkflow
    | null
    | undefined,
): string | null {
  const candidate =
    workflow
      ?.metadata?.[
        "cognitiveStrategyId"
      ];

  return typeof candidate ===
    "string"
    ? candidate
    : null;
}

/**
 * Final safety handoff between:
 *
 * Decision Authority
 * → executable Operator Workflow
 * → Authority Policy
 *
 * The workflow safety profile may only participate
 * when the workflow belongs to the exact strategy
 * selected by Decision Authority.
 *
 * Strategy identity mismatch fails closed.
 */
export function evaluateWorkflowAuthorityHandoff(
  authority:
    | DecisionAuthorityResult
    | null
    | undefined,

  workflow:
    | OperatorWorkflow
    | null
    | undefined,
): WorkflowAuthorityHandoffResult {
  const generatedAt =
    new Date().toISOString();

  const workflowStrategyId =
    getWorkflowStrategyId(
      workflow,
    );

  const authorityStrategyId =
    authority
      ?.shadowSelectedStrategyId ??
    null;

  const identityVerified =
    Boolean(
      workflowStrategyId &&
      authorityStrategyId &&
      workflowStrategyId ===
        authorityStrategyId,
    );

  const policy =
    evaluateAuthorityPolicy(
      authority,

      identityVerified &&
      workflow
        ? workflow.authoritySafety
        : null,
    );

  if (
    !authority ||
    !workflow
  ) {
    return {
      available: false,

      identityVerified:
        false,

      workflowStrategyId,

      authorityStrategyId,

      policy,

      reason:
        "Workflow Authority handoff is unavailable because Decision Authority or the executable workflow is missing.",

      generatedAt,
    };
  }

  if (
    !identityVerified
  ) {
    return {
      available: true,

      identityVerified:
        false,

      workflowStrategyId,

      authorityStrategyId,

      policy,

      reason:
        "Workflow safety data was rejected because the executable workflow does not match the strategy selected by Decision Authority.",

      generatedAt,
    };
  }

  return {
    available: true,

    identityVerified:
      true,

    workflowStrategyId,

    authorityStrategyId,

    policy,

    reason:
      "Workflow identity was verified and its safety profile was passed to Authority Policy.",

    generatedAt,
  };
}