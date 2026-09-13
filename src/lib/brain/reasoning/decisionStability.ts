import type {
  SimulatedFuture,
  SimulatedScenario,
} from "./futureSimulator";

import {
  compareFutures,
} from "./futureComparator";

import {
  critiqueFutureDecision,
} from "./selfCritique";

import {
  runDeliberationGate,
} from "./deliberationGate";

import {
  arbitrateDecision,
} from "./decisionArbitrator";

export type DecisionStabilityVerdict =
  | "stable"
  | "sensitive"
  | "fragile"
  | "insufficient_evidence"
  | "integrity_failed";

  export type DecisionStabilityCaseStatus =
  | "executed"
  | "not_applicable";

export type DecisionStabilityCaseKind =
  | "winner_adverse"
  | "winner_supportive"
  | "competitor_pressure";

export type DecisionStabilityTarget =
  | "selected_strategy"
  | "strongest_competitor";

export interface DecisionStabilityCase {
  id: string;

  label: string;

  kind:
    DecisionStabilityCaseKind;

  target:
    DecisionStabilityTarget;

  targetStrategyId:
    string | null;

  status:
    DecisionStabilityCaseStatus;

  baselineStrategyId:
    string;

  productionWinnerStrategyId:
    string | null;

  shadowSelectedStrategyId:
    string | null;

  selectionChanged: boolean;

  comparatorBestScore:
    number | null;

  comparatorScoreGap:
    number | null;

  selfCritiqueVerdict:
    string | null;

  deliberationGateVerdict:
    string | null;

  arbitrationVerdict:
    string | null;

  arbitrationIntegrityPassed:
    boolean;

  revisionVerified:
    boolean;
}

export interface DecisionStabilityGroupSummary {
  configuredCaseCount: number;

  executedCaseCount: number;

  stableCaseCount: number;

  flipCount: number;

  retentionRate:
    number | null;
}

export interface DecisionStabilityResult {
  available: boolean;

  /**
   * Stability testing has no production authority.
   *
   * It observes how the Brain behaves under
   * deterministic perturbations only.
   */
  shadowMode: true;

  verdict:
    DecisionStabilityVerdict;

  stabilityVerified: boolean;

  baselineProductionWinnerStrategyId:
    string | null;

  baselineShadowSelectedStrategyId:
    string | null;

  baselineShadowSelectedStrategyTitle:
    string | null;

  strongestCompetitorStrategyId:
    string | null;

  strongestCompetitorStrategyTitle:
    string | null;

  totalConfiguredCases:
    number;

  executedCaseCount:
    number;

  stableCaseCount:
    number;

  flipCount:
    number;

  integrityFailureCount:
    number;

  retentionRate:
    number | null;

  winnerAdverse:
    DecisionStabilityGroupSummary;

  winnerSupportive:
    DecisionStabilityGroupSummary;

  competitorPressure:
    DecisionStabilityGroupSummary;

  cases:
    DecisionStabilityCase[];

  summary:
    string | null;

  generatedAt: string;
}

interface PerturbationDefinition {
  id: string;

  label: string;

  kind:
    DecisionStabilityCaseKind;

  target:
    DecisionStabilityTarget;

  apply:
    (
      future:
        SimulatedFuture,
    ) => boolean;
}

/*
 * We require several independently useful
 * perturbations before stability may be verified.
 */
const MIN_EXECUTED_CASES = 4;

/*
 * Small deterministic perturbations.
 *
 * These are deliberately conservative:
 * enough to test fragility without manufacturing
 * an entirely different future.
 */
const CONFIDENCE_SHIFT = 0.05;

const EXPECTED_RISK_SHIFT = 0.05;

const UNCERTAINTY_SHIFT = 0.05;

const EVIDENCE_SHIFT = 0.05;

const WORST_CASE_RISK_SHIFT = 0.05;

const WORST_CASE_IMPACT_SHIFT = 0.03;

function clamp(
  value: number,
  min: number,
  max: number,
) {
  return Math.min(
    max,
    Math.max(
      min,
      value,
    ),
  );
}

function clamp01(
  value: number,
) {
  return clamp(
    value,
    0,
    1,
  );
}

