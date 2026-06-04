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
  bills: [],
  baseCurrency: "INR",
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
  syncStatus: "idle" | "saving" | "synced" | "error";
  lastSyncedAt: number | null;
  syncDiagnostics: SyncDiagnostics;
  syncNow: () => Promise<void>;
  inspectDrive: () => Promise<void>;
  pullFromDrive: () => Promise<boolean>;
  pushToDrive: () => Promise<void>;
  fx: FxCache | null;
  refreshFx: (force?: boolean) => Promise<void>;
};

const FinanceContext = React.createContext<Ctx | null>(null);

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const { key, encryptSyncData, decryptSyncData } = useLock();
  const drive = useDrive();
  const [state, setState] = React.useState<FinanceState>(initialState);
  const [hydrated, setHydrated] = React.useState(false);
  const [syncStatus, setSyncStatus] = React.useState<"idle" | "saving" | "synced" | "error">(
    "idle",
  );
  const [lastSyncedAt, setLastSyncedAt] = React.useState<number | null>(null);
  const [syncDiagnostics, setSyncDiagnostics] = React.useState<SyncDiagnostics>({
    checkedAt: null,
    local: countFinanceState(initialState),
    remote: { status: "not_connected" },
  });
  const [fx, setFx] = React.useState<FxCache | null>(null);
  const [driveReady, setDriveReady] = React.useState(false);
  const driveFileIdRef = React.useRef<string | null>(null);
  const driveModifiedRef = React.useRef<string | null>(null);
  const driveLoadedRef = React.useRef<boolean>(false);
  const syncStatusRef = React.useRef<"idle" | "saving" | "synced" | "error">("idle");
  const suppressNextSaveRef = React.useRef<boolean>(false);
  const skippedInitialAutoSaveRef = React.useRef<boolean>(false);
  const driveWriteBlockedRef = React.useRef<boolean>(false);
  React.useEffect(() => {
    syncStatusRef.current = syncStatus;
  }, [syncStatus]);
  const stateRef = React.useRef<FinanceState>(state);
  const keyRef = React.useRef<CryptoKey | null>(key);
  const driveRef = React.useRef(drive);
  React.useEffect(() => {
    stateRef.current = state;
    setSyncDiagnostics((d) => ({ ...d, local: countFinanceState(state) }));
  }, [state]);
  React.useEffect(() => {
    keyRef.current = key;
  }, [key]);
  React.useEffect(() => {
    driveRef.current = drive;
  }, [drive]);

  React.useEffect(() => {
    if (!drive.connected) {
      driveLoadedRef.current = false;
      driveModifiedRef.current = null;
      driveWriteBlockedRef.current = false;
      setDriveReady(false);
      setSyncDiagnostics((d) => ({ ...d, remote: { status: "not_connected" } }));
    }
  }, [drive.connected]);

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
          setDriveReady(true);
          setSyncDiagnostics((diag) => ({
            ...diag,
            checkedAt: Date.now(),
            remote: { status: "missing", message: "No LifeVault data file found in this Google Drive account." },
          }));
          return;
        }
        driveFileIdRef.current = file.id;
        driveModifiedRef.current = file.modifiedTime ?? null;
        try {
          localStorage.setItem("lifevault_drive_fileid", file.id);
        } catch {}
        const blob = await downloadAppFile(file.id);
        try {
          const parsed = await decryptSyncData<FinanceState>(blob);
          if (!cancelled) {
            const remoteState = ensureRegions({ ...initialState, ...parsed });
            if (!isSyncEnvelopeBlob(blob)) {
              const migrated = await encryptSyncData(remoteState);
              await updateAppFile(file.id, migrated);
              try {
                const fresh = await findAppFile();
                driveModifiedRef.current = fresh?.modifiedTime ?? file.modifiedTime ?? null;
              } catch {}
            }
            suppressNextSaveRef.current = true;
            setState(remoteState);
            setSyncStatus("synced");
            setLastSyncedAt(Date.now());
            setSyncDiagnostics((diag) => ({
              ...diag,
              checkedAt: Date.now(),
              local: countFinanceState(remoteState),
              remote: { status: "available", modifiedTime: file.modifiedTime, counts: countFinanceState(remoteState) },
            }));
          }
        } catch (error) {
          // PIN-encrypted blob from a different PIN — do not overwrite the Drive copy.
          setSyncStatus("error");
          toast.error((error as Error).message || "Drive data could not be unlocked. Use the same PIN on this device.");
          driveWriteBlockedRef.current = true;
          driveLoadedRef.current = true;
          setSyncDiagnostics((diag) => ({
            ...diag,
            checkedAt: Date.now(),
            remote: {
              status: "locked",
              modifiedTime: file.modifiedTime,
              message: (error as Error).message || "A Drive file exists, but this PIN cannot decrypt it.",
            },
          }));
          return;
        }
        driveLoadedRef.current = true;
        setDriveReady(true);
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
  }, [hydrated, key, drive.connected, drive, decryptSyncData, encryptSyncData]);

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
  }, [encryptSyncData]);

  // Core writer — persists locally and pushes to Drive when connected.
  const writeAndPush = React.useCallback(async (force = false): Promise<void> => {
    const k = keyRef.current;
    const s = stateRef.current;
    const d = driveRef.current;
    setSyncStatus("saving");
    let enc: string | null = null;
    let driveEnc: string | null = null;
    try {
      if (k) {
        enc = await encryptWithKey(s, k);
        localStorage.setItem(STORAGE_KEY_ENC, enc);
        driveEnc = await encryptSyncData(s);
      } else {
        localStorage.setItem(STORAGE_KEY_PLAIN, JSON.stringify(s));
      }
    } catch {
      setSyncStatus("error");
      return;
    }
    if (d.connected && driveEnc) {
      if (driveWriteBlockedRef.current) {
        setSyncStatus("error");
        return;
      }
      try {
        const token = await d.ensureToken();
        if (!token) throw new Error("no token");
        if (driveFileIdRef.current) {
          await updateAppFile(driveFileIdRef.current, driveEnc);
        } else {
          const id = await createAppFile(driveEnc);
          driveFileIdRef.current = id;
          try {
            localStorage.setItem("lifevault_drive_fileid", id);
          } catch {}
        }
        // Refresh our known modifiedTime so the live-poll doesn't re-pull our own write.
        try {
          const fresh = await findAppFile();
          if (fresh) driveModifiedRef.current = fresh.modifiedTime ?? null;
        } catch {}
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

  // Pull latest from Drive if remote file changed. Skips while a save is in-flight.
  const inspectDrive = React.useCallback(async (): Promise<void> => {
    const k = keyRef.current;
    const d = driveRef.current;
    setSyncDiagnostics((diag) => ({
      ...diag,
      checkedAt: Date.now(),
      local: countFinanceState(stateRef.current),
      remote: { status: d.connected ? "checking" : "not_connected" },
    }));
    if (!k || !d.connected) return;
    try {
      const token = await d.ensureToken();
      if (!token) throw new Error("Drive is not authorized on this device");
      const file = await findAppFile();
      if (!file) {
        setSyncDiagnostics((diag) => ({
          ...diag,
          checkedAt: Date.now(),
          remote: { status: "missing", message: "No LifeVault data file found in this Google Drive account." },
        }));
        return;
      }
      const blob = await downloadAppFile(file.id);
      try {
        const parsed = await decryptSyncData<FinanceState>(blob);
        const remoteState = ensureRegions({ ...initialState, ...parsed });
        if (!isSyncEnvelopeBlob(blob)) {
          const migrated = await encryptSyncData(remoteState);
          await updateAppFile(file.id, migrated);
          try {
            const fresh = await findAppFile();
            if (fresh) driveModifiedRef.current = fresh.modifiedTime ?? null;
          } catch {}
        }
        setSyncDiagnostics((diag) => ({
          ...diag,
          checkedAt: Date.now(),
          remote: {
            status: "available",
            modifiedTime: file.modifiedTime,
            counts: countFinanceState(remoteState),
          },
        }));
      } catch (error) {
        setSyncDiagnostics((diag) => ({
          ...diag,
          checkedAt: Date.now(),
          remote: {
            status: "locked",
            modifiedTime: file.modifiedTime,
            message: (error as Error).message || "A Drive file exists, but this PIN cannot decrypt it.",
          },
        }));
      }
    } catch (e) {
      setSyncDiagnostics((diag) => ({
        ...diag,
        checkedAt: Date.now(),
        remote: { status: "error", message: (e as Error).message || "Drive check failed" },
      }));
    }
  }, [decryptSyncData, encryptSyncData]);

  const pullIfRemoteNewer = React.useCallback(async (force = false): Promise<boolean> => {
    const k = keyRef.current;
    const d = driveRef.current;
    if (!k || !d.connected) return false;
    if (syncStatusRef.current === "saving") return false;
    try {
      const token = await d.ensureToken();
      if (!token) return false;
      const file = await findAppFile();
      if (!file) return false;
      const remoteMod = file.modifiedTime ?? null;
      if (!force && remoteMod && remoteMod === driveModifiedRef.current) return false;
      driveFileIdRef.current = file.id;
      try {
        localStorage.setItem("lifevault_drive_fileid", file.id);
      } catch {}
      const blob = await downloadAppFile(file.id);
      try {
        const parsed = await decryptSyncData<FinanceState>(blob);
        const remoteState = ensureRegions({ ...initialState, ...parsed });
        if (!isSyncEnvelopeBlob(blob)) {
          const migrated = await encryptSyncData(remoteState);
          await updateAppFile(file.id, migrated);
          try {
            const fresh = await findAppFile();
            driveModifiedRef.current = fresh?.modifiedTime ?? remoteMod;
          } catch {}
        }
        driveModifiedRef.current = remoteMod;
        driveWriteBlockedRef.current = false;
        suppressNextSaveRef.current = true;
        setState(remoteState);
        setSyncStatus("synced");
        setLastSyncedAt(Date.now());
        setSyncDiagnostics((diag) => ({
          ...diag,
          checkedAt: Date.now(),
          local: countFinanceState(remoteState),
          remote: { status: "available", modifiedTime: file.modifiedTime, counts: countFinanceState(remoteState) },
        }));
        return true;
      } catch (error) {
        // Different PIN on the other device — can't decrypt, keep local and never overwrite it.
        driveWriteBlockedRef.current = true;
        setSyncStatus("error");
        setSyncDiagnostics((diag) => ({
          ...diag,
          checkedAt: Date.now(),
          remote: {
            status: "locked",
            modifiedTime: file.modifiedTime,
            message: (error as Error).message || "A Drive file exists, but this PIN cannot decrypt it.",
          },
        }));
      }
    } catch {
      // Network/Drive blip — try again next tick.
    }
    return false;
  }, [decryptSyncData, encryptSyncData]);

  // 3) Debounced auto-save on every state change (skip if we just applied a remote pull)
  React.useEffect(() => {
    if (!hydrated) return;
    if (drive.connected && !driveReady) {
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
  }, [state, hydrated, key, drive.connected, driveReady, persistLocal, writeAndPush]);

  // 3b) Live auto-pull from Drive: every 20s, on tab focus, and on reconnect.
  React.useEffect(() => {
    if (!hydrated || !key || !drive.connected) return;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      void pullIfRemoteNewer();
    };
    const onVis = () => {
      if (document.visibilityState === "visible") void pullIfRemoteNewer();
    };
    const onFocus = () => void pullIfRemoteNewer();
    const onOnline = () => void pullIfRemoteNewer();
    // Kick once shortly after wiring up so a fresh tab catches up quickly.
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
  }, [hydrated, key, drive.connected, pullIfRemoteNewer]);

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

