// SIP / lump sum / goal-based investing math.

/** Future value of a monthly SIP. FV = P × [((1+r)^n − 1)/r] × (1+r) */
export function sipFutureValue(monthly: number, annualPct: number, years: number): number {
  const r = (annualPct / 100) / 12;
  const n = years * 12;
  if (n <= 0) return 0;
  if (r === 0) return monthly * n;
  return monthly * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
}

/** Required monthly SIP to reach a goal. */
export function sipRequired(goal: number, annualPct: number, years: number): number {
  const r = (annualPct / 100) / 12;
  const n = years * 12;
  if (n <= 0) return goal;
  if (r === 0) return goal / n;
  return goal / (((Math.pow(1 + r, n) - 1) / r) * (1 + r));
}

/** Lump sum required today to reach a goal. FV = PV × (1+annual)^years */
export function lumpSumRequired(goal: number, annualPct: number, years: number): number {
  if (years <= 0) return goal;
  return goal / Math.pow(1 + annualPct / 100, years);
}

/** Year-by-year growth series for charting SIP. */
export function sipGrowthSeries(
  monthly: number,
  annualPct: number,
  years: number,
): { year: number; invested: number; value: number; gain: number }[] {
  const out: { year: number; invested: number; value: number; gain: number }[] = [];
  for (let y = 0; y <= years; y++) {
    const invested = monthly * 12 * y;
    const value = sipFutureValue(monthly, annualPct, y);
    out.push({ year: y, invested, value, gain: Math.max(0, value - invested) });
  }
  return out;
}
