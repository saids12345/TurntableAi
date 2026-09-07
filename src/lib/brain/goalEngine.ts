export type GoalCategory =
  | "revenue"
  | "profit"
  | "guest_satisfaction"
  | "guest_retention"
  | "labor_efficiency"
  | "food_cost"
  | "inventory"
  | "marketing"
  | "operations"
  | "reputation"
  | "growth"
  | "cash_flow";

export interface BusinessGoal {
  category: GoalCategory;

  priority: number;

  reason: string;

  confidence: number;
}

export interface GoalAssessment {
  primaryGoal: BusinessGoal;

  secondaryGoals: BusinessGoal[];

  summary: string;

  generatedAt: string;
}

export interface GoalInput {
  revenueTrend: number;

  profitMargin: number;

  averageRating: number;

  repeatGuestRate: number;

  laborCostPercentage: number;

  foodCostPercentage: number;

  inventoryWastePercentage: number;

  marketingPerformance: number;

  operationalHealth: number;

  cashFlowHealth: number;

  now?: Date;
}
function clamp(
    value: number,
    minimum = 0,
    maximum = 100,
  ): number {
    return Math.min(
      maximum,
      Math.max(minimum, value),
    );
  }
  function buildGoal(
    category: GoalCategory,
    priority: number,
    reason: string,
    confidence: number,
  ): BusinessGoal {
    return {
      category,
  
      priority: clamp(priority),
  
      reason,
  
      confidence: clamp(confidence),
    };
  }
  function evaluateGoals(
    input: GoalInput,
  ): BusinessGoal[] {
    const goals: BusinessGoal[] = [];
  
    goals.push(
      buildGoal(
        "revenue",
        Math.max(0, 100 - input.revenueTrend),
        "Revenue growth should improve.",
        85,
      ),
    );
  
    goals.push(
      buildGoal(
        "profit",
        Math.max(0, 100 - input.profitMargin),
        "Profitability should improve.",
        90,
      ),
    );
  
    goals.push(
      buildGoal(
        "guest_satisfaction",
        Math.max(
          0,
          100 - input.averageRating * 20,
        ),
        "Guest experience should improve.",
        85,
      ),
    );
  
    goals.push(
      buildGoal(
        "guest_retention",
        Math.max(
          0,
          100 - input.repeatGuestRate,
        ),
        "Guest retention should improve.",
        80,
      ),
    );
  
    goals.push(
      buildGoal(
        "labor_efficiency",
        Math.max(
          0,
          input.laborCostPercentage - 20,
        ),
        "Labor efficiency should improve.",
        85,
      ),
    );
  
    goals.push(
      buildGoal(
        "food_cost",
        Math.max(
          0,
          input.foodCostPercentage - 28,
        ),
        "Food cost should improve.",
        85,
      ),
    );
  
    goals.push(
      buildGoal(
        "inventory",
        input.inventoryWastePercentage,
        "Inventory waste should decrease.",
        80,
      ),
    );
  
    goals.push(
      buildGoal(
        "marketing",
        Math.max(
          0,
          100 - input.marketingPerformance,
        ),
        "Marketing performance should improve.",
        75,
      ),
    );
  
    goals.push(
      buildGoal(
        "operations",
        Math.max(
          0,
          100 - input.operationalHealth,
        ),
        "Operational efficiency should improve.",
        90,
      ),
    );
  
    goals.push(
      buildGoal(
        "cash_flow",
        Math.max(
          0,
          100 - input.cashFlowHealth,
        ),
        "Cash flow should improve.",
        95,
      ),
    );
  
    return goals.sort(
      (a, b) => b.priority - a.priority,
    );
  }
  function buildGoalSummary(
    primaryGoal: BusinessGoal,
    secondaryGoals: BusinessGoal[],
  ): string {
    const secondary =
      secondaryGoals.length > 0
        ? ` Secondary priorities include ${secondaryGoals
            .slice(0, 2)
            .map((goal) => goal.category.replace("_", " "))
            .join(" and ")}.`
        : "";
  
    return `The highest priority objective is "${primaryGoal.category.replace(
      "_",
      " ",
    )}" because ${primaryGoal.reason}${secondary}`;
  }
  /**
 * Temporary export.
 *
 * This helper is used during the Brain refactor and may become
 * private once all engines consume buildGoalAssessment().
 */
  export function buildPrimaryGoal(
  goals: ReturnType<typeof evaluateGoals>,
) {
  if (!goals.length) {
    return null;
  }

  return [...goals].sort(
    (a, b) => b.priority - a.priority,
  )[0];
}
export interface GoalEngineResult {
  assessment: GoalAssessment;

  primaryGoal: BusinessGoal;
}
export function buildGoalAssessment(
  input: GoalInput,
): GoalEngineResult {
  const goals =
    evaluateGoals(input);

  const primaryGoal =
    buildPrimaryGoal(goals);

  if (!primaryGoal) {
    throw new Error(
      "Unable to determine a primary business goal.",
    );
  }

  const secondaryGoals =
    goals.filter(
      (goal) =>
        goal.category !==
        primaryGoal.category,
    );

    const assessment: GoalAssessment = {
      primaryGoal,
      secondaryGoals,
      summary: buildGoalSummary(
        primaryGoal,
        secondaryGoals,
      ),
      generatedAt:
        (input.now ?? new Date()).toISOString(),
    };
    
        return {
      assessment,

      primaryGoal:
        assessment.primaryGoal,
    };
}