function clampImpact(
  value: number,
) {
  return clamp(
    value,
    -1,
    1,
  );
}

function round(
  value:
    number,
  places = 4,
) {
  const factor =
    10 ** places;

  return (
    Math.round(
      value * factor,
    ) / factor
  );
}

function cloneScenario(
  scenario:
    SimulatedScenario,
): SimulatedScenario {
  return {
    ...scenario,

    impact: {
      ...scenario.impact,
    },

    assumptions: [
      ...scenario.assumptions,
    ],
  };
}

function cloneFuture(
  future:
    SimulatedFuture,
): SimulatedFuture {
  return {
    ...future,

    bestCase:
      future.bestCase
        ? cloneScenario(
            future.bestCase,
          )
        : undefined,

    baseCase:
      future.baseCase
        ? cloneScenario(
            future.baseCase,
          )
        : undefined,

    worstCase:
      future.worstCase
        ? cloneScenario(
            future.worstCase,
          )
        : undefined,

    scenarios:
      future.scenarios
        ?.map(
          (scenario) =>
            cloneScenario(
              scenario,
            ),
        ),

    successMetrics:
      future.successMetrics
        ? [
            ...future
              .successMetrics,
          ]
        : undefined,

    leadingIndicators:
      future.leadingIndicators
        ? [
            ...future
              .leadingIndicators,
          ]
        : undefined,

    failureConditions:
      future.failureConditions
        ? [
            ...future
              .failureConditions,
          ]
        : undefined,

    assumptions:
      future.assumptions
        ? [
            ...future
              .assumptions,
          ]
        : undefined,

    unknowns:
      future.unknowns
        ? [
            ...future
              .unknowns,
          ]
        : undefined,
  };
}

function cloneFutures(
  futures:
    SimulatedFuture[],
) {
  return futures.map(
    (future) =>
      cloneFuture(
        future,
      ),
  );
}

function stressWorstCaseScenario(
  scenario:
    SimulatedScenario,
) {
  scenario.risk =
    clamp01(
      scenario.risk +
        WORST_CASE_RISK_SHIFT,
    );

  scenario.impact = {
    revenue:
      clampImpact(
        scenario
          .impact
          .revenue -
          WORST_CASE_IMPACT_SHIFT,
      ),

    guestExperience:
      clampImpact(
        scenario
          .impact
          .guestExperience -
          WORST_CASE_IMPACT_SHIFT,
      ),

    operations:
      clampImpact(
        scenario
          .impact
          .operations -
          WORST_CASE_IMPACT_SHIFT,
      ),
  };
}

