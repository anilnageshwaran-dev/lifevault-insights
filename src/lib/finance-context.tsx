import * as React from "react";
import { uid } from "./finance-utils";
import { decryptWithKey, encryptWithKey } from "./crypto";
import { useLock } from "./lock-context";
import { fetchFxRates, type FxCache, convert } from "./currency";
import { useDrive } from "./drive-context";
import {
  createAppFile,
  downloadAppFile,
  findAppFile,
  updateAppFile,
} from "./drive-sync";
import { toast } from "sonner";

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
  subtype?: string;
  name: string;
  value: number;
  invested?: number;
  currency?: string;
  notes?: string;
  // Stock/MF specifics
  ticker?: string;
  units?: number;
  avgPrice?: number;
}
export interface LiabilityItem {
  id: string;
  category: LiabilityCategory;
  name: string;
  principal: number;
  rate: number;
  emi: number;
  currency?: string;
  originalPrincipal?: number;
  startDate?: string;
  dueDate?: string;
  notes?: string;
}
export interface Transaction {
  id: string;
  date: string;
  type: TxType;
  category: string;
  description: string;
  amount: number;
  accountId?: string;
  currency?: string;
}
export interface RecurringTemplate {
  id: string;
  name: string;
  amount: number;
  type: TxType;
  category: string;
  frequency: "monthly" | "quarterly" | "yearly";
  nextDue: string;
  accountId?: string;
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
  currency?: string;
  icon?: string;
}
export interface NetWorthSnapshot {
  id: string;
  date: string;
  assets: number;
  liabilities: number;
  netWorth: number;
  assetBreakdown: Record<AssetCategory, number>;
}

export interface VaultRecord {
  id: string;
  title: string;
  subtitle?: string;
  fields: Record<string, string>;
  updatedAt: number;
}

export type AccountType = "bank" | "credit" | "cash" | "wallet" | "other";

export interface Account {
  id: string;
  type: AccountType;
  name: string;
  bank?: string;
  accountSubtype?: string; // Savings/Current/Salary/NRE/NRO
  last4?: string;
  openingBalance: number;
  currency: string;
  asOf: string;
  color: string;
  icon: string;
  emergencyFund?: boolean;
  creditLimit?: number;
  issuer?: string;
}

export const EXPENSE_CATEGORIES = [
  "Housing & Rent",
  "Food & Dining",
  "Groceries",
  "Transport",
  "Healthcare",
  "Education",
  "Insurance",
  "EMI & Loans",
  "Entertainment",
  "Utilities",
  "Shopping",
  "Travel & Vacations",
  "Subscriptions",
  "Personal Care",
  "Credit Card Payment",
  "Taxes",
  "Cash Withdrawal",
  "Childcare",
  "Other Expense",
] as const;

export const INCOME_CATEGORIES = [
  "Salary",
  "Freelance",
  "Business Income",
  "Rental Income",
  "Interest",
  "Dividends",
  "Gift",
  "Other Income",
] as const;

export const INVESTMENT_CATEGORIES = [
  "Mutual Fund SIP",
  "Stock Purchase",
  "FD/RD Deposit",
  "PPF/EPF",
  "NPS",
  "Gold",
  "Crypto",
  "Other Investment",
] as const;

export const ALL_TX_CATEGORIES = [
  ...EXPENSE_CATEGORIES,
  ...INCOME_CATEGORIES,
  ...INVESTMENT_CATEGORIES,
];

export function categoriesForType(type: TxType): readonly string[] {
  if (type === "income") return INCOME_CATEGORIES;
  if (type === "investment") return INVESTMENT_CATEGORIES;
  return EXPENSE_CATEGORIES;
}

export interface FinanceState {
  age: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  intendedSavings: number;
  emergencyFund: number;
  termInsurance: number;
  dependents: number;
  healthInsurance: number;

  assets: AssetItem[];
  liabilities: LiabilityItem[];
  targetAllocation: Record<AssetCategory, number>;
  snapshots: NetWorthSnapshot[];

  transactions: Transaction[];
  budgets: Record<string, number>;
  recurring: RecurringTemplate[];

  goals: Goal[];
  vault: Record<string, VaultRecord[]>;
  accounts: Account[];

  baseCurrency: string;
  lastUsedAccountId?: string;
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
  vault: {},
  accounts: [],
  baseCurrency: "INR",
};

const STORAGE_KEY_PLAIN = "lifevault_data";
const STORAGE_KEY_ENC = "lifevault_cache";

type Ctx = {
  state: FinanceState;
  setState: React.Dispatch<React.SetStateAction<FinanceState>>;
  update: <K extends keyof FinanceState>(key: K, value: FinanceState[K]) => void;
  reset: () => void;
  exportData: () => void;
  importData: (file: File) => Promise<void>;
  syncStatus: "idle" | "saving" | "synced" | "error";
  lastSyncedAt: number | null;
  syncNow: () => Promise<void>;
  fx: FxCache | null;
  refreshFx: (force?: boolean) => Promise<void>;
};

