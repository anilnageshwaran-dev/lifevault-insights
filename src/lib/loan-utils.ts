// Standard amortization helpers.
// Formula assumes monthly compounding and fixed EMI.

export interface AmortizationRow {
  month: number;
  date: string;       // YYYY-MM-01
  emi: number;
  principal: number;
  interest: number;
  balance: number;    // outstanding after this payment
}

export interface AmortizationResult {
  schedule: AmortizationRow[];
  months: number;            // total months to payoff
  totalInterest: number;
  totalPaid: number;
  payoffDate: string | null; // YYYY-MM-DD or null if EMI <= monthly interest
  monthlyInterestRate: number;
}

/**
 * Compute amortization from current outstanding, annual interest rate (%) and monthly EMI.
 * Caps schedule at 600 months (50 years) to avoid runaway loops.
 */
export function amortize(
  outstanding: number,
  annualRatePct: number,
  emi: number,
  startDate: Date = new Date(),
): AmortizationResult {
  const r = (annualRatePct / 100) / 12;
  const out: AmortizationRow[] = [];

  if (outstanding <= 0 || emi <= 0) {
    return {
      schedule: out,
      months: 0,
      totalInterest: 0,
      totalPaid: 0,
      payoffDate: null,
      monthlyInterestRate: r,
    };
  }

  // If EMI does not even cover monthly interest, loan never amortizes
  if (r > 0 && emi <= outstanding * r) {
    return {
      schedule: out,
      months: Infinity,
      totalInterest: Infinity,
      totalPaid: Infinity,
      payoffDate: null,
      monthlyInterestRate: r,
    };
  }

  let balance = outstanding;
  let totalInterest = 0;
  let totalPaid = 0;
  const cap = 600;
  let month = 0;

  while (balance > 0.005 && month < cap) {
    month += 1;
    const interest = balance * r;
    let principal = emi - interest;
    let pay = emi;
    if (principal > balance) {
      principal = balance;
      pay = principal + interest;
    }
    balance = Math.max(0, balance - principal);
    totalInterest += interest;
    totalPaid += pay;
    const d = new Date(startDate.getFullYear(), startDate.getMonth() + month, 1);
    out.push({
      month,
      date: d.toISOString().slice(0, 10),
      emi: pay,
      principal,
      interest,
      balance,
    });
    if (balance <= 0.005) break;
  }

  const last = out[out.length - 1];
  return {
    schedule: out,
    months: out.length,
    totalInterest,
    totalPaid,
    payoffDate: last ? last.date : null,
    monthlyInterestRate: r,
  };
}
