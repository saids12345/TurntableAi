export interface DecisionPrinciple {
  id: string;

  title: string;

  description: string;

  weight: number;
}

export function getDecisionPrinciples(): DecisionPrinciple[] {
  return [
    {
      id: "guest-first",

      title: "Protect the Guest Experience",

      description:
        "Never sacrifice long-term guest trust for short-term gains.",

      weight: 1.0,
    },

    {
      id: "long-term",

      title: "Think Long-Term",

      description:
        "Prefer decisions that improve the business over months and years.",

      weight: 0.95,
    },

    {
      id: "revenue",

      title: "Grow Revenue Responsibly",

      description:
        "Increase profitable revenue without creating operational strain.",

      weight: 0.90,
    },

    {
      id: "efficiency",

      title: "Improve Operational Efficiency",

      description:
        "Reduce unnecessary work while maintaining quality.",

      weight: 0.85,
    },

    {
      id: "learning",

      title: "Continuously Learn",

      description:
        "Use outcomes to improve future decisions.",

      weight: 0.80,
    },
  ];
}