const FinanceContext = React.createContext<Ctx | null>(null);

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const { key } = useLock();
  const drive = useDrive();
  const [state, setState] = React.useState<FinanceState>(initialState);
  const [hydrated, setHydrated] = React.useState(false);
  const [syncStatus, setSyncStatus] = React.useState<"idle" | "saving" | "synced" | "error">(
    "idle",
  );
  const [lastSyncedAt, setLastSyncedAt] = React.useState<number | null>(null);
  const [fx, setFx] = React.useState<FxCache | null>(null);
  const driveFileIdRef = React.useRef<string | null>(null);
  const driveLoadedRef = React.useRef<boolean>(false);
  const stateRef = React.useRef<FinanceState>(state);
  const keyRef = React.useRef<CryptoKey | null>(key);
  const driveRef = React.useRef(drive);
  React.useEffect(() => {
    stateRef.current = state;
  }, [state]);
  React.useEffect(() => {
    keyRef.current = key;
  }, [key]);
  React.useEffect(() => {
    driveRef.current = drive;
  }, [drive]);

  // Load FX on mount
  React.useEffect(() => {
    void (async () => {
      const r = await fetchFxRates(false);
      if (r) setFx(r);
    })();
  }, []);

  const refreshFx = React.useCallback(async (force = false) => {
    const r = await fetchFxRates(force);
    if (r) setFx(r);
  }, []);

  // 1) Local hydration
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const legacy = localStorage.getItem(STORAGE_KEY_PLAIN);
        if (legacy && key) {
          try {
            const parsed = JSON.parse(legacy);
            const enc = await encryptWithKey(parsed, key);
            localStorage.setItem(STORAGE_KEY_ENC, enc);
            localStorage.removeItem(STORAGE_KEY_PLAIN);
            if (!cancelled) setState({ ...initialState, ...parsed });
            setHydrated(true);
            return;
          } catch {}
        }
        const encRaw = localStorage.getItem(STORAGE_KEY_ENC);
        if (encRaw && key) {
          try {
            const parsed = await decryptWithKey<FinanceState>(encRaw, key);
            if (!cancelled) setState({ ...initialState, ...parsed });
          } catch {
            if (!cancelled) setState(initialState);
          }
        } else if (legacy && !key) {
          try {
            const parsed = JSON.parse(legacy);
            if (!cancelled) setState({ ...initialState, ...parsed });
          } catch {}
        }
      } catch {}
      // Restore Drive fileId
      try {
        const fid = localStorage.getItem("lifevault_drive_fileid");
        if (fid) driveFileIdRef.current = fid;
      } catch {}
      if (!cancelled) setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  // 2) Drive: pull-on-connect (once per session)
  React.useEffect(() => {
    if (!hydrated || !key || !drive.connected || driveLoadedRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await drive.ensureToken();
        if (!token) return;
        const file = await findAppFile();
        if (!file) {
          driveLoadedRef.current = true;
          return;
        }
        driveFileIdRef.current = file.id;
        try {
          localStorage.setItem("lifevault_drive_fileid", file.id);
        } catch {}
        const blob = await downloadAppFile(file.id);
        try {
          const parsed = await decryptWithKey<FinanceState>(blob, key);
          if (!cancelled) {
            setState({ ...initialState, ...parsed });
            setSyncStatus("synced");
          }
        } catch {
          // PIN-encrypted blob from a different PIN — ignore, keep local
        }
        driveLoadedRef.current = true;
      } catch (e) {
        const msg = (e as Error).message || "";
        if (msg.includes("403")) {
          toast.error("Drive access denied — check permissions");
        }
        setSyncStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, key, drive.connected, drive]);

  // Core writer — persists locally and pushes to Drive when connected.
  const writeAndPush = React.useCallback(async (force = false): Promise<void> => {
    const k = keyRef.current;
    const s = stateRef.current;
    const d = driveRef.current;
    setSyncStatus("saving");
    let enc: string | null = null;
    try {
      if (k) {
        enc = await encryptWithKey(s, k);
        localStorage.setItem(STORAGE_KEY_ENC, enc);
      } else {
        localStorage.setItem(STORAGE_KEY_PLAIN, JSON.stringify(s));
      }
    } catch {
      setSyncStatus("error");
      return;
    }
    if (d.connected && enc) {
      try {
        const token = await d.ensureToken();
        if (!token) throw new Error("no token");
        if (driveFileIdRef.current) {
          await updateAppFile(driveFileIdRef.current, enc);
        } else {
          const id = await createAppFile(enc);
          driveFileIdRef.current = id;
          try {
            localStorage.setItem("lifevault_drive_fileid", id);
          } catch {}
        }
        setSyncStatus("synced");
        setLastSyncedAt(Date.now());
      } catch (e) {
        const msg = (e as Error).message || "";
        if (msg.includes("403")) toast.error("Drive access denied — check permissions");
        else if (force) toast.error("Sync failed — working from cache");
        setSyncStatus("error");
      }
    } else {
      setSyncStatus("synced");
      if (force) setLastSyncedAt(Date.now());
    }
  }, []);

  // 3) Debounced auto-save on every state change
  React.useEffect(() => {
    if (!hydrated) return;
    setSyncStatus("saving");
    const t = setTimeout(() => {
      void writeAndPush(false);
    }, 800);
    return () => clearTimeout(t);
  }, [state, hydrated, key, drive.connected, writeAndPush]);

  // 4) Flush on tab hide / before unload / when coming back online
  React.useEffect(() => {
    if (!hydrated) return;
    const flush = () => {
      void writeAndPush(false);
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") flush();
    };
    const onOnline = () => {
      if (syncStatus === "error") void writeAndPush(false);
    };
    window.addEventListener("beforeunload", flush);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("beforeunload", flush);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onOnline);
    };
  }, [hydrated, writeAndPush, syncStatus]);

  const syncNow = React.useCallback(async () => {
    await writeAndPush(true);
  }, [writeAndPush]);

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
      value={{
        state,
        setState,
        update,
        reset,
        exportData,
        importData,
        syncStatus,
        fx,
        refreshFx,
      }}
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
  cash: "Cash & Savings",
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

