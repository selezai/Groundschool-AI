export const PLANS = {
  basic: {
    name: "Basic",
    maxStorage: 100 * 1024 * 1024, // 100MB
    maxQuizzesPerMonth: 5,
    canAccessPastExams: false,
  },
  captains_club: {
    name: "Captain's Club",
    maxStorage: 500 * 1024 * 1024, // 500MB
    maxQuizzesPerMonth: Infinity,
    canAccessPastExams: true,
  },
} as const;

export function getMaxStorageForPlan(plan: string | null): number {
  if (plan === "captains_club") return PLANS.captains_club.maxStorage;
  return PLANS.basic.maxStorage;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
