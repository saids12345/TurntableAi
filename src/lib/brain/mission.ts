export type MissionPriority =
  | "critical"
  | "high"
  | "normal";

export interface BrainMission {
  id: string;

  title: string;

  description: string;

  priority: MissionPriority;

  successCriteria: string[];

  createdAt: string;
}

export function createDefaultMission(): BrainMission {
  return {
    id: "restaurant-growth",

    title: "Maximize Restaurant Performance",

    description:
      "Continuously improve the restaurant by increasing revenue, guest satisfaction, operational efficiency, and long-term business health.",

    priority: "critical",

    successCriteria: [
      "Increase revenue",
      "Protect reputation",
      "Improve operational efficiency",
      "Increase guest satisfaction",
      "Reduce business risk",
      "Create sustainable long-term growth",
    ],

    createdAt:
      new Date().toISOString(),
  };
}