/** Current balance of an account = opening + income − expense, on transactions
 *  belonging to that account. Currency is the account currency. */
export function accountBalance(state: FinanceState, accountId: string): number {
  const acc = state.accounts.find((a) => a.id === accountId);
  if (!acc) return 0;
  const opening = acc.openingBalance || 0;
  const txs = state.transactions.filter((t) => t.accountId === accountId);
  if (acc.type === "credit") {
    // Credit cards: outstanding = opening + expenses − credit card payments
    const exp = txs
      .filter((t) => t.type === "expense" && t.category !== "Credit Card Payment")
      .reduce((s, t) => s + t.amount, 0);
    const pay = txs
      .filter((t) => t.type === "expense" && t.category === "Credit Card Payment")
      .reduce((s, t) => s + t.amount, 0);
    return opening + exp - pay;
  }
  const inc = txs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const exp = txs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  return opening + inc - exp;
}

export function sumAssets(state: FinanceState, fx: FxCache | null, base: string): number {
  const assetsTotal = state.assets.reduce(
    (s, a) => s + convert(a.value || 0, a.currency || base, base, fx),
    0,
  );
  const accountsTotal = state.accounts
    .filter((a) => a.type !== "credit")
    .reduce(
      (s, a) => s + convert(accountBalance(state, a.id), a.currency, base, fx),
      0,
    );
  return assetsTotal + accountsTotal;
}

export function sumLiabilities(
  state: FinanceState,
  fx: FxCache | null,
  base: string,
): number {
  const liabTotal = state.liabilities.reduce(
    (s, l) => s + convert(l.principal || 0, l.currency || base, base, fx),
    0,
  );
  const cardsTotal = state.accounts
    .filter((a) => a.type === "credit")
    .reduce(
      (s, a) => s + convert(accountBalance(state, a.id), a.currency, base, fx),
      0,
    );
  return liabTotal + cardsTotal;
}

export function assetsByCategory(
  state: FinanceState,
  fx: FxCache | null,
  base: string,
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
    out[a.category] += convert(a.value || 0, a.currency || base, base, fx);
  });
  // Bank/cash/wallet accounts → cash
  state.accounts
    .filter((a) => a.type !== "credit")
    .forEach((a) => {
      out.cash += convert(accountBalance(state, a.id), a.currency, base, fx);
    });
  return out;
}

export function liquidEmergencyAssets(
  state: FinanceState,
  fx: FxCache | null,
  base: string,
): number {
  return state.accounts
    .filter((a) => a.type !== "credit" && a.emergencyFund)
    .reduce(
      (s, a) => s + convert(accountBalance(state, a.id), a.currency, base, fx),
      0,
    );
}

export function computeHealthScore(
  state: FinanceState,
  fx: FxCache | null,
): {
  total: number;
  emergency: number;
  insurance: number;
  health: number;
  savings: number;
} {
  const base = state.baseCurrency || "INR";
  const liquid = liquidEmergencyAssets(state, fx, base) || state.emergencyFund;
  const target = state.monthlyExpenses * 6;
  const emergencyPct = target > 0 ? Math.min(1, liquid / target) : 0;
  const emergency = emergencyPct * 30;

  const idealTerm = state.monthlyExpenses * 12 * 25;
  const termPct = idealTerm > 0 ? Math.min(1, state.termInsurance / idealTerm) : 0;
  const insurance = termPct * 20;

  const idealHealth = state.dependents * 500000;
  const healthPct =
    idealHealth > 0 ? Math.min(1, state.healthInsurance / idealHealth) : 0;
  const health = healthPct * 20;

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
