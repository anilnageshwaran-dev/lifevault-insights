// SIP scheduling + projection helpers.
// Pure functions only — no React, no side effects.
import type { AssetItem, FinanceState, Transaction } from "./finance-context";
import { uid } from "./finance-utils";

const DAY = 86400000;

const toISO = (d: Date) => d.toISOString().slice(0, 10);
const parseISO = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
const clampDayOfMonth = (year: number, monthIdx: number, day: number) => {
  const last = new Date(year, monthIdx + 1, 0).getDate();
  return Math.min(day, last);
};

/** Next due date for a SIP (returns ISO yyyy-mm-dd) */
export function nextSipDueDate(asset: AssetItem, today = new Date()): string | null {
  if (!asset.sipEnabled || asset.sipStatus !== "active") return null;
  const day = Math.max(1, Math.min(28, asset.sipDate || 1));
  if (asset.lastSipProcessedDate) {
    const last = parseISO(asset.lastSipProcessedDate);
    // next month after last processed
    const next = new Date(last.getFullYear(), last.getMonth() + 1, 1);
    const d = clampDayOfMonth(next.getFullYear(), next.getMonth(), day);
    return toISO(new Date(next.getFullYear(), next.getMonth(), d));
  }
  if (asset.sipStartDate) return asset.sipStartDate;
  // fallback: this month, on sip day
  const d = clampDayOfMonth(today.getFullYear(), today.getMonth(), day);
  return toISO(new Date(today.getFullYear(), today.getMonth(), d));
}

export interface DueSip {
  asset: AssetItem;
  dueDate: string;
  amount: number;
}

/** Returns SIPs whose next due date is on/before today. */
export function computeDueSips(state: FinanceState, today = new Date()): DueSip[] {
  const todayISO = toISO(today);
  const out: DueSip[] = [];
  for (const a of state.assets) {
    if (!a.sipEnabled || a.sipStatus !== "active" || !a.sipAmount) continue;
    const due = nextSipDueDate(a, today);
    if (!due) continue;
    if (due <= todayISO) out.push({ asset: a, dueDate: due, amount: a.sipAmount });
  }
  return out;
}

/** All SIPs that are due in the *current* calendar month (whether already
 *  processed or not). Used for the Bills page section. */
export function sipsDueThisMonth(state: FinanceState, today = new Date()): DueSip[] {
  const y = today.getFullYear(), m = today.getMonth();
  const out: DueSip[] = [];
  for (const a of state.assets) {
    if (!a.sipEnabled || a.sipStatus !== "active" || !a.sipAmount) continue;
    const day = Math.max(1, Math.min(28, a.sipDate || 1));
    const d = clampDayOfMonth(y, m, day);
    const dueISO = toISO(new Date(y, m, d));
    // skip if already processed this month
    if (a.lastSipProcessedDate) {
      const lp = parseISO(a.lastSipProcessedDate);
      if (lp.getFullYear() === y && lp.getMonth() === m) continue;
    }
    out.push({ asset: a, dueDate: dueISO, amount: a.sipAmount });
  }
  return out;
}

/** Apply a SIP processing to state: creates a transaction, updates the asset.
 *  Returns the new state. Idempotent per call site — caller decides when to invoke. */
export function applySipProcess(
  state: FinanceState,
  asset: AssetItem,
  amount: number,
  whenISO?: string,
  units?: number,
  navPrice?: number,
): FinanceState {
  const date = whenISO || toISO(new Date());
  // Tie to the user's last-used cash account (so cash decreases).
  const cashAccount = state.accounts.find(
    (a) => a.id === state.lastUsedAccountId && a.type !== "credit" && a.type !== "fd",
  ) || state.accounts.find((a) => a.type !== "credit" && a.type !== "fd");
  const tx: Transaction = {
    id: uid(),
    date,
    type: "investment",
    category: "Mutual Fund SIP",
    description: `${asset.name || "Investment"} SIP`,
    amount,
    currency: asset.currency || cashAccount?.currency,
    accountId: cashAccount?.id,
  };
  const newUnits = units && units > 0 ? units : 0;
  const newAvg = navPrice && navPrice > 0 ? navPrice : asset.avgPrice || 0;
  const existingUnits = asset.units || 0;
  const existingAvg = asset.avgPrice || 0;
  const totalUnits = existingUnits + newUnits;
  const weightedAvg =
    totalUnits > 0
      ? (existingUnits * existingAvg + newUnits * newAvg) / totalUnits
      : existingAvg;

  const updated: AssetItem = {
    ...asset,
    invested: (asset.invested || 0) + amount,
    units: totalUnits || asset.units,
    avgPrice: newUnits > 0 ? weightedAvg : asset.avgPrice,
    value: newUnits > 0 ? (asset.value || 0) + newUnits * newAvg : asset.value + amount,
    lastSipProcessedDate: date,
    sipHistory: [...(asset.sipHistory ?? []), { date, amount, units: newUnits || undefined, price: newAvg || undefined }],
    purchases: [
      ...(asset.purchases ?? []),
      { id: uid(), date, amount, units: newUnits || undefined, price: newAvg || undefined, notes: "SIP" },
    ],
  };

  return {
    ...state,
    assets: state.assets.map((a) => (a.id === asset.id ? updated : a)),
    transactions: [tx, ...state.transactions],
  };
}

// ----- Projections -----

/** FD/RD compound maturity: monthly compounding by default. */
export function fdMaturityAmount(principal: number, ratePct: number, months: number): number {
  if (!principal || !months) return principal || 0;
  const r = ratePct / 100 / 12;
  return principal * Math.pow(1 + r, months);
}

/** Months elapsed between two ISO dates (clamped to 0). */
export function monthsElapsed(startISO: string | undefined, today = new Date()): number {
  if (!startISO) return 0;
  const s = parseISO(startISO);
  const diff = (today.getTime() - s.getTime()) / DAY;
  return Math.max(0, Math.round(diff / 30.4375));
}

/** PPF/EPF style projection with annual contribution. */
export function projectAnnualContribution(
  currentBalance: number,
  annualContribution: number,
  ratePct: number,
  years: number,
): number {
  const r = ratePct / 100;
  let bal = currentBalance || 0;
  for (let i = 0; i < years; i++) {
    bal = bal * (1 + r) + annualContribution;
  }
  return bal;
}

export interface ScenarioPoint {
  label: string;
  ratePct: number;
  futureValue: number;
}

/** 10y scenarios for stocks/MF. */
export function equityScenarios(currentValue: number, years = 10): ScenarioPoint[] {
  return [
    { label: "Conservative 10%", ratePct: 10, futureValue: currentValue * Math.pow(1.1, years) },
    { label: "Moderate 14%", ratePct: 14, futureValue: currentValue * Math.pow(1.14, years) },
    { label: "Optimistic 18%", ratePct: 18, futureValue: currentValue * Math.pow(1.18, years) },
  ];
}
