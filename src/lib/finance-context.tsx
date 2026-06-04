import * as React from "react";
import { uid } from "./finance-utils";

export type AssetCategory =
  | "cash"
  | "equity"
  | "debt"
  | "gold"
  | "realestate"
  | "crypto";

export type LiabilityCategory =
  | "home"
  | "vehicle"
  | "personal"
  | "credit"
  | "other";

export type TxType = "income" | "expense" | "investment";

export interface AssetItem {
  id: string;
  category: AssetCategory;
  name: string;
  value: number;
}
export interface LiabilityItem {
  id: string;
  category: LiabilityCategory;
  name: string;
  principal: number;
  rate: number;
  emi: number;
}
export interface Transaction {
  id: string;
  date: string; // ISO yyyy-mm-dd
  type: TxType;
  category: string;
  description: string;
  amount: number;
}
export interface RecurringTemplate {
  id: string;
  name: string;
  amount: number;
  type: TxType;
  category: string;
  frequency: "monthly" | "quarterly" | "yearly";
  nextDue: string;
}
export interface Goal {
  id: string;
  name: string;
  type: string;
  currentCost: number;
  targetYear: number;
  inflation: number;
  linked?: string;
  currentSavings: number;
}
export interface NetWorthSnapshot {
  id: string;
  date: string;
  assets: number;
  liabilities: number;
  netWorth: number;
  assetBreakdown: Record<AssetCategory, number>;
}

export const EXPENSE_CATEGORIES = [
  "Housing",
  "Utilities",
  "Food & Groceries",
  "Transport",
  "Healthcare",
  "Subscriptions",
  "Entertainment",
  "Shopping",
  "Education",
  "Insurance",
  "Miscellaneous",
] as const;

export const ALL_TX_CATEGORIES = [
  ...EXPENSE_CATEGORIES,
  "Salary",
  "Business",
  "Interest",
  "Dividend",
  "Other Income",
  "Mutual Funds",
  "Stocks",
  "PPF/EPF",
  "Gold",
  "Crypto",
  "Other Investment",
];

export interface FinanceState {
  // Essentials
  age: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  intendedSavings: number;
  emergencyFund: number;
  termInsurance: number;
  dependents: number;
  healthInsurance: number;

  // Net worth
  assets: AssetItem[];
  liabilities: LiabilityItem[];
  targetAllocation: Record<AssetCategory, number>;
  snapshots: NetWorthSnapshot[];

  // Cash flow
  transactions: Transaction[];
  budgets: Record<string, number>;
  recurring: RecurringTemplate[];

  // Goals
  goals: Goal[];
}

const initialState: FinanceState = {
  age: 0,
  monthlyIncome: 0,
  monthlyExpenses: 0,
  intendedSavings: 0,
  emergencyFund: 0,
  termInsurance: 0,
  dependents: 0,
  healthInsurance: 0,
  assets: [],
  liabilities: [],
  targetAllocation: {
    cash: 10,
    equity: 50,
    debt: 20,
    gold: 10,
    realestate: 5,
    crypto: 5,
  },
  snapshots: [],
  transactions: [],
  budgets: {},
  recurring: [],
  goals: [],
};

const STORAGE_KEY = "lifevault_data";

type Ctx = {
  state: FinanceState;
  setState: React.Dispatch<React.SetStateAction<FinanceState>>;
  update: <K extends keyof FinanceState>(key: K, value: FinanceState[K]) => void;
  reset: () => void;
  exportData: () => void;
  importData: (file: File) => Promise<void>;
};

const FinanceContext = React.createContext<Ctx | null>(null);

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<FinanceState>(initialState);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setState({ ...initialState, ...parsed });
      }
    } catch {}
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {}
    }, 500);
    return () => clearTimeout(t);
  }, [state, hydrated]);

  const update = React.useCallback(
    <K extends keyof FinanceState>(key: K, value: FinanceState[K]) => {
      setState((s) => ({ ...s, [key]: value }));
    },
    [],
  );

  const reset = React.useCallback(() => setState(initialState), []);

  const exportData = React.useCallback(() => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lifevault_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [state]);

  const importData = React.useCallback(async (file: File) => {
    const text = await file.text();
    const parsed = JSON.parse(text);
    setState({ ...initialState, ...parsed });
  }, []);

  return (
    <FinanceContext.Provider
      value={{ state, setState, update, reset, exportData, importData }}
    >
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const ctx = React.useContext(FinanceContext);
  if (!ctx) throw new Error("useFinance must be used within FinanceProvider");
  return ctx;
}

// ---------- Derived selectors ----------

export const ASSET_LABELS: Record<AssetCategory, string> = {
  cash: "Cash & Bank",
  equity: "Equity",
  debt: "Debt",
  gold: "Gold & Silver",
  realestate: "Real Estate",
  crypto: "Crypto",
};

export const LIABILITY_LABELS: Record<LiabilityCategory, string> = {
  home: "Home Loan",
  vehicle: "Vehicle Loan",
  personal: "Personal Loan",
  credit: "Credit Card Outstanding",
  other: "Other",
};

export function sumAssets(state: FinanceState): number {
  return state.assets.reduce((s, a) => s + (a.value || 0), 0);
}
export function sumLiabilities(state: FinanceState): number {
  return state.liabilities.reduce((s, l) => s + (l.principal || 0), 0);
}
export function assetsByCategory(
  state: FinanceState,
): Record<AssetCategory, number> {
  const out: Record<AssetCategory, number> = {
    cash: 0,
    equity: 0,
    debt: 0,
    gold: 0,
    realestate: 0,
    crypto: 0,
  };
  state.assets.forEach((a) => {
    out[a.category] = (out[a.category] || 0) + (a.value || 0);
  });
  return out;
}

export function computeHealthScore(state: FinanceState): {
  total: number;
  emergency: number;
  insurance: number;
  health: number;
  savings: number;
} {
  // Emergency 30 pts
  const target = state.monthlyExpenses * 6;
  const emergencyPct = target > 0 ? Math.min(1, state.emergencyFund / target) : 0;
  const emergency = emergencyPct * 30;

  // Insurance 20 pts
  const idealTerm = state.monthlyExpenses * 12 * 25;
  const termPct = idealTerm > 0 ? Math.min(1, state.termInsurance / idealTerm) : 0;
  const insurance = termPct * 20;

  // Health 20 pts
  const idealHealth = state.dependents * 500000;
  const healthPct =
    idealHealth > 0 ? Math.min(1, state.healthInsurance / idealHealth) : 0;
  const health = healthPct * 20;

  // Savings rate 30 pts (full at 20%)
  const sr = state.monthlyIncome > 0 ? state.intendedSavings / state.monthlyIncome : 0;
  const savings = Math.min(1, sr / 0.2) * 30;

  return {
    total: Math.round(emergency + insurance + health + savings),
    emergency,
    insurance,
    health,
    savings,
  };
}

export const newAsset = (category: AssetCategory): AssetItem => ({
  id: uid(),
  category,
  name: "",
  value: 0,
});
export const newLiability = (category: LiabilityCategory): LiabilityItem => ({
  id: uid(),
  category,
  name: "",
  principal: 0,
  rate: 0,
  emi: 0,
});
