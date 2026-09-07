import type {
  DecisionAuthorityResult,
} from "./decisionAuthority";

export type AuthorityPolicyRiskLevel =
  | "low"
  | "medium"
  | "high"
  | "critical"
  | "unknown";

export type AuthorityPolicyReversibility =
  | "easy"
  | "moderate"
  | "hard"
  | "irreversible"
  | "unknown";

export type AuthorityPolicyFinancialExposure =
  | "none"
  | "low"
  | "medium"
  | "high"
  | "unknown";

export type AuthorityPolicyBoolean =
  | boolean
  | "unknown";

export interface AuthorityPolicyContext {
  riskLevel:
    AuthorityPolicyRiskLevel;

  reversibility:
    AuthorityPolicyReversibility;

  financialExposure:
    AuthorityPolicyFinancialExposure;

  customerFacing:
    AuthorityPolicyBoolean;

  legalOrComplianceImpact:
    AuthorityPolicyBoolean;
}


export type AuthorityPolicyVerdict =
  | "production_winner_preserved"
  | "blocked"
  | "human_approval_required"
  | "shadow_automation_eligible"
  | "insufficient_evidence"
  | "integrity_failed";

export interface AuthorityPolicyResult {
  available: boolean;

  /*
   * Policy remains shadow-only.
   * It cannot execute an action.
   */
  shadowMode: true;

  productionAuthorityGranted: false;

  verdict:
    AuthorityPolicyVerdict;

  productionWinnerStrategyId:
    string | null;

  shadowSelectedStrategyId:
    string | null;

  authorityEligibleInShadow:
    boolean;

  automationEligibleInShadow:
    boolean;

  humanApprovalRequired:
    boolean;

  blockers: string[];

  reason:
    string | null;

  integrity: {
    authorityAvailable:
      boolean;

    authorityIntegrityPassed:
      boolean;

    policyContextAvailable:
      boolean;

    passed:
      boolean;
  };

  generatedAt: string;
}

