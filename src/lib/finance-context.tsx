import * as React from "react";
import { uid } from "./finance-utils";
import { decryptWithKey, encryptWithKey } from "./crypto";
import { useLock } from "./lock-context";
import { useAuth } from "./auth-context";
import { fetchFxRates, type FxCache, convert } from "./currency";
import { downloadVault, uploadVault, statVault } from "./supabase-storage";
import { toast } from "sonner";
import type { MilestoneAchieved } from "./milestones";
import { publishMySnapshot } from "./shared-snapshot.functions";

export type AssetCategory =
  | "cash"
  | "investment"
  | "equity"    // legacy — migrated to "investment" on load
  | "debt"      // legacy — migrated to "investment" on load
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

/** Grouped subtypes used by the unified "Investments" category. */
export const INVESTMENT_SUBTYPE_GROUPS = {
  "Stocks & Equity": [
    "Direct Stock", "Equity MF", "ELSS", "ETF", "Index Fund", "ESOP", "Unlisted Equity",
  ],
  "Fixed Income": [
    "FD", "RD", "PPF", "EPF", "NPS", "Bond", "Debt MF", "G-Sec",
    "Corporate FD", "RBI Bond", "NSC", "KVP", "Sukanya Samriddhi",
    "SCSS", "Post Office TD",
  ],
  "Hybrid & Other": [
    "Hybrid MF", "Balanced Fund", "ULIP", "PMS", "AIF", "P2P Lending", "Other",
  ],
} as const;

export const ALL_INVESTMENT_SUBTYPES: string[] =
  Object.values(INVESTMENT_SUBTYPE_GROUPS).flat() as string[];

export function subtypeGroup(subtype?: string): keyof typeof INVESTMENT_SUBTYPE_GROUPS | null {
  if (!subtype) return null;
  for (const [g, list] of Object.entries(INVESTMENT_SUBTYPE_GROUPS)) {
    if ((list as readonly string[]).includes(subtype)) return g as keyof typeof INVESTMENT_SUBTYPE_GROUPS;
  }
  return null;
}

/** Subtypes considered SIP-eligible (mutual fund / ETF / index). */
export const SIP_ELIGIBLE_SUBTYPES = new Set<string>([
  "Equity MF", "ELSS", "ETF", "Index Fund", "Debt MF", "Hybrid MF", "Balanced Fund", "ULIP",
]);

export interface InvestmentPurchase {
  id: string;
  date: string;        // ISO yyyy-mm-dd
  amount: number;      // cash invested in asset.currency
  units?: number;
  price?: number;
  notes?: string;
}

export interface SipHistoryEntry {
  date: string;
  amount: number;
  units?: number;
  price?: number;
}

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
  currentPrice?: number;
  // FD/RD/Bond specifics
  principal?: number;
  interestRate?: number;
  startDate?: string;
  tenureMonths?: number;
  maturityDate?: string;
  maturityAmount?: number;
  // PPF/EPF/NPS
  currentBalance?: number;
  annualContribution?: number;
  expectedRate?: number;
  // Purchase history (any subtype)
  purchases?: InvestmentPurchase[];
  // SIP fields (MF/ETF/Index)
  sipEnabled?: boolean;
  sipAmount?: number;
  sipFrequency?: "monthly";
  sipDate?: number; // 1-28
  sipStartDate?: string;
  sipStatus?: "active" | "paused";
  lastSipProcessedDate?: string;
  sipHistory?: SipHistoryEntry[];
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
  /** When set, this transaction is part of an account-to-account transfer
   *  and should be excluded from income/expense/investment totals. */
  transferId?: string;
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

export type AccountType = "bank" | "credit" | "cash" | "wallet" | "fd" | "other";

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
  paymentDueDay?: number; // 1-31, credit cards only
  statementDay?: number;  // 1-31, credit cards only (optional)
  linkedBillId?: string;  // auto-created payment bill id
  // Fixed Deposit specifics (when type === "fd")
  interestRate?: number;     // annual %, e.g. 7.2
  maturityDate?: string;     // ISO date
  maturityAmount?: number;   // expected amount at maturity
  // Login credentials (encrypted at rest with the rest of the vault)
  loginUrl?: string;
  loginUsername?: string;
  loginPassword?: string;
  loginNotes?: string;
}