const PERTURBATIONS:
  PerturbationDefinition[] = [
    {
      id:
        "confidence_down",

      label:
        "Selected strategy confidence -5 points",

      kind:
        "winner_adverse",

      target:
        "selected_strategy",

      apply:
        (
          future,
        ) => {
          future.confidence =
            clamp01(
              future.confidence -
                CONFIDENCE_SHIFT,
            );

          return true;
        },
    },

    {
      id:
        "expected_risk_up",

      label:
        "Selected strategy expected risk +5 points",

      kind:
        "winner_adverse",

      target:
        "selected_strategy",

      apply:
        (
          future,
        ) => {
          future.expectedRisk =
            clamp01(
              future.expectedRisk +
                EXPECTED_RISK_SHIFT,
            );

          return true;
        },
    },

    {
      id:
        "uncertainty_up",

      label:
        "Selected strategy uncertainty +5 points",

      kind:
        "winner_adverse",

      target:
        "selected_strategy",

      apply:
        (
          future,
        ) => {
          if (
            typeof future
              .uncertainty !==
            "number"
          ) {
            return false;
          }

          future.uncertainty =
            clamp01(
              future.uncertainty +
                UNCERTAINTY_SHIFT,
            );

          return true;
        },
    },

    {
      id:
        "evidence_down",

      label:
        "Selected strategy evidence coverage -5 points",

      kind:
        "winner_adverse",

      target:
        "selected_strategy",

      apply:
        (
          future,
        ) => {
          if (
            typeof future
              .evidenceCoverage !==
            "number"
          ) {
            return false;
          }

          future.evidenceCoverage =
            clamp01(
              future
                .evidenceCoverage -
                EVIDENCE_SHIFT,
            );

          return true;
        },
    },

    {
      id:
        "assumption_added",

      label:
        "Selected strategy receives one additional assumption",

      kind:
        "winner_adverse",

      target:
        "selected_strategy",

      apply:
        (
          future,
        ) => {
          future.assumptions = [
            ...(
              future
                .assumptions ??
              []
            ),

            "Decision stability stress-test assumption",
          ];

          return true;
        },
    },

    {
      id:
        "unknown_added",

      label:
        "Selected strategy receives one additional unknown",

      kind:
        "winner_adverse",

      target:
        "selected_strategy",

      apply:
        (
          future,
        ) => {
          future.unknowns = [
            ...(
              future
                .unknowns ??
              []
            ),

            "Decision stability stress-test unknown",
          ];

          return true;
        },
    },

    {
      id:
        "worst_case_stress",

      label:
        "Selected strategy worst-case downside slightly worsens",

      kind:
        "winner_adverse",

      target:
        "selected_strategy",

      apply:
        (
          future,
        ) => {
          let applied =
            false;

          if (
            future.worstCase
          ) {
            stressWorstCaseScenario(
              future.worstCase,
            );

            applied =
              true;
          }

          if (
            future.scenarios
          ) {
            for (
              const scenario
              of future.scenarios
            ) {
              if (
                scenario.name ===
                "worst_case"
              ) {
                stressWorstCaseScenario(
                  scenario,
                );

                applied =
                  true;
              }
            }
          }

          return applied;
        },
    },
        /*
     * ======================================================
     * WINNER SUPPORTIVE
     *
     * These tests move reasonable assumptions slightly
     * in favor of the current shadow-selected strategy.
     *
     * They help detect paradoxical or unstable behavior:
     * strengthening the selected strategy should not
     * normally cause the Brain to abandon it.
     * ======================================================
     */

    {
      id:
        "confidence_up",

      label:
        "Selected strategy confidence +5 points",

      kind:
        "winner_supportive",

      target:
        "selected_strategy",

      apply:
        (
          future,
        ) => {
          future.confidence =
            clamp01(
              future.confidence +
                CONFIDENCE_SHIFT,
            );

          return true;
        },
    },

    {
      id:
        "expected_risk_down",

      label:
        "Selected strategy expected risk -5 points",

      kind:
        "winner_supportive",

      target:
        "selected_strategy",

      apply:
        (
          future,
        ) => {
          future.expectedRisk =
            clamp01(
              future.expectedRisk -
                EXPECTED_RISK_SHIFT,
            );

          return true;
        },
    },

    {
      id:
        "uncertainty_down",

      label:
        "Selected strategy uncertainty -5 points",

      kind:
        "winner_supportive",

      target:
        "selected_strategy",

      apply:
        (
          future,
        ) => {
          if (
            typeof future
              .uncertainty !==
            "number"
          ) {
            return false;
          }

          future.uncertainty =
            clamp01(
              future.uncertainty -
                UNCERTAINTY_SHIFT,
            );

          return true;
        },
    },

    {
      id:
        "evidence_up",

      label:
        "Selected strategy evidence coverage +5 points",

      kind:
        "winner_supportive",

      target:
        "selected_strategy",

      apply:
        (
          future,
        ) => {
          if (
            typeof future
              .evidenceCoverage !==
            "number"
          ) {
            return false;
          }

          future.evidenceCoverage =
            clamp01(
              future
                .evidenceCoverage +
                EVIDENCE_SHIFT,
            );

          return true;
        },
    },

    /*
     * ======================================================
     * COMPETITOR PRESSURE
     *
     * These tests strengthen the strongest current
     * alternative rather than weakening the winner.
     *
     * This asks a different question:
     *
     * "How much better could the closest competitor become
     * before the Brain rationally changes its mind?"
     * ======================================================
     */

    {
      id:
        "competitor_confidence_up",

      label:
        "Strongest competitor confidence +5 points",

      kind:
        "competitor_pressure",

      target:
        "strongest_competitor",

      apply:
        (
          future,
        ) => {
          future.confidence =
            clamp01(
              future.confidence +
                CONFIDENCE_SHIFT,
            );

          return true;
        },
    },

    {
      id:
        "competitor_expected_risk_down",

      label:
        "Strongest competitor expected risk -5 points",

      kind:
        "competitor_pressure",

      target:
        "strongest_competitor",

      apply:
        (
          future,
        ) => {
          future.expectedRisk =
            clamp01(
              future.expectedRisk -
                EXPECTED_RISK_SHIFT,
            );

          return true;
        },
    },

    {
      id:
        "competitor_uncertainty_down",

      label:
        "Strongest competitor uncertainty -5 points",

      kind:
        "competitor_pressure",

      target:
        "strongest_competitor",

      apply:
        (
          future,
        ) => {
          if (
            typeof future
              .uncertainty !==
            "number"
          ) {
            return false;
          }

          future.uncertainty =
            clamp01(
              future.uncertainty -
                UNCERTAINTY_SHIFT,
            );

          return true;
        },
    },

    {
      id:
        "competitor_evidence_up",

      label:
        "Strongest competitor evidence coverage +5 points",

      kind:
        "competitor_pressure",

      target:
        "strongest_competitor",

      apply:
        (
          future,
        ) => {
          if (
            typeof future
              .evidenceCoverage !==
            "number"
          ) {
            return false;
          }

          future.evidenceCoverage =
            clamp01(
              future
                .evidenceCoverage +
                EVIDENCE_SHIFT,
            );

          return true;
        },
    },
  ];

  function buildGroupSummary(
  cases:
    DecisionStabilityCase[],
  kind:
    DecisionStabilityCaseKind,
): DecisionStabilityGroupSummary {
  const configuredCaseCount =
    PERTURBATIONS.filter(
      (perturbation) =>
        perturbation.kind ===
        kind,
    ).length;

  const executedCases =
    cases.filter(
      (testCase) =>
        testCase.kind === kind &&
        testCase.status ===
          "executed",
    );

  const executedCaseCount =
    executedCases.length;

  const flipCount =
    executedCases.filter(
      (testCase) =>
        testCase.selectionChanged,
    ).length;

  const stableCaseCount =
    executedCaseCount -
    flipCount;

  const retentionRate =
    executedCaseCount > 0
      ? round(
          stableCaseCount /
            executedCaseCount,
        )
      : null;

  return {
    configuredCaseCount,

    executedCaseCount,

    stableCaseCount,

    flipCount,

    retentionRate,
  };
}

