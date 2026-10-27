import assert from "node:assert/strict";

import {
  getAutoActionEvidenceRequirement,
  isAutoActionEvidenceSatisfied,
} from "@/lib/autoActionEvidence";

function signal(type: string) {
  return { trigger: { type } };
}

assert.equal(
  getAutoActionEvidenceRequirement(signal("traffic_decline")),
  "performance",
);

assert.equal(
  getAutoActionEvidenceRequirement(signal("refund_spike")),
  "performance",
);

assert.equal(
  getAutoActionEvidenceRequirement(signal("guest_sentiment_risk")),
  "reviews",
);

assert.equal(
  getAutoActionEvidenceRequirement(signal("throughput_pressure")),
  "reviews",
);

assert.equal(
  getAutoActionEvidenceRequirement(signal("mixed_signals")),
  "unverified",
);

assert.equal(
  getAutoActionEvidenceRequirement(null),
  "unverified",
);

// Sales data cannot prove a refund problem.
assert.equal(
  isAutoActionEvidenceSatisfied({
    sourceSignal: signal("refund_spike"),
    hasFreshOwnedPerformanceEvidence: true,
    hasFreshOwnedReviewEvidence: false,
    verifiedSignals: { salesDeltaPct: -20, refunds: null },
  }),
  false,
);

// A verified refund count can support the claim.
assert.equal(
  isAutoActionEvidenceSatisfied({
    sourceSignal: signal("refund_spike"),
    hasFreshOwnedPerformanceEvidence: true,
    hasFreshOwnedReviewEvidence: false,
    verifiedSignals: { refunds: 5 },
  }),
  true,
);

// Reviews cannot validate POS refund claims.
assert.equal(
  isAutoActionEvidenceSatisfied({
    sourceSignal: signal("refund_spike"),
    hasFreshOwnedPerformanceEvidence: false,
    hasFreshOwnedReviewEvidence: true,
    verifiedSignals: { refunds: 72 },
  }),
  false,
);

// Missing source metrics must fail closed.
assert.equal(
  isAutoActionEvidenceSatisfied({
    sourceSignal: signal("refund_spike"),
    hasFreshOwnedPerformanceEvidence: true,
    hasFreshOwnedReviewEvidence: false,
  }),
  false,
);

// Verified sales decline.
assert.equal(
  isAutoActionEvidenceSatisfied({
    sourceSignal: signal("traffic_decline"),
    hasFreshOwnedPerformanceEvidence: true,
    hasFreshOwnedReviewEvidence: false,
    verifiedSignals: { salesDeltaPct: -15 },
  }),
  true,
);

// Sales above the threshold do not qualify.
assert.equal(
  isAutoActionEvidenceSatisfied({
    sourceSignal: signal("traffic_decline"),
    hasFreshOwnedPerformanceEvidence: true,
    hasFreshOwnedReviewEvidence: false,
    verifiedSignals: { salesDeltaPct: -3 },
  }),
  false,
);

// Verified Google review evidence.
assert.equal(
  isAutoActionEvidenceSatisfied({
    sourceSignal: signal("guest_sentiment_risk"),
    hasFreshOwnedPerformanceEvidence: false,
    hasFreshOwnedReviewEvidence: true,
    verifiedSignals: { negativeReviewCount: 3 },
  }),
  true,
);

// POS evidence cannot validate guest sentiment.
assert.equal(
  isAutoActionEvidenceSatisfied({
    sourceSignal: signal("guest_sentiment_risk"),
    hasFreshOwnedPerformanceEvidence: true,
    hasFreshOwnedReviewEvidence: false,
    verifiedSignals: { negativeReviewCount: 3 },
  }),
  false,
);

// Labor pressure requires a verified labor metric.
assert.equal(
  isAutoActionEvidenceSatisfied({
    sourceSignal: signal("ops_pressure"),
    hasFreshOwnedPerformanceEvidence: true,
    hasFreshOwnedReviewEvidence: false,
    verifiedSignals: { laborPct: null },
  }),
  false,
);

// Review-based service friction requires review evidence.
assert.equal(
  isAutoActionEvidenceSatisfied({
    sourceSignal: signal("throughput_pressure"),
    hasFreshOwnedPerformanceEvidence: false,
    hasFreshOwnedReviewEvidence: true,
    verifiedSignals: { reviewIssues: ["long wait time"] },
  }),
  true,
);

// Unknown claims never qualify automatically.
assert.equal(
  isAutoActionEvidenceSatisfied({
    sourceSignal: signal("unknown"),
    hasFreshOwnedPerformanceEvidence: true,
    hasFreshOwnedReviewEvidence: true,
    verifiedSignals: { refunds: 100 },
  }),
  false,
);

console.log("✓ Auto Action Evidence Policy regression test passed");