export type BillFrequency = "weekly" | "monthly" | "quarterly" | "halfYearly" | "yearly" | "onetime";

export interface BillPayment {
  date: string;       // ISO date YYYY-MM-DD
  amount: number;
  txId?: string;
}

export interface Bill {
  id: string;
  name: string;
  amount: number;
  currency?: string;
  category: string;       // expense category
  accountId?: string;     // debit account
  frequency: BillFrequency;
  nextDue: string;        // ISO date YYYY-MM-DD
  autopay?: boolean;
  notes?: string;
  history: BillPayment[];
}

export const EXPENSE_CATEGORIES = [
  "Housing & Rent",
  "House",
  "Food & Dining",
  "Drink & Dine",
  "Food & Grocery",
  "Groceries",
  "Transport",
  "Taxi",
  "Travel & Vacations",
  "Mobile",
  "Healthcare",
  "Health & Fitness",
  "Education",
  "Insurance",
  "EMI & Loans",
  "Loan & Debts",
  "Entertainment",
  "Events",
  "Sports",
  "Utilities",
  "Bills & Utilities",
  "Electricity",
  "Water",
  "Shopping",
  "Subscriptions",
  "Personal Care",
  "Family Care",
  "Kids Care",
  "Childcare",
  "Pet Care",
  "Gifts & Donations",
  "Fees & Charges",
  "Financial Services",
  "Office & Business",
  "Credit Card Payment",
  "Mortgage Payment",
  "Loan Payment",
  "Taxes",
  "Cash Withdrawal",
  "Transfer",
  "Misc Expenses",
  "Other Expense",
] as const;