function buildEmptyGroupSummaries() {
  return {
    winnerAdverse:
      buildGroupSummary(
        [],
        "winner_adverse",
      ),

    winnerSupportive:
      buildGroupSummary(
        [],
        "winner_supportive",
      ),

    competitorPressure:
      buildGroupSummary(
        [],
        "competitor_pressure",
      ),
  };
}

function runCognitiveDecision(
  futures:
    SimulatedFuture[],
) {
  const comparison =
    compareFutures(
      futures,
    );

  const selfCritique =
    critiqueFutureDecision(
      comparison,
    );

  const deliberationGate =
    runDeliberationGate(
      comparison,
      selfCritique,
    );

  const arbitration =
    arbitrateDecision(
      comparison,
      selfCritique,
      deliberationGate,
    );

  return {
    comparison,

    selfCritique,

    deliberationGate,

    arbitration,
  };
}

/**
 * Runs deterministic sensitivity testing over
 * the Brain's current simulated futures.
 *
 * IMPORTANT:
 *
 * This is NOT new real-world evidence.
 * It is NOT an independent model.
 * It is NOT production authority.
 *
 * It asks:
 *
 * "If reasonable small changes were made to the
 * current simulation assumptions, would the
 * Brain still reach the same final shadow choice?"
 */
export function testDecisionStability(
  futures:
    SimulatedFuture[],
): DecisionStabilityResult {
  const generatedAt =
    new Date().toISOString();
    const emptyGroupSummaries =
  buildEmptyGroupSummaries();

  if (
    futures.length === 0
  ) {
    return {
      available: false,

      shadowMode: true,

      verdict:
        "insufficient_evidence",

      stabilityVerified:
        false,

      baselineProductionWinnerStrategyId:
        null,

      baselineShadowSelectedStrategyId:
        null,

      baselineShadowSelectedStrategyTitle:
        null,

        strongestCompetitorStrategyId:
  null,

strongestCompetitorStrategyTitle:
  null,

      totalConfiguredCases:
        PERTURBATIONS.length,

      executedCaseCount:
        0,

      stableCaseCount:
        0,

      flipCount:
        0,

      integrityFailureCount:
        0,

      retentionRate:
        null,

        ...emptyGroupSummaries,

      cases: [],

      summary:
        "Decision Stability requires at least one simulated future.",

      generatedAt,
    };
  }

  const baseline =
    runCognitiveDecision(
      cloneFutures(
        futures,
      ),
    );

  const baselineProductionWinnerStrategyId =
    baseline
      .comparison
      .best
      .strategyId ??
    null;

  const baselineShadowSelectedStrategyId =
    baseline
      .arbitration
      .shadowSelectedStrategyId;

  const baselineShadowSelectedStrategyTitle =
    baseline
      .arbitration
      .shadowSelectedStrategyTitle;

      const strongestCompetitor =
  baseline
    .comparison
    .rankedFutures
    ?.slice()
    .sort(
      (a, b) =>
        a.rank - b.rank,
    )
    .find(
      (candidate) =>
        candidate.future
          .strategyId !==
        baselineShadowSelectedStrategyId,
    ) ??
  null;

const strongestCompetitorStrategyId =
  strongestCompetitor
    ?.future
    .strategyId ??
  null;

const strongestCompetitorStrategyTitle =
  strongestCompetitor
    ?.future
    .strategyTitle ??
  strongestCompetitor
    ?.future
    .strategyId ??
  null;

  if (
    !baseline
      .arbitration
      .integrity
      .passed ||
    !baselineShadowSelectedStrategyId
  ) {
    return {
      available: true,

      shadowMode: true,

      verdict:
        "integrity_failed",

      stabilityVerified:
        false,

      baselineProductionWinnerStrategyId,

      baselineShadowSelectedStrategyId,

      baselineShadowSelectedStrategyTitle,

      strongestCompetitorStrategyId,

strongestCompetitorStrategyTitle,

      totalConfiguredCases:
        PERTURBATIONS.length,

      executedCaseCount:
        0,

      stableCaseCount:
        0,

      flipCount:
        0,

      integrityFailureCount:
        1,

      retentionRate:
        null,

        ...emptyGroupSummaries,

      cases: [],

      summary:
        "Decision Stability refused to run because the baseline arbitration failed integrity verification.",

      generatedAt,
    };
  }

  const baselineFutureExists =
    futures.some(
      (future) =>
        future.strategyId ===
        baselineShadowSelectedStrategyId,
    );

  if (
    !baselineFutureExists
  ) {
    return {
      available: true,

      shadowMode: true,

      verdict:
        "integrity_failed",

      stabilityVerified:
        false,

      baselineProductionWinnerStrategyId,

      baselineShadowSelectedStrategyId,

      baselineShadowSelectedStrategyTitle,

              strongestCompetitorStrategyId,

        strongestCompetitorStrategyTitle,

      totalConfiguredCases:
        PERTURBATIONS.length,

      executedCaseCount:
        0,

      stableCaseCount:
        0,

      flipCount:
        0,

      integrityFailureCount:
        1,

      retentionRate:
        null,

                ...emptyGroupSummaries,

      cases: [],

      summary:
        "The baseline shadow-selected strategy was not present in the simulated future set.",

      generatedAt,
    };
  }

  const cases:
    DecisionStabilityCase[] = [];

  for (
    const perturbation
    of PERTURBATIONS
  ) {
    const perturbedFutures =
      cloneFutures(
        futures,
      );

        const targetStrategyId =
      perturbation.target ===
      "strongest_competitor"
        ? strongestCompetitorStrategyId
        : baselineShadowSelectedStrategyId;

    const targetFuture =
      targetStrategyId
        ? perturbedFutures.find(
            (future) =>
              future.strategyId ===
              targetStrategyId,
          ) ?? null
        : null;

    if (
      !targetFuture
    ) {
            cases.push({
        id:
          perturbation.id,

        label:
          perturbation.label,

        kind:
          perturbation.kind,

        target:
          perturbation.target,

                targetStrategyId,

        status:
          "not_applicable",

        baselineStrategyId:
          baselineShadowSelectedStrategyId,

        productionWinnerStrategyId:
          null,

        shadowSelectedStrategyId:
          null,

        selectionChanged:
          false,

        comparatorBestScore:
          null,

        comparatorScoreGap:
          null,

        selfCritiqueVerdict:
          null,

        deliberationGateVerdict:
          null,

        arbitrationVerdict:
          null,

        arbitrationIntegrityPassed:
          false,

        revisionVerified:
          false,
      });

      continue;
    }

    const applied =
      perturbation.apply(
        targetFuture,
      );

    if (
      !applied
    ) {
      cases.push({
        id:
          perturbation.id,

        label:
          perturbation.label,

        kind:
          perturbation.kind,

        target:
          perturbation.target,

                targetStrategyId,

        status:
          "not_applicable",

        baselineStrategyId:
          baselineShadowSelectedStrategyId,

        productionWinnerStrategyId:
          null,

        shadowSelectedStrategyId:
          null,

        selectionChanged:
          false,

        comparatorBestScore:
          null,

        comparatorScoreGap:
          null,

        selfCritiqueVerdict:
          null,

        deliberationGateVerdict:
          null,

        arbitrationVerdict:
          null,

        arbitrationIntegrityPassed:
          true,

        revisionVerified:
          false,
      });

      continue;
    }

    const result =
      runCognitiveDecision(
        perturbedFutures,
      );

    const shadowSelectedStrategyId =
      result
        .arbitration
        .shadowSelectedStrategyId;

    const selectionChanged =
      shadowSelectedStrategyId !==
      baselineShadowSelectedStrategyId;

    cases.push({
      id:
        perturbation.id,

      label:
        perturbation.label,

      kind:
        perturbation.kind,

      target:
        perturbation.target,

            targetStrategyId,

      status:
        "executed",

      baselineStrategyId:
        baselineShadowSelectedStrategyId,

      productionWinnerStrategyId:
        result
          .comparison
          .best
          .strategyId ??
        null,

      shadowSelectedStrategyId,

      selectionChanged,

      comparatorBestScore:
        typeof result
          .comparison
          .bestScore ===
        "number"
          ? round(
              result
                .comparison
                .bestScore,
            )
          : null,

      comparatorScoreGap:
        typeof result
          .comparison
          .scoreGap ===
        "number"
          ? round(
              result
                .comparison
                .scoreGap,
            )
          : null,

      selfCritiqueVerdict:
        result
          .selfCritique
          .verdict ??
        null,

      deliberationGateVerdict:
        result
          .deliberationGate
          .verdict ??
        null,

      arbitrationVerdict:
        result
          .arbitration
          .verdict ??
        null,

      arbitrationIntegrityPassed:
        result
          .arbitration
          .integrity
          .passed,

      revisionVerified:
        result
          .arbitration
          .revisionVerified,
    });
  }

  const executedCases =
    cases.filter(
      (testCase) =>
        testCase.status ===
        "executed",
    );

  const executedCaseCount =
    executedCases.length;

  const integrityFailureCount =
    executedCases.filter(
      (testCase) =>
        !testCase
          .arbitrationIntegrityPassed,
    ).length;

  const flipCount =
    executedCases.filter(
      (testCase) =>
        testCase
          .selectionChanged,
    ).length;

  const stableCaseCount =
    executedCaseCount -
    flipCount;

  const retentionRate =
    executedCaseCount > 0
      ? round(
          stableCaseCount /
            executedCaseCount,
        )
      : null;

      const winnerAdverse =
  buildGroupSummary(
    cases,
    "winner_adverse",
  );

const winnerSupportive =
  buildGroupSummary(
    cases,
    "winner_supportive",
  );

const competitorPressure =
  buildGroupSummary(
    cases,
    "competitor_pressure",
  );

  if (
    executedCaseCount <
    MIN_EXECUTED_CASES
  ) {
    return {
      available: true,

      shadowMode: true,

      verdict:
        "insufficient_evidence",

      stabilityVerified:
        false,

      baselineProductionWinnerStrategyId,

      baselineShadowSelectedStrategyId,

      baselineShadowSelectedStrategyTitle,

      strongestCompetitorStrategyId,

strongestCompetitorStrategyTitle,

      totalConfiguredCases:
        PERTURBATIONS.length,

      executedCaseCount,

      stableCaseCount,

      flipCount,

      integrityFailureCount,

      retentionRate,

      winnerAdverse,

winnerSupportive,

competitorPressure,

      
      cases,

      summary:
        `Only ${executedCaseCount} applicable stability perturbations were available; at least ${MIN_EXECUTED_CASES} are required.`,

      generatedAt,
    };
  }

  if (
    integrityFailureCount > 0
  ) {
    return {
      available: true,

      shadowMode: true,

      verdict:
        "integrity_failed",

      stabilityVerified:
        false,

      baselineProductionWinnerStrategyId,

      baselineShadowSelectedStrategyId,

      baselineShadowSelectedStrategyTitle,
      
      strongestCompetitorStrategyId,

strongestCompetitorStrategyTitle,

      totalConfiguredCases:
        PERTURBATIONS.length,

      executedCaseCount,

      stableCaseCount,

      flipCount,

      integrityFailureCount,

      retentionRate,

      winnerAdverse,

winnerSupportive,

competitorPressure,

      cases,

      summary:
        "At least one perturbed decision failed arbitration integrity, so stability verification failed closed.",

      generatedAt,
    };
  }

    const groupsAvailable =
    winnerAdverse.executedCaseCount > 0 &&
    winnerSupportive.executedCaseCount > 0 &&
    competitorPressure.executedCaseCount > 0;

  const supportiveConsistent =
    winnerSupportive.flipCount === 0;

  const adverseRetention =
    winnerAdverse.retentionRate ?? 0;

  const competitorRetention =
    competitorPressure.retentionRate ?? 0;

  let verdict:
    DecisionStabilityVerdict;

  if (!groupsAvailable) {
    verdict =
      "insufficient_evidence";
  } else if (
    supportiveConsistent &&
    adverseRetention >= 0.8 &&
    competitorRetention >= 0.75
  ) {
    verdict =
      "stable";
  } else if (
    supportiveConsistent &&
    adverseRetention >= 0.5 &&
    competitorRetention >= 0.5
  ) {
    verdict =
      "sensitive";
  } else {
    verdict =
      "fragile";
  }

  const stabilityVerified =
    verdict ===
    "stable";

  const summary =
    verdict ===
    "stable"
      ? `"${baselineShadowSelectedStrategyTitle ?? baselineShadowSelectedStrategyId}" remained strong across supportive, adverse, and competitor-pressure testing.`
      : verdict ===
          "sensitive"
        ? `"${baselineShadowSelectedStrategyTitle ?? baselineShadowSelectedStrategyId}" is directionally sound but changes under meaningful pressure and should remain under observation.`
        : verdict ===
            "insufficient_evidence"
          ? "Decision Stability did not have enough balanced test coverage to verify the decision."
          : `"${baselineShadowSelectedStrategyTitle ?? baselineShadowSelectedStrategyId}" is too sensitive to small adverse or competitor changes for autonomous decision authority.`;
  return {
    available: true,

    shadowMode: true,

    verdict,

    stabilityVerified,

    baselineProductionWinnerStrategyId,

    baselineShadowSelectedStrategyId,

    baselineShadowSelectedStrategyTitle,
    
    strongestCompetitorStrategyId,

strongestCompetitorStrategyTitle,

    totalConfiguredCases:
      PERTURBATIONS.length,

    executedCaseCount,

    stableCaseCount,

    flipCount,

    integrityFailureCount,

    retentionRate,

    winnerAdverse,

winnerSupportive,

competitorPressure,

    cases,

    summary,

    generatedAt,
  };
}