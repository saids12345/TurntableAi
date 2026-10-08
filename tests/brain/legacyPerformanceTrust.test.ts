import assert from "node:assert/strict";
import {
  readFileSync,
} from "node:fs";

const path =
  "src/app/api/ai-insights/generate/route.ts";

const source =
  readFileSync(
    path,
    "utf8",
  );

assert.equal(
  source.includes(
    '.from("performance_signal_history")',
  ),
  false,
  "AI Insights must not bypass canonical Restaurant State performance readiness.",
);

assert.equal(
  source.includes(
    "TRUSTED_PERFORMANCE_SOURCES",
  ),
  false,
  "AI Insights should rely on canonical Restaurant State trust filtering.",
);

assert.equal(
  source.includes(
    "filterReadyRestaurantData(",
  ),
  true,
  "AI Insights must require ready Restaurant State data.",
);

assert.equal(
  source.includes(
    "await getRestaurantStates({",
  ),
  true,
  "AI Insights must load canonical Restaurant State data.",
);

assert.equal(
  source.includes(
    "latestPerformanceProvenance",
  ),
  true,
  "AI Insights must retain trusted performance provenance.",
);

const autoActionsPath =
  "src/app/api/auto-actions/generate/route.ts";

const autoActionsSource =
  readFileSync(
    autoActionsPath,
    "utf8",
  );

assert.equal(
  autoActionsSource.includes(
    '.from("performance_signal_history")',
  ),
  false,
  "Auto Actions must not bypass canonical Restaurant State performance readiness.",
);

assert.equal(
  autoActionsSource.includes(
    "TRUSTED_PERFORMANCE_SOURCES",
  ),
  false,
  "Auto Actions should rely on canonical Restaurant State trust filtering.",
);

assert.equal(
  autoActionsSource.includes(
    "filterReadyRestaurantData(",
  ),
  true,
  "Auto Actions must require ready Restaurant State performance data.",
);

assert.equal(
  autoActionsSource.includes(
    "await getRestaurantStates({",
  ),
  true,
  "Auto Actions must load canonical Restaurant State data.",
);

assert.equal(
  autoActionsSource.includes(
    "latestPerformanceProvenance",
  ),
  true,
  "Auto Actions must retain trusted performance provenance.",
);

assert.equal(
  autoActionsSource.includes(
    "location.latestLaborPct !== null",
  ),
  true,
  "Labor adjustments must require actual trusted labor evidence.",
);

assert.equal(
  autoActionsSource.includes(
    'city: "San Diego"',
  ),
  false,
  "Auto Actions must not invent a hardcoded city.",
);

const salesAiPath =
  "src/app/api/sales-ai/route.ts";

const salesAiSource =
  readFileSync(
    salesAiPath,
    "utf8",
  );

assert.equal(
  salesAiSource.includes(
  '.from("performance_signal_history")',
  ),
  false,
  "Sales AI manual analysis must not access trusted performance history.",
);

assert.equal(
  salesAiSource.includes(
    "ingestPerformanceSignal",
  ),
  false,
  "Sales AI manual analysis must never enter trusted performance ingestion.",
);

assert.equal(
  salesAiSource.includes(
    "runAIKernel",
  ),
  false,
  "Sales AI manual analysis must never enter Brain reasoning.",
);

assert.equal(
  salesAiSource.includes(
    'classification: "manual_analysis"',
  ),
  true,
  "Sales AI must explicitly classify its data as manual analysis.",
);

assert.equal(
  salesAiSource.includes(
    "trustedPerformance: false",
  ),
  true,
  "Sales AI manual data must never be trusted performance.",
);

assert.equal(
  salesAiSource.includes(
    "eligibleForBrain: false",
  ),
  true,
  "Sales AI manual data must never be eligible for Brain reasoning.",
);

assert.equal(
  salesAiSource.includes(
    "persistedToPerformanceHistory: false",
  ),
  true,
  "Sales AI manual data must never claim persistence to trusted performance history.",
);

assert.equal(
  salesAiSource.includes(
    'forecastType: "heuristic_projection"',
  ),
  true,
  "Sales AI forecast must remain explicitly labeled as a heuristic projection.",
);


console.log(
  "✓ Legacy performance trust regression test passed",
);