export const INCOME_CATEGORIES = [
  "Salary",
  "Salary & Paycheck",
  "Wages & Tips",
  "Freelance",
  "Business Income",
  "Business & Profession",
  "Selling Income",
  "Rental Income",
  "Interest",
  "Dividends",
  "Bonus",
  "Brokerage",
  "Coupons",
  "Credit",
  "Refunds",
  "Reimbursement",
  "Loan",
  "Lottery & Gambling",
  "Mutual Funds",
  "Savings",
  "Retirement & Pension",
  "Gift",
  "Gifts",
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

export interface Region {
  id: string;
  name: string;          // "India", "UK", "USA"
  currency: string;      // ISO code (e.g. "INR", "GBP")
  flag?: string;         // emoji
  monthlyIncome: number;
  monthlyExpenses: number;
  intendedSavings: number;
  emergencyFund: number;
  termInsurance: number;
  healthInsurance: number;
  dependents: number;
  notes?: string;
}

export interface FinanceState {
  age: number;
  // Legacy single-region fields — preserved for backward compat. New UI uses `regions`.
  monthlyIncome: number;
  monthlyExpenses: number;
  intendedSavings: number;
  emergencyFund: number;
  termInsurance: number;
  dependents: number;
  healthInsurance: number;

  // Multi-region (per country / currency) financial baselines.
  regions: Region[];

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
  bills: Bill[];

  baseCurrency: string;
  lastUsedAccountId?: string;

  /** Net-worth milestone celebrations already achieved. */
  milestonesAchieved?: MilestoneAchieved[];
  /** Free-text "message to family" for the Emergency page. */
  emergencyNote?: string;
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
  regions: [],
  assets: [],
  liabilities: [],
  targetAllocation: {
    cash: 10,
    investment: 70,
    equity: 0,
    debt: 0,
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
  bills: [],
  baseCurrency: "INR",
  milestonesAchieved: [],
  emergencyNote: "",
};

/** Ensure at least one region exists; migrates legacy top-level fields into a seeded region.
 *  Also migrates legacy `recurring[]` templates into the unified `bills[]` list. */
export function ensureRegions(s: FinanceState): FinanceState {
  let next = s;
  if (!next.regions || next.regions.length === 0) {
    const base = next.baseCurrency || "INR";
    const seeded: Region = {
      id: uid(),
      name: base === "INR" ? "India" : base === "GBP" ? "UK" : "Primary",
      currency: base,
      flag: base === "INR" ? "🇮🇳" : base === "GBP" ? "🇬🇧" : "🌐",
      monthlyIncome: next.monthlyIncome || 0,
      monthlyExpenses: next.monthlyExpenses || 0,
      intendedSavings: next.intendedSavings || 0,
      emergencyFund: next.emergencyFund || 0,
      termInsurance: next.termInsurance || 0,
      healthInsurance: next.healthInsurance || 0,
      dependents: next.dependents || 0,
    };
    next = { ...next, regions: [seeded] };
  }
  if (next.recurring && next.recurring.length > 0) {
    const existing = new Set((next.bills ?? []).map((b) => b.name.toLowerCase()));
    const migrated: Bill[] = next.recurring
      .filter((r) => !existing.has(r.name.toLowerCase()))
      .map((r) => ({
        id: uid(),
        name: r.name,
        amount: r.amount,
        category: r.category,
        accountId: r.accountId,
        frequency: (r.frequency === "monthly" || r.frequency === "quarterly" || r.frequency === "yearly")
          ? r.frequency
          : "monthly",
        nextDue: r.nextDue,
        autopay: false,
        history: [],
      }));
    next = { ...next, bills: [...(next.bills ?? []), ...migrated], recurring: [] };
  }
  // Migrate legacy equity/debt assets into the unified "investment" category.
  if (next.assets && next.assets.some((a) => a.category === "equity" || a.category === "debt")) {
    next = {
      ...next,
      assets: next.assets.map((a) => {
        if (a.category !== "equity" && a.category !== "debt") return a;
        // Default a subtype if missing
        let subtype = a.subtype;
        if (!subtype) {
          subtype = a.category === "equity" ? "Direct Stock" : "FD";
        } else {
          // Normalise old labels to new subtype names
          const map: Record<string, string> = {
            "Equity Mutual Fund": "Equity MF",
            "Debt Mutual Fund": "Debt MF",
            "Government Security": "G-Sec",
          };
          subtype = map[subtype] || subtype;
        }
        return { ...a, category: "investment", subtype };
      }),
    };
  }
  // Migrate legacy targetAllocation that has equity/debt but no investment.
  if (next.targetAllocation && (next.targetAllocation.equity || next.targetAllocation.debt)) {
    const ta = { ...next.targetAllocation };
    const combined = (ta.equity || 0) + (ta.debt || 0);
    if (combined > 0 && !(ta.investment && ta.investment > 0)) {
      ta.investment = combined;
      ta.equity = 0;
      ta.debt = 0;
      next = { ...next, targetAllocation: ta };
    }
  }
  return next;
}


function isSyncEnvelopeBlob(blob: string): boolean {
  try {
    const parsed = JSON.parse(blob.trim()) as { v?: number; salt?: unknown; data?: unknown; pinHash?: unknown };
    return parsed.v === 1 && typeof parsed.salt === "string" && typeof parsed.data === "string" && typeof parsed.pinHash === "string";
  } catch {
    return false;
  }
}


const STORAGE_KEY_PLAIN = "lifevault_data";
const STORAGE_KEY_ENC = "lifevault_cache";

type FinanceCounts = {
  accounts: number;
  transactions: number;
  assets: number;
  liabilities: number;
  goals: number;
  bills: number;
  vaultItems: number;
};

type SyncDiagnostics = {
  checkedAt: number | null;
  local: FinanceCounts;
  remote: {
    status: "not_connected" | "checking" | "missing" | "available" | "locked" | "error";
    modifiedTime?: string;
    counts?: FinanceCounts;
    message?: string;
  };
};

function countFinanceState(s: FinanceState): FinanceCounts {
  return {
    accounts: s.accounts?.length ?? 0,
    transactions: s.transactions?.length ?? 0,
    assets: s.assets?.length ?? 0,
    liabilities: s.liabilities?.length ?? 0,
    goals: s.goals?.length ?? 0,
    bills: s.bills?.length ?? 0,
    vaultItems: Object.values(s.vault ?? {}).reduce((total, items) => total + items.length, 0),
  };
}

type Ctx = {
  state: FinanceState;
  setState: React.Dispatch<React.SetStateAction<FinanceState>>;
  update: <K extends keyof FinanceState>(key: K, value: FinanceState[K]) => void;
  reset: () => void;
  exportData: () => void;
  importData: (file: File) => Promise<void>;
  /** "idle" before first save, "saving" while uploading, "synced" after a
   *  confirmed cloud upload, "cached" when only local encrypted cache was
   *  written, and "error" for blocking cloud read/decrypt failures. */
  syncStatus: "idle" | "saving" | "synced" | "cached" | "error";
  lastSyncedAt: number | null;
  syncDiagnostics: SyncDiagnostics;
  syncNow: () => Promise<void>;
  /** Re-check the remote vault file metadata. */
  inspectDrive: () => Promise<void>;
  /** Force a pull from cloud (overwrites local with remote). */
  pullFromDrive: () => Promise<boolean>;
  /** Force a push to cloud (overwrites remote with local). */
  pushToDrive: () => Promise<void>;
  fx: FxCache | null;
  refreshFx: (force?: boolean) => Promise<void>;
};

const FinanceContext = React.createContext<Ctx | null>(null);

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const { key, encryptSyncData, decryptSyncData } = useLock();
  const { user } = useAuth();
  const [state, setState] = React.useState<FinanceState>(initialState);
  const [hydrated, setHydrated] = React.useState(false);
  const [syncStatus, setSyncStatus] = React.useState<"idle" | "saving" | "synced" | "cached" | "error">(
    "idle",
  );
  const [lastSyncedAt, setLastSyncedAt] = React.useState<number | null>(null);
  const [syncDiagnostics, setSyncDiagnostics] = React.useState<SyncDiagnostics>({
    checkedAt: null,
    local: countFinanceState(initialState),
    remote: { status: "not_connected" },
  });
  const [fx, setFx] = React.useState<FxCache | null>(null);
  const [cloudReady, setCloudReady] = React.useState(false);

  const remoteModifiedRef = React.useRef<string | null>(null);
  const cloudLoadedRef = React.useRef<boolean>(false);
  const syncStatusRef = React.useRef<"idle" | "saving" | "synced" | "cached" | "error">("idle");
  const suppressNextSaveRef = React.useRef<boolean>(false);
  const skippedInitialAutoSaveRef = React.useRef<boolean>(false);
  const cloudWriteBlockedRef = React.useRef<boolean>(false);
  React.useEffect(() => {
    syncStatusRef.current = syncStatus;
  }, [syncStatus]);
  const stateRef = React.useRef<FinanceState>(state);
  const keyRef = React.useRef<CryptoKey | null>(key);
  const userIdRef = React.useRef<string | null>(user?.id ?? null);
  React.useEffect(() => {
    stateRef.current = state;
    setSyncDiagnostics((d) => ({ ...d, local: countFinanceState(state) }));
  }, [state]);
  React.useEffect(() => {
    keyRef.current = key;
  }, [key]);
  React.useEffect(() => {
    userIdRef.current = user?.id ?? null;
    if (!user) {
      cloudLoadedRef.current = false;
      remoteModifiedRef.current = null;
      cloudWriteBlockedRef.current = false;
      setCloudReady(false);
      setSyncDiagnostics((d) => ({ ...d, remote: { status: "not_connected" } }));
    }
  }, [user]);

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

  // 1) Local hydration from encrypted cache
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
            if (!cancelled) setState(ensureRegions({ ...initialState, ...parsed }));
            setHydrated(true);
            return;
          } catch {}
        }
        const encRaw = localStorage.getItem(STORAGE_KEY_ENC);
        if (encRaw && key) {
          try {
            const parsed = await decryptWithKey<FinanceState>(encRaw, key);
            if (!cancelled) setState(ensureRegions({ ...initialState, ...parsed }));
          } catch {
            if (!cancelled) setState(initialState);
          }
        } else if (legacy && !key) {
          try {
            const parsed = JSON.parse(legacy);
            if (!cancelled) setState(ensureRegions({ ...initialState, ...parsed }));
          } catch {}
        }
      } catch {}
      if (!cancelled) setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  // 2) Cloud: pull-on-sign-in (once per session)
  React.useEffect(() => {
    if (!hydrated || !key || !user || cloudLoadedRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await downloadVault(user.id);
        if (cancelled) return;
        if (!result) {
          cloudLoadedRef.current = true;
          setCloudReady(true);
          setSyncDiagnostics((diag) => ({
            ...diag,
            checkedAt: Date.now(),
            remote: { status: "missing", message: "No cloud vault file yet — your first save will create it." },
          }));
          return;
        }
        remoteModifiedRef.current = result.info.modifiedTime;
        try {
          const parsed = await decryptSyncData<FinanceState>(result.content);
          if (cancelled) return;
          const remoteState = ensureRegions({ ...initialState, ...parsed });
          if (!isSyncEnvelopeBlob(result.content)) {
            const migrated = await encryptSyncData(remoteState);
            const info = await uploadVault(user.id, migrated);
            remoteModifiedRef.current = info.modifiedTime;
          }
          suppressNextSaveRef.current = true;
          setState(remoteState);
          setSyncStatus("synced");
          setLastSyncedAt(Date.now());
          setSyncDiagnostics((diag) => ({
            ...diag,
            checkedAt: Date.now(),
            local: countFinanceState(remoteState),
            remote: {
              status: "available",
              modifiedTime: result.info.modifiedTime ?? undefined,
              counts: countFinanceState(remoteState),
            },
          }));
        } catch (error) {
          // PIN-encrypted blob from a different PIN — do not overwrite the cloud copy.
          setSyncStatus("error");
          toast.error((error as Error).message || "Cloud vault could not be unlocked. Use the same PIN on this device.");
          cloudWriteBlockedRef.current = true;
          cloudLoadedRef.current = true;
          setSyncDiagnostics((diag) => ({
            ...diag,
            checkedAt: Date.now(),
            remote: {
              status: "locked",
              modifiedTime: result.info.modifiedTime ?? undefined,
              message: (error as Error).message || "A cloud vault exists, but this PIN cannot decrypt it.",
            },
          }));
          return;
        }
        cloudLoadedRef.current = true;
        setCloudReady(true);
      } catch (e) {
        setSyncStatus("error");
        setSyncDiagnostics((diag) => ({
          ...diag,
          checkedAt: Date.now(),
          remote: { status: "error", message: (e as Error).message || "Cloud check failed" },
        }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, key, user, decryptSyncData, encryptSyncData]);

  const persistLocal = React.useCallback(async (): Promise<void> => {
    const k = keyRef.current;
    const s = stateRef.current;
    try {
      if (k) {
        const enc = await encryptWithKey(s, k);
        localStorage.setItem(STORAGE_KEY_ENC, enc);
      } else {
        localStorage.setItem(STORAGE_KEY_PLAIN, JSON.stringify(s));
      }
    } catch {
      setSyncStatus("error");
    }
  }, []);

  // Core writer — persists locally and pushes to Supabase Storage when signed in.
  const writeAndPush = React.useCallback(async (force = false): Promise<"synced" | "cached"> => {
    const k = keyRef.current;
    const s = stateRef.current;
    const uid = userIdRef.current;
    setSyncStatus("saving");
    let cloudEnc: string | null = null;
    try {
      if (k) {
        const enc = await encryptWithKey(s, k);
        localStorage.setItem(STORAGE_KEY_ENC, enc);
        cloudEnc = await encryptSyncData(s);
      } else {
        localStorage.setItem(STORAGE_KEY_PLAIN, JSON.stringify(s));
      }
    } catch (e) {
      setSyncStatus("error");
      if (force) throw e;
      return "cached";
    }
    if (uid && cloudEnc) {
      console.log("[vault] Triggering vault save:", uid, {
        force,
        blocked: cloudWriteBlockedRef.current,
        bytes: cloudEnc.length,
      });
      if (cloudWriteBlockedRef.current) {
        console.warn("[vault] Cloud write blocked (PIN mismatch with remote)");
        setSyncStatus("cached");
        if (force) throw new Error("Cloud write blocked — the cloud vault uses a different PIN");
        return "cached";
      }
      try {
        const info = await uploadVault(uid, cloudEnc);
        remoteModifiedRef.current = info.modifiedTime;
        setSyncStatus("synced");
        setLastSyncedAt(Date.now());
        return "synced";
      } catch (e) {
        console.error("[vault] Upload failed:", e);
        setSyncStatus("cached");
        if (force) throw e;
        return "cached";
      }
    } else {
      console.log("[vault] Skipping cloud push — no user or no encryption key", {
        hasUser: !!uid,
        hasCloudEnc: !!cloudEnc,
      });
      setSyncStatus("cached");
      if (force) throw new Error("Cloud upload skipped — sign in and unlock LifeVault first");
      return "cached";
    }
  }, [encryptSyncData]);

  // Re-check remote vault file metadata + counts.
  const inspectDrive = React.useCallback(async (): Promise<void> => {
    const k = keyRef.current;
    const uid = userIdRef.current;
    setSyncDiagnostics((diag) => ({
      ...diag,
      checkedAt: Date.now(),
      local: countFinanceState(stateRef.current),
      remote: { status: uid ? "checking" : "not_connected" },
    }));
    if (!k || !uid) return;
    try {
      const result = await downloadVault(uid);
      if (!result) {
        setSyncDiagnostics((diag) => ({
          ...diag,
          checkedAt: Date.now(),
          remote: { status: "missing", message: "No cloud vault file yet." },
        }));
        return;
      }
      try {
        const parsed = await decryptSyncData<FinanceState>(result.content);
        const remoteState = ensureRegions({ ...initialState, ...parsed });
        if (!isSyncEnvelopeBlob(result.content)) {
          const migrated = await encryptSyncData(remoteState);
          const info = await uploadVault(uid, migrated);
          remoteModifiedRef.current = info.modifiedTime;
        }
        setSyncDiagnostics((diag) => ({
          ...diag,
          checkedAt: Date.now(),
          remote: {
            status: "available",
            modifiedTime: result.info.modifiedTime ?? undefined,
            counts: countFinanceState(remoteState),
          },
        }));
      } catch (error) {
        setSyncDiagnostics((diag) => ({
          ...diag,
          checkedAt: Date.now(),
          remote: {
            status: "locked",
            modifiedTime: result.info.modifiedTime ?? undefined,
            message: (error as Error).message || "A cloud vault exists, but this PIN cannot decrypt it.",
          },
        }));
      }
    } catch (e) {
      setSyncDiagnostics((diag) => ({
        ...diag,
        checkedAt: Date.now(),
        remote: { status: "error", message: (e as Error).message || "Cloud check failed" },
      }));
    }
  }, [decryptSyncData, encryptSyncData]);

  const pullIfRemoteNewer = React.useCallback(async (force = false): Promise<boolean> => {
    const k = keyRef.current;
    const uid = userIdRef.current;
    if (!k || !uid) return false;
    if (syncStatusRef.current === "saving") return false;
    try {
      const info = await statVault(uid);
      if (!info) return false;
      const remoteMod = info.modifiedTime;
      if (!force && remoteMod && remoteMod === remoteModifiedRef.current) return false;
      const result = await downloadVault(uid);
      if (!result) return false;
      try {
        const parsed = await decryptSyncData<FinanceState>(result.content);
        const remoteState = ensureRegions({ ...initialState, ...parsed });
        let appliedRemoteMod = result.info.modifiedTime ?? remoteMod;
        if (!isSyncEnvelopeBlob(result.content)) {
          const migrated = await encryptSyncData(remoteState);
          const upInfo = await uploadVault(uid, migrated);
          appliedRemoteMod = upInfo.modifiedTime ?? appliedRemoteMod;
        }
        remoteModifiedRef.current = appliedRemoteMod;
        cloudWriteBlockedRef.current = false;
        suppressNextSaveRef.current = true;
        setState(remoteState);
        setSyncStatus("synced");
        setLastSyncedAt(Date.now());
        setSyncDiagnostics((diag) => ({
          ...diag,
          checkedAt: Date.now(),
          local: countFinanceState(remoteState),
          remote: {
            status: "available",
            modifiedTime: result.info.modifiedTime ?? undefined,
            counts: countFinanceState(remoteState),
          },
        }));
        return true;
      } catch (error) {
        cloudWriteBlockedRef.current = true;
        setSyncStatus("error");
        setSyncDiagnostics((diag) => ({
          ...diag,
          checkedAt: Date.now(),
          remote: {
            status: "locked",
            modifiedTime: result.info.modifiedTime ?? undefined,
            message: (error as Error).message || "A cloud vault exists, but this PIN cannot decrypt it.",
          },
        }));
      }
    } catch {
      // Network blip — try again next tick.
    }
    return false;
  }, [decryptSyncData, encryptSyncData]);

  // 3) Debounced auto-save on every state change (skip if we just applied a remote pull)
  React.useEffect(() => {
    if (!hydrated) return;
    if (user && !cloudReady) {
      // Defer cloud writes until the initial pull completes; still keep local cache fresh.
      skippedInitialAutoSaveRef.current = true;
      const t = setTimeout(() => {
        void persistLocal();
      }, 800);
      return () => clearTimeout(t);
    }
    if (suppressNextSaveRef.current) {
      suppressNextSaveRef.current = false;
      return;
    }
    if (skippedInitialAutoSaveRef.current) {
      skippedInitialAutoSaveRef.current = false;
    }
    setSyncStatus("saving");
    const t = setTimeout(() => {
      void writeAndPush(false);
    }, 800);
    return () => clearTimeout(t);
  }, [state, hydrated, key, user, cloudReady, persistLocal, writeAndPush]);

  // 3c) Publish snapshot for family viewers (debounced; only when signed in & hydrated).
  React.useEffect(() => {
    if (!hydrated || !user) return;
    const t = setTimeout(() => {
      try {
        const s = buildSharedSummary(state, fx);
        void publishMySnapshot({
          data: {
            displayName: user.user_metadata?.full_name || user.user_metadata?.name || user.email || null,
            baseCurrency: s.baseCurrency,
            netWorth: s.netWorth,
            totalAssets: s.totalAssets,
            totalLiabilities: s.totalLiabilities,
            monthlyIncome: s.monthlyIncome,
            monthlyExpenses: s.monthlyExpenses,
            emergencyFund: s.emergencyFund,
            goalCount: s.goalCount,
            accountCount: s.accountCount,
            healthScore: s.healthScore,
          },
        }).catch((e) => console.warn("[snapshot] publish failed:", e));
      } catch (e) {
        console.warn("[snapshot] build failed:", e);
      }
    }, 2500);
    return () => clearTimeout(t);
  }, [state, fx, hydrated, user]);


  // 3b) Live auto-pull: every 20s while tab is visible, on focus, on reconnect.
  React.useEffect(() => {
    if (!hydrated || !key || !user) return;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      void pullIfRemoteNewer();
    };
    const onVis = () => {
      if (document.visibilityState === "visible") void pullIfRemoteNewer();
    };
    const onFocus = () => void pullIfRemoteNewer();
    const onOnline = () => void pullIfRemoteNewer();
    const kick = setTimeout(() => void pullIfRemoteNewer(), 1500);
    const id = setInterval(tick, 20_000);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    return () => {
      clearTimeout(kick);
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
    };
  }, [hydrated, key, user, pullIfRemoteNewer]);

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
    const pulled = await pullIfRemoteNewer();
    if (pulled) return;
    await writeAndPush(true);
  }, [pullIfRemoteNewer, writeAndPush]);

  const pullFromDrive = React.useCallback(async () => {
    return pullIfRemoteNewer(true);
  }, [pullIfRemoteNewer]);

  const pushToDrive = React.useCallback(async () => {
    await writeAndPush(true);
    await inspectDrive();
  }, [inspectDrive, writeAndPush]);

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
    setState(ensureRegions({ ...initialState, ...parsed }));
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
        lastSyncedAt,
        syncDiagnostics,
        syncNow,
        inspectDrive,
        pullFromDrive,
        pushToDrive,
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
  investment: "💼 Investments",
  equity: "Equity (legacy)",
  debt: "Debt (legacy)",
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
    // Credit cards: outstanding = opening + expenses − (payments + transfers in)
    const exp = txs
      .filter((t) => t.type === "expense" && t.category !== "Credit Card Payment")
      .reduce((s, t) => s + t.amount, 0);
    const pay = txs
      .filter((t) => t.type === "expense" && t.category === "Credit Card Payment")
      .reduce((s, t) => s + t.amount, 0);
    // Transfers into a credit card account (e.g. paying the card from a bank
    // account) arrive as income entries with category "Transfer In". They
    // should reduce the outstanding just like a Credit Card Payment.
    const transferIn = txs
      .filter((t) => t.type === "income" && !!t.transferId)
      .reduce((s, t) => s + t.amount, 0);
    return opening + exp - pay - transferIn;
  }
  if (acc.type === "fd") {
    // Fixed deposits hold the invested amount; transactions don't change it.
    return opening;
  }
  const inc = txs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const exp = txs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  // Investments tied to a cash account are outflows (cash → holding).
  const inv = txs.filter((t) => t.type === "investment").reduce((s, t) => s + t.amount, 0);
  return opening + inc - exp - inv;
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
    investment: 0,
    equity: 0,
    debt: 0,
    gold: 0,
    realestate: 0,
    crypto: 0,
  };
  state.assets.forEach((a) => {
    // Migrate legacy equity/debt categories into the unified investment bucket.
    const cat: AssetCategory =
      a.category === "equity" || a.category === "debt" ? "investment" : a.category;
    out[cat] += convert(a.value || 0, a.currency || base, base, fx);
  });
  // Bank/cash/wallet accounts → cash; FD accounts → investment (fixed-income bucket)
  state.accounts
    .filter((a) => a.type !== "credit")
    .forEach((a) => {
      const bucket: AssetCategory = a.type === "fd" ? "investment" : "cash";
      out[bucket] += convert(accountBalance(state, a.id), a.currency, base, fx);
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

/** Per-region ideal health cover in that region's currency.
 *  Currency-neutral: ~2× annual expenses per dependent (≈₹5L for ₹20k/mo). */
export function idealHealthForRegion(r: Region): number {
  return r.dependents * r.monthlyExpenses * 12 * 2;
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
  const regions: Region[] = state.regions && state.regions.length > 0
    ? state.regions
    : [{
        id: "legacy", name: "Primary", currency: base,
        monthlyIncome: state.monthlyIncome,
        monthlyExpenses: state.monthlyExpenses,
        intendedSavings: state.intendedSavings,
        emergencyFund: state.emergencyFund,
        termInsurance: state.termInsurance,
        healthInsurance: state.healthInsurance,
        dependents: state.dependents,
      }];

  const sum = (fn: (r: Region) => number) =>
    regions.reduce((acc, r) => acc + convert(fn(r), r.currency, base, fx), 0);

  const totalExpenses = sum((r) => r.monthlyExpenses);
  const totalIncome = sum((r) => r.monthlyIncome);
  const totalIntended = sum((r) => r.intendedSavings);
  const totalEmergencyManual = sum((r) => r.emergencyFund);
  const totalTerm = sum((r) => r.termInsurance);
  const totalHealth = sum((r) => r.healthInsurance);
  const totalIdealHealth = sum(idealHealthForRegion);

  const liquid = liquidEmergencyAssets(state, fx, base) + totalEmergencyManual;
  const targetEmergency = totalExpenses * 6;
  const emergencyPct = targetEmergency > 0 ? Math.min(1, liquid / targetEmergency) : 0;
  const emergency = emergencyPct * 30;

  const idealTerm = totalExpenses * 12 * 25;
  const termPct = idealTerm > 0 ? Math.min(1, totalTerm / idealTerm) : 0;
  const insurance = termPct * 20;

  const healthPct = totalIdealHealth > 0
    ? Math.min(1, totalHealth / totalIdealHealth)
    : 0;
  const health = healthPct * 20;

  const sr = totalIncome > 0 ? totalIntended / totalIncome : 0;
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

/** Build the headline summary numbers shared with household members. */
export function buildSharedSummary(state: FinanceState, fx: FxCache | null) {
  const base = state.baseCurrency || "INR";
  const assets = sumAssets(state, fx, base);
  const liabilities = sumLiabilities(state, fx, base);
  const score = computeHealthScore(state, fx);
  const monthlyIncome = state.regions.reduce(
    (s, r) => s + convert(r.monthlyIncome, r.currency, base, fx), 0,
  );
  const monthlyExpenses = state.regions.reduce(
    (s, r) => s + convert(r.monthlyExpenses, r.currency, base, fx), 0,
  );
  const emergencyFund = liquidEmergencyAssets(state, fx, base) +
    state.regions.reduce((s, r) => s + convert(r.emergencyFund, r.currency, base, fx), 0);
  return {
    baseCurrency: base,
    netWorth: assets - liabilities,
    totalAssets: assets,
    totalLiabilities: liabilities,
    monthlyIncome,
    monthlyExpenses,
    emergencyFund,
    goalCount: state.goals.length,
    accountCount: state.accounts.length,
    healthScore: score.total,
  };
}

