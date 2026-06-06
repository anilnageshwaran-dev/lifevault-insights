// Net worth milestone definitions (₹) — sorted ascending.
export interface Milestone {
  amount: number;
  label: string;
  emoji: string;
}

export interface MilestoneAchieved {
  amount: number;
  label: string;
  emoji: string;
  date: string; // ISO
  netWorth: number;
}

export const MILESTONES: Milestone[] = [
  { amount: 1_00_000,     label: "First Lakh",      emoji: "🎉" },
  { amount: 5_00_000,     label: "Five Lakhs",      emoji: "🚀" },
  { amount: 10_00_000,    label: "First Ten Lakhs", emoji: "💪" },
  { amount: 25_00_000,    label: "Quarter Crore",   emoji: "⭐" },
  { amount: 50_00_000,    label: "Half Crore",      emoji: "🔥" },
  { amount: 1_00_00_000,  label: "First Crore",     emoji: "👑" },
  { amount: 2_00_00_000,  label: "Two Crores",      emoji: "💎" },
  { amount: 5_00_00_000,  label: "Five Crores",     emoji: "🏆" },
];

/** Returns milestones newly crossed by `netWorth` that aren't already in `achieved`. */
export function detectNewMilestones(
  netWorth: number,
  achieved: MilestoneAchieved[],
): Milestone[] {
  const have = new Set(achieved.map((m) => m.amount));
  return MILESTONES.filter((m) => netWorth >= m.amount && !have.has(m.amount));
}

/** Highest milestone achieved (or null). */
export function highestAchieved(achieved: MilestoneAchieved[]): Milestone | null {
  if (achieved.length === 0) return null;
  const max = Math.max(...achieved.map((m) => m.amount));
  return MILESTONES.find((m) => m.amount === max) ?? null;
}

/** Next locked milestone above the current net worth. */
export function nextMilestone(netWorth: number): Milestone | null {
  return MILESTONES.find((m) => m.amount > netWorth) ?? null;
}
