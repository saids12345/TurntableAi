import { NextResponse } from "next/server";
import { learnFromExecution } from "@/lib/outcomeLearningEngine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Temporary demo data.
    // Later this will come from the Execution Engine and Operator Memory.
    const execution = {
      actionId: "demo-action",
      actionTitle: "Launch Lunch Promotion",
      locationName: "Demo Restaurant",
      executedAt: new Date().toISOString(),

      before: {
        revenue: 4200,
        refunds: 8,
        laborPct: 31,
        avgRating: 4.4,
      },

      after: {
        revenue: 4680,
        refunds: 6,
        laborPct: 30,
        avgRating: 4.6,
      },
    };

    const learning = learnFromExecution(execution);

    return NextResponse.json({
      ok: true,
      execution,
      learning,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("outcome-learning-engine/run error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Outcome Learning Engine failed: ${error.message}`
            : "Outcome Learning Engine failed",
      },
      { status: 500 },
    );
  }
}