export function evaluateAuthorityPolicy(
  authority:
    | DecisionAuthorityResult
    | null
    | undefined,
  context:
    | AuthorityPolicyContext
    | null
    | undefined,
): AuthorityPolicyResult {
  const generatedAt =
    new Date().toISOString();

  const productionWinnerStrategyId =
    authority
      ?.productionWinnerStrategyId ??
    null;

  const shadowSelectedStrategyId =
    authority
      ?.shadowSelectedStrategyId ??
    null;

  const authorityAvailable =
    Boolean(
      authority?.available,
    );

  const authorityIntegrityPassed =
    Boolean(
      authority
        ?.integrity
        .passed,
    );

  const policyContextAvailable =
    Boolean(
      context,
    );

  if (
    !authority ||
    !authorityAvailable
  ) {
    return {
      available: false,

      shadowMode: true,

      productionAuthorityGranted:
        false,

      verdict:
        "insufficient_evidence",

      productionWinnerStrategyId,

      shadowSelectedStrategyId,

      authorityEligibleInShadow:
        false,

      automationEligibleInShadow:
        false,

      humanApprovalRequired:
        false,

      blockers: [
        "Decision Authority is unavailable.",
      ],

      reason:
        "Authority Policy requires a valid Decision Authority result.",

      integrity: {
        authorityAvailable,

        authorityIntegrityPassed,

        policyContextAvailable,

        passed:
          false,
      },

      generatedAt,
    };
  }

  if (
    !authorityIntegrityPassed
  ) {
    return {
      available: true,

      shadowMode: true,

      productionAuthorityGranted:
        false,

      verdict:
        "integrity_failed",

      productionWinnerStrategyId,

      shadowSelectedStrategyId,

      authorityEligibleInShadow:
        false,

      automationEligibleInShadow:
        false,

      humanApprovalRequired:
        false,

      blockers: [
        "Decision Authority integrity failed.",
      ],

      reason:
        "Authority Policy failed closed because the upstream authority state was not verified.",

      integrity: {
        authorityAvailable,

        authorityIntegrityPassed,

        policyContextAvailable,

        passed:
          false,
      },

      generatedAt,
    };
  }

  /*
   * No changed recommendation exists.
   */
  if (
    !authority
      .changedFromProduction
  ) {
    return {
      available: true,

      shadowMode: true,

      productionAuthorityGranted:
        false,

      verdict:
        "production_winner_preserved",

      productionWinnerStrategyId,

      shadowSelectedStrategyId,

      authorityEligibleInShadow:
        false,

      automationEligibleInShadow:
        false,

      humanApprovalRequired:
        false,

      blockers: [],

      reason:
        "No verified revision is currently requesting authority.",

      integrity: {
        authorityAvailable,

        authorityIntegrityPassed,

        policyContextAvailable,

        passed:
          true,
      },

      generatedAt,
    };
  }

  /*
   * A revision must first pass Decision Authority.
   */
  if (
    !authority
      .authorityEligibleInShadow
  ) {
    return {
      available: true,

      shadowMode: true,

      productionAuthorityGranted:
        false,

      verdict:
        "blocked",

      productionWinnerStrategyId,

      shadowSelectedStrategyId,

      authorityEligibleInShadow:
        false,

      automationEligibleInShadow:
        false,

      humanApprovalRequired:
        false,

      blockers: [
        "Revision has not passed Decision Authority.",
      ],

      reason:
        "The proposed revision is not eligible for policy evaluation yet.",

      integrity: {
        authorityAvailable,

        authorityIntegrityPassed,

        policyContextAvailable,

        passed:
          true,
      },

      generatedAt,
    };
  }

  /*
   * Never guess risk.
   *
   * If policy context is missing, fail closed.
   */
  if (!context) {
    return {
      available: true,

      shadowMode: true,

      productionAuthorityGranted:
        false,

      verdict:
        "insufficient_evidence",

      productionWinnerStrategyId,

      shadowSelectedStrategyId,

      authorityEligibleInShadow:
        true,

      automationEligibleInShadow:
        false,

      humanApprovalRequired:
        true,

      blockers: [
        "Action risk context is missing.",
      ],

      reason:
        "A verified revision cannot become automation-eligible until its operational risk is known.",

      integrity: {
        authorityAvailable,

        authorityIntegrityPassed,

        policyContextAvailable:

          false,

        passed:
          false,
      },

      generatedAt,
    };
  }

    const blockers:
    string[] = [];

  const hasUnknownPolicyData =
    context.riskLevel ===
      "unknown" ||
    context.reversibility ===
      "unknown" ||
    context.financialExposure ===
      "unknown" ||
    context.customerFacing ===
      "unknown" ||
    context
      .legalOrComplianceImpact ===
      "unknown";

  if (
    context.riskLevel ===
    "unknown"
  ) {
    blockers.push(
      "Operational risk is unknown.",
    );
  } else if (
    context.riskLevel !==
    "low"
  ) {
    blockers.push(
      `Operational risk is ${context.riskLevel}.`,
    );
  }

  if (
    context.reversibility ===
    "unknown"
  ) {
    blockers.push(
      "Action reversibility is unknown.",
    );
  } else if (
    context.reversibility !==
    "easy"
  ) {
    blockers.push(
      `Action reversibility is ${context.reversibility}.`,
    );
  }

  if (
    context.financialExposure ===
    "unknown"
  ) {
    blockers.push(
      "Financial exposure is unknown.",
    );
  } else if (
    context.financialExposure !==
    "none"
  ) {
    blockers.push(
      `Financial exposure is ${context.financialExposure}.`,
    );
  }

  if (
    context.customerFacing ===
    "unknown"
  ) {
    blockers.push(
      "Customer-facing impact is unknown.",
    );
  } else if (
    context.customerFacing ===
    true
  ) {
    blockers.push(
      "Action directly affects customers.",
    );
  }

  if (
    context
      .legalOrComplianceImpact ===
    "unknown"
  ) {
    blockers.push(
      "Legal or compliance impact is unknown.",
    );
  } else if (
    context
      .legalOrComplianceImpact ===
    true
  ) {
    blockers.push(
      "Action has legal or compliance impact.",
    );
  }

  /*
   * Unknown policy data must fail closed.
   */
  if (
    hasUnknownPolicyData
  ) {
    return {
      available: true,

      shadowMode: true,

      productionAuthorityGranted:
        false,

      verdict:
        "insufficient_evidence",

      productionWinnerStrategyId,

      shadowSelectedStrategyId,

      authorityEligibleInShadow:
        true,

      automationEligibleInShadow:
        false,

      humanApprovalRequired:
        true,

      blockers,

      reason:
        "A verified revision cannot become automation-eligible until every required policy risk dimension is known.",

      integrity: {
        authorityAvailable,

        authorityIntegrityPassed,

        policyContextAvailable,

        passed:
          false,
      },

      generatedAt,
    };
  }

  /*
   * Conservative automation policy.
   */
  const automationEligibleInShadow =
    context.riskLevel ===
      "low" &&
    context.reversibility ===
      "easy" &&
    context.financialExposure ===
      "none" &&
    context.customerFacing ===
      false &&
    context
      .legalOrComplianceImpact ===
      false;

  const humanApprovalRequired =
    !automationEligibleInShadow;

  return {
    available: true,

    shadowMode: true,

    productionAuthorityGranted:
      false,

    verdict:
      automationEligibleInShadow
        ? "shadow_automation_eligible"
        : "human_approval_required",

    productionWinnerStrategyId,

    shadowSelectedStrategyId,

    authorityEligibleInShadow:
      true,

    automationEligibleInShadow,

    humanApprovalRequired,

    blockers,

    reason:
      automationEligibleInShadow
        ? "The revision passed Decision Authority and meets the conservative low-risk policy for shadow automation eligibility."
        : "The revision passed Decision Authority, but policy requires human approval before execution.",

    integrity: {
      authorityAvailable,

      authorityIntegrityPassed,

      policyContextAvailable,

      passed:
        true,
    },

    generatedAt,
  };
}