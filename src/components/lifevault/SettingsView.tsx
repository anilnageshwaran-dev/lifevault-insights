import * as React from "react";
import {
  User, Settings as SettingsIcon, ShieldCheck, Database, Sliders, Download, Upload,
  LogOut, Sun, Moon, Monitor, Smartphone, Cloud, RefreshCw, Users, MessageSquare,
} from "lucide-react";
import { useFinance, accountBalance } from "@/lib/finance-context";
import { useLock } from "@/lib/lock-context";
import { useTheme } from "@/lib/theme-context";
import { useDrive } from "@/lib/drive-context";
import { useAuth } from "@/lib/auth-context";
import { PinKeypad } from "./PinKeypad";
import { CurrencySelect } from "./CurrencySelect";
import { HouseholdTab } from "./HouseholdTab";
import { convert } from "@/lib/currency";
import { toast } from "sonner";
import JSZip from "jszip";
import { useServerFn } from "@tanstack/react-start";
import { submitFeedback } from "@/lib/feedback.functions";

type Tab = "account" | "family" | "preferences" | "security" | "data" | "general";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "account", label: "Account", icon: User },
  { id: "family", label: "Family", icon: Users },
  { id: "preferences", label: "Preferences", icon: Sliders },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "data", label: "Data", icon: Database },
  { id: "general", label: "General", icon: SettingsIcon },
];

export function SettingsView() {
  const [tab, setTab] = React.useState<Tab>("account");
  return (
    <div className="grid min-w-0 max-w-full md:grid-cols-[200px_1fr] gap-3 md:gap-6">
      <nav className="min-w-0 space-y-1 md:sticky md:top-24 self-start">
        <div className="flex md:flex-col gap-1 overflow-x-auto pb-1 md:pb-0 [-webkit-overflow-scrolling:touch]">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex shrink-0 items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
                  active ? "bg-primary/15 text-foreground border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}>
                <Icon className="h-4 w-4" /> {t.label}
              </button>
            );
          })}
        </div>
      </nav>
      <div className="w-full max-w-2xl min-w-0 space-y-4 md:space-y-5">
        {tab === "account" && <AccountTab />}
        {tab === "family" && <HouseholdTab />}
        {tab === "preferences" && <PreferencesTab />}
        {tab === "security" && <SecurityTab />}
        {tab === "data" && <DataTab />}
        {tab === "general" && <GeneralTab />}
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="min-w-0 rounded-xl md:rounded-2xl border border-border bg-card p-4 md:p-5">{children}</div>;
}

function CountList({
  title,
  counts,
  fallback,
}: {
  title: string;
  counts?: {
    accounts: number;
    transactions: number;
    assets: number;
    liabilities: number;
    goals: number;
    bills: number;
    vaultItems: number;
  };
  fallback?: string;
}) {
  return (
    <div className="min-w-0 rounded-lg bg-card/60 p-2">
      <div className="mb-1 font-medium text-foreground">{title}</div>
      {counts ? (
        <div className="space-y-0.5 break-words">
          <div>Accounts: {counts.accounts}</div>
          <div>Transactions: {counts.transactions}</div>
          <div>Assets: {counts.assets}</div>
          <div>Goals: {counts.goals}</div>
          <div>Bills: {counts.bills}</div>
          <div>Vault: {counts.vaultItems}</div>
        </div>
      ) : (
        <div className="break-words capitalize">{fallback ?? "Not checked"}</div>
      )}
    </div>
  );
}

function AccountTab() {
  const { meta, updateMeta, resetAll } = useLock();
  const { user, signOut } = useAuth();
  const drive = useDrive();
  const { syncStatus, lastSyncedAt, syncNow, syncDiagnostics, inspectDrive, pullFromDrive, pushToDrive } = useFinance();
  const [name, setName] = React.useState(meta.displayName);
  const [busy, setBusy] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);

  const accountName =
    (user?.user_metadata?.name as string | undefined) ||
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email ||
    "Signed in";

  const provider =
    (user?.app_metadata as { provider?: string } | undefined)?.provider ??
    user?.identities?.[0]?.provider;
  const isGoogleSignIn = provider === "google";


  const statusLabel = !drive.connected
    ? "Not connected"
    : syncStatus === "saving" || syncing
      ? "Saving…"
      : syncDiagnostics.remote.status === "locked"
        ? "PIN mismatch"
      : syncDiagnostics.remote.status === "missing"
        ? "No Drive file"
      : syncStatus === "error"
        ? "Offline — working from cache"
        : "Synced";
  const statusDot = !drive.connected
    ? "bg-foreground/30"
    : syncStatus === "saving" || syncing
      ? "bg-warning animate-pulse"
      : syncStatus === "error"
        ? "bg-danger"
        : "bg-positive";
  const lastLabel = lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : null;
  const remoteLabel = syncDiagnostics.remote.status === "available" && syncDiagnostics.remote.modifiedTime
    ? new Date(syncDiagnostics.remote.modifiedTime).toLocaleString()
    : null;

  return (
    <Card>
      <h3 className="font-display text-xl mb-4 flex items-center gap-2">
        <User className="h-5 w-5" /> Account
      </h3>
      {user && (
        <div className="mb-4 pb-4 border-b border-border">
          <div className="text-sm font-medium">{accountName}</div>
          {user.email && accountName !== user.email && (
            <div className="text-xs text-muted-foreground">{user.email}</div>
          )}
          <div className="flex min-w-0 items-start gap-2 mt-2 text-xs">
            <Cloud className="h-3.5 w-3.5 text-muted-foreground" />
            <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${statusDot}`} />
            <span className="min-w-0 break-words text-muted-foreground">
              Drive · {statusLabel}
              {lastLabel && drive.connected && <> · last {lastLabel}</>}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {!drive.connected ? (
              <button
                disabled={busy || drive.connecting}
                onClick={async () => {
                  setBusy(true);
                  try { await drive.connect(); toast.success("Connected to Google Drive"); }
                  catch (e) { toast.error((e as Error).message || "Sign-in cancelled"); }
                  finally { setBusy(false); }
                }}
                className="min-w-0 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs disabled:opacity-50"
              >
                {busy || drive.connecting
                  ? (isGoogleSignIn ? "Linking Drive…" : "Connecting…")
                  : (isGoogleSignIn ? "Link Google Drive" : "Connect Drive")}
              </button>
            ) : (
              <>
                <button
                  disabled={syncing || syncStatus === "saving"}
                  onClick={async () => {
                    setSyncing(true);
                    try {
                      if (!drive.user) await drive.connect();
                      await syncNow();
                      toast.success("Synced to Google Drive");
                    } catch (e) { toast.error((e as Error).message || "Sync failed"); }
                    finally { setSyncing(false); }
                  }}
                  className="min-w-0 px-3 py-2 rounded-lg border border-border text-xs hover:bg-accent disabled:opacity-50"
                >
                  {syncing ? "Syncing…" : "Sync now"}
                </button>
                <button
                  disabled={syncing || syncStatus === "saving"}
                  onClick={async () => {
                    setSyncing(true);
                    try { await inspectDrive(); toast.success("Drive checked"); }
                    catch (e) { toast.error((e as Error).message || "Drive check failed"); }
                    finally { setSyncing(false); }
                  }}
                  className="min-w-0 px-3 py-2 rounded-lg border border-border text-xs hover:bg-accent disabled:opacity-50"
                >
                  Check Drive
                </button>
                <button
                  disabled={syncing || syncStatus === "saving"}
                  onClick={async () => {
                    setSyncing(true);
                    try {
                      const pulled = await pullFromDrive();
                      toast.success(pulled ? "Pulled latest Drive data" : "No newer Drive data found");
                    } catch (e) { toast.error((e as Error).message || "Pull failed"); }
                    finally { setSyncing(false); }
                  }}
                  className="min-w-0 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs disabled:opacity-50"
                >
                  Pull from Drive
                </button>
                <button
                  disabled={syncing || syncStatus === "saving" || syncDiagnostics.remote.status === "locked"}
                  onClick={async () => {
                    if (!confirm("Upload this device's current data to Google Drive? This can overwrite the Drive copy.")) return;
                    setSyncing(true);
                    try { await pushToDrive(); toast.success("Uploaded this device to Drive"); }
                    catch (e) { toast.error((e as Error).message || "Upload failed"); }
                    finally { setSyncing(false); }
                  }}
                  className="min-w-0 px-3 py-2 rounded-lg border border-warning/50 text-warning text-xs hover:bg-warning/10 disabled:opacity-50"
                >
                  Push this device
                </button>
                <button
                  disabled={busy}
                  onClick={async () => {
                    if (!confirm("Disconnect Google Drive? Your local data stays on this device.")) return;
                    setBusy(true);
                    try { await drive.disconnect(); toast.success("Disconnected"); }
                    finally { setBusy(false); }
                  }}
                  className="min-w-0 px-3 py-2 rounded-lg border border-border text-xs hover:bg-accent disabled:opacity-50"
                >
                  Disconnect Drive
                </button>
              </>
            )}

            <button
              disabled={busy}
              onClick={async () => {
                if (!confirm("Sign out of LifeVault on this device?")) return;
                setBusy(true);
                try { await signOut(); toast.success("Signed out"); }
                finally { setBusy(false); }
              }}
              className="min-w-0 px-3 py-2 rounded-lg border border-border text-xs hover:bg-accent flex items-center justify-center gap-1 disabled:opacity-50"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
          <p className="break-words text-xs text-muted-foreground mt-3">
            Your encrypted vault syncs to your private Google Drive
            <code className="mx-1 break-all">appDataFolder</code>. Data stays end-to-end
            encrypted with your PIN — Google cannot read it.
          </p>
          {drive.connected && (
            <div className="mt-3 min-w-0 rounded-lg border border-border bg-background/50 p-3 text-xs text-muted-foreground space-y-2">
              <div className="font-medium text-foreground">Sync diagnostics</div>
              <div className="grid gap-2 sm:grid-cols-2">
                <CountList title="This device" counts={syncDiagnostics.local} />
                <CountList
                  title="Google Drive"
                  counts={syncDiagnostics.remote.counts}
                  fallback={
                    syncDiagnostics.remote.status === "checking"
                      ? "Checking…"
                      : syncDiagnostics.remote.message || syncDiagnostics.remote.status.replaceAll("_", " ")
                  }
                />
              </div>
              <div className="break-words">
                Drive file: {remoteLabel ?? "not verified yet"}
                {syncDiagnostics.checkedAt && <> · checked {new Date(syncDiagnostics.checkedAt).toLocaleTimeString()}</>}
              </div>
            </div>
          )}
        </div>
      )}
      <div>
        <label className="text-xs uppercase tracking-wider text-muted-foreground">Display Name</label>
        <div className="flex gap-2 mt-1">
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="min-w-0 flex-1 px-3 py-2 rounded-lg bg-background border border-border outline-none focus:border-primary" />
          <button onClick={() => { updateMeta({ displayName: name }); toast.success("Saved"); }}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm">Save</button>
        </div>
      </div>
      <div className="mt-4">
        <button onClick={() => {
            if (!confirm("Reset device PIN and wipe local cache? You'll need to set a new PIN.")) return;
            if (!confirm("Final confirmation: local data will be wiped from this device. Continue?")) return;
            resetAll();
            toast.success("Device reset");
          }}
          className="px-4 py-2 rounded-lg border border-danger/40 text-danger text-sm hover:bg-danger/10">
          Reset Device & PIN
        </button>
      </div>
    </Card>
  );
}

function PreferencesTab() {
  const { state, update, fx, refreshFx } = useFinance();
  const [pending, setPending] = React.useState(state.baseCurrency || "INR");
  const [refreshing, setRefreshing] = React.useState(false);

  return (
    <div className="space-y-5">
      <Card>
        <h3 className="font-display text-xl mb-4">Currency & FX</h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Base Display Currency</label>
            <div className="flex gap-2 mt-1">
              <div className="flex-1">
                <CurrencySelect value={pending} onChange={setPending} />
              </div>
              <button onClick={() => { update("baseCurrency", pending); toast.success("Saved"); }}
                disabled={pending === state.baseCurrency}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm disabled:opacity-50">
                Save Currency
              </button>
            </div>
          </div>
          <button onClick={async () => {
              setRefreshing(true);
              await refreshFx(true);
              setRefreshing(false);
              toast.success("FX rates refreshed");
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-accent">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Force Refresh Rates
          </button>
          <div className="text-xs text-muted-foreground">
            {fx
              ? <>✓ FX rates loaded · Last updated: {new Date(fx.ts).toLocaleString()}</>
              : <>⚠ FX rates unavailable — totals shown in original currencies.</>}
          </div>
        </div>
      </Card>
    </div>
  );
}

function SecurityTab() {
  const { meta, updateMeta, changePin, lock } = useLock();
  const [step, setStep] = React.useState<"idle" | "current" | "new" | "confirm">("idle");
  const [pin, setPin] = React.useState("");
  const [cur, setCur] = React.useState("");
  const [next, setNext] = React.useState("");

  React.useEffect(() => {
    if (pin.length !== 4) return;
    if (step === "current") { setCur(pin); setPin(""); setStep("new"); }
    else if (step === "new") { setNext(pin); setPin(""); setStep("confirm"); }
    else if (step === "confirm") {
      if (pin !== next) {
        toast.error("PINs don't match"); setStep("idle"); setPin(""); setCur(""); setNext(""); return;
      }
      void (async () => {
        const ok = await changePin(cur, pin);
        if (ok) toast.success("PIN changed"); else toast.error("Current PIN incorrect");
        setStep("idle"); setPin(""); setCur(""); setNext("");
      })();
    }
  }, [pin, step, next, cur, changePin]);

  return (
    <Card>
      <h3 className="font-display text-xl mb-4">Security</h3>
      {step === "idle" ? (
        <div className="space-y-4">
          <button onClick={() => setStep("current")}
            className="px-4 py-2 rounded-lg border border-border hover:bg-accent text-sm">Change PIN</button>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Auto-lock Timer</label>
            <select value={meta.autoLockMin}
              onChange={(e) => updateMeta({ autoLockMin: Number(e.target.value) })}
              className="mt-1 w-full px-3 py-2 rounded-lg bg-background border border-border outline-none">
              <option value={1}>1 minute</option>
              <option value={2}>2 minutes</option>
              <option value={5}>5 minutes</option>
              <option value={10}>10 minutes</option>
              <option value={-1}>Never</option>
            </select>
          </div>
          <button onClick={() => { lock(); toast.success("Locked"); }}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm">Lock now</button>
        </div>
      ) : (
        <div>
          <p className="text-sm text-center text-muted-foreground mb-4">
            {step === "current" && "Enter current PIN"}
            {step === "new" && "Enter new PIN"}
            {step === "confirm" && "Confirm new PIN"}
          </p>
          <PinKeypad value={pin} onChange={setPin} />
          <button onClick={() => { setStep("idle"); setPin(""); setCur(""); setNext(""); }}
            className="block mx-auto mt-4 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
        </div>
      )}
    </Card>
  );
}

function DataTab() {
  const { state, exportData, importData, fx } = useFinance();
  const { resetAll } = useLock();
  const fileRef = React.useRef<HTMLInputElement>(null);

  const exportCsvZip = async () => {
    const base = state.baseCurrency || "INR";
    const zip = new JSZip();
    const csvEscape = (v: string | number | undefined | null) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const join = (rows: (string | number | undefined | null)[][]) =>
      rows.map((r) => r.map(csvEscape).join(",")).join("\n");

    const accById = Object.fromEntries(state.accounts.map((a) => [a.id, a]));

    // transactions
    const txRows: (string | number | undefined)[][] = [
      ["date", "account", "type", "category", "description", "amount", "currency", "amount_in_base_currency", "base_currency"],
    ];
    state.transactions.forEach((t) => {
      const acc = t.accountId ? accById[t.accountId] : undefined;
      const ccy = t.currency || acc?.currency || base;
      txRows.push([
        t.date, acc?.name || "", t.type, t.category, t.description, t.amount, ccy,
        Math.round(convert(t.amount, ccy, base, fx)), base,
      ]);
    });
    zip.file("transactions.csv", join(txRows));

    // accounts
    const accRows: (string | number | undefined)[][] = [
      ["name", "type", "current_balance", "currency", "balance_in_base_currency", "base_currency"],
    ];
    state.accounts.forEach((a) => {
      const bal = accountBalance(state, a.id);
      accRows.push([a.name, a.type, bal, a.currency, Math.round(convert(bal, a.currency, base, fx)), base]);
    });
    zip.file("accounts.csv", join(accRows));

    // assets
    const aRows: (string | number | undefined)[][] = [
      ["name", "type", "subtype", "current_value", "currency", "value_in_base_currency", "base_currency", "total_invested", "invested_currency"],
    ];
    state.assets.forEach((a) => {
      const ccy = a.currency || base;
      aRows.push([
        a.name, a.category, a.subtype || "", a.value, ccy,
        Math.round(convert(a.value, ccy, base, fx)), base, a.invested || 0, ccy,
      ]);
    });
    zip.file("assets.csv", join(aRows));

    // liabilities
    const lRows: (string | number | undefined)[][] = [
      ["name", "type", "outstanding", "currency", "outstanding_in_base_currency", "base_currency", "interest_rate", "emi", "emi_currency"],
    ];
    state.liabilities.forEach((l) => {
      const ccy = l.currency || base;
      lRows.push([
        l.name, l.category, l.principal, ccy,
        Math.round(convert(l.principal, ccy, base, fx)), base, l.rate, l.emi, ccy,
      ]);
    });
    zip.file("liabilities.csv", join(lRows));

    // goals
    const gRows: (string | number | undefined)[][] = [
      ["name", "target_amount", "currency", "target_date", "current_progress", "progress_currency", "monthly_sip_required"],
    ];
    state.goals.forEach((g) => {
      const years = Math.max(0, g.targetYear - new Date().getFullYear());
      const future = g.currentCost * Math.pow(1 + g.inflation / 100, years);
      const sip = years > 0 ? (future - g.currentSavings) / (years * 12) : 0;
      gRows.push([g.name, Math.round(future), g.currency || base, g.targetYear, g.currentSavings, g.currency || base, Math.round(Math.max(0, sip))]);
    });
    zip.file("goals.csv", join(gRows));

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lifevault_csvs_${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("CSVs exported");
  };

  return (
    <div className="space-y-5">






      <Card>
        <h3 className="font-display text-xl mb-2">Export Data</h3>
        <p className="text-sm text-muted-foreground mb-4">Your data is yours and always will be.</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportData}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm">
            <Download className="h-4 w-4" /> Export JSON
          </button>
          <button onClick={exportCsvZip}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm">
            <Download className="h-4 w-4" /> Export CSVs (zip)
          </button>
          <button onClick={async () => {
              try {
                const { generateFinancialReport } = await import("@/lib/pdf-report");
                generateFinancialReport(state, fx);
                toast.success("Report downloaded");
              } catch (e) { toast.error((e as Error).message || "PDF export failed"); }
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm">
            <Download className="h-4 w-4" /> Export PDF Report
          </button>
          <button onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-accent">
            <Upload className="h-4 w-4" /> Import JSON
          </button>

          <input ref={fileRef} type="file" accept="application/json" className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0]; if (!f) return;
              try { await importData(f); toast.success("Imported"); }
              catch { toast.error("Invalid file"); }
              e.target.value = "";
            }} />
        </div>
      </Card>

      <Card>
        <div className="border-l-2 border-warning pl-4">
          <h4 className="font-medium">Reset All Data</h4>
          <p className="text-sm text-muted-foreground mt-1 mb-3">
            Permanently deletes assets, liabilities, snapshots, goals, transactions,
            accounts, budgets, vault records, and allocation targets.
          </p>
          <button onClick={() => {
              if (!confirm("Permanently delete ALL data?")) return;
              if (!confirm("Final confirmation: this cannot be undone. Continue?")) return;
              resetAll();
              toast.success("All data reset");
            }}
            className="px-4 py-2 rounded-lg bg-warning text-white text-sm">
            Reset All Data
          </button>
        </div>
      </Card>
    </div>
  );
}


function GeneralTab() {
  const { mode, setMode } = useTheme();
  const [installable, setInstallable] = React.useState<{ prompt: () => Promise<void> } | null>(null);
  const [standalone] = React.useState(
    typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches,
  );

  React.useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setInstallable(e as unknown as { prompt: () => Promise<void> }); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  return (
    <div className="space-y-5">
      <Card>
        <h3 className="font-display text-xl mb-4">Theme</h3>
        <div className="grid grid-cols-3 gap-2">
          {([
            { id: "light", label: "Light", icon: Sun },
            { id: "dark", label: "Dark", icon: Moon },
            { id: "system", label: "System", icon: Monitor },
          ] as const).map((opt) => {
            const Icon = opt.icon;
            const active = mode === opt.id;
            return (
              <button key={opt.id} onClick={() => setMode(opt.id)}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-colors ${
                  active ? "bg-primary/15 text-foreground border-primary/30"
                    : "border-border text-muted-foreground hover:bg-accent"
                }`}>
                <Icon className="h-4 w-4" /> {opt.label}
              </button>
            );
          })}
        </div>
      </Card>
      <Card>
        <h3 className="font-display text-xl mb-2">Install App</h3>
        <p className="text-sm text-muted-foreground mb-4">Add LifeVault to your home screen for quick access.</p>
        {standalone ? (
          <div className="text-sm text-positive flex items-center gap-2">
            <Smartphone className="h-4 w-4" /> Already installed
          </div>
        ) : installable ? (
          <button onClick={() => installable.prompt()}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm">Install App</button>
        ) : (
          <p className="text-xs text-muted-foreground">
            On iOS: Safari → Share → Add to Home Screen. On Android: Chrome → tap install in the address bar.
          </p>
        )}
      </Card>
      <FeedbackCard />
      <Card>
        <h3 className="font-display text-xl mb-2">App Version</h3>
        <div className="text-sm text-muted-foreground">LifeVault v1.2.0</div>
      </Card>
    </div>
  );
}

function FeedbackCard() {
  const send = useServerFn(submitFeedback);
  const [category, setCategory] = React.useState<"bug" | "idea" | "praise" | "general">("general");
  const [message, setMessage] = React.useState("");
  const [rating, setRating] = React.useState<number | undefined>(undefined);
  const [busy, setBusy] = React.useState(false);

  const submit = async () => {
    const trimmed = message.trim();
    if (trimmed.length < 3) {
      toast.error("Please write a bit more");
      return;
    }
    if (trimmed.length > 2000) {
      toast.error("Message too long (max 2000 chars)");
      return;
    }
    setBusy(true);
    try {
      await send({
        data: {
          category,
          message: trimmed,
          rating,
          appVersion: "1.2.0",
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 512) : undefined,
        },
      });
      toast.success("Thanks! Feedback received.");
      setMessage("");
      setRating(undefined);
      setCategory("general");
    } catch (e) {
      toast.error((e as Error).message || "Failed to send feedback");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <h3 className="font-display text-xl mb-2 flex items-center gap-2">
        <MessageSquare className="h-5 w-5" /> Send Feedback
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Tell us what's broken, what's missing, or what you love. Goes straight to the team.
      </p>
      <div className="space-y-3">
        <div className="grid grid-cols-4 gap-2">
          {(["bug", "idea", "praise", "general"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`px-2 py-1.5 rounded-lg border text-xs capitalize transition-colors ${
                category === c
                  ? "bg-primary/15 text-foreground border-primary/30"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
          rows={4}
          maxLength={2000}
          placeholder="Your feedback…"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-y"
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-sm">
            <span className="text-muted-foreground mr-1">Rating:</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(rating === n ? undefined : n)}
                className={`h-7 w-7 rounded-md border text-xs ${
                  rating && n <= rating
                    ? "bg-primary/15 border-primary/30 text-foreground"
                    : "border-border text-muted-foreground hover:bg-accent"
                }`}
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="text-xs text-muted-foreground">{message.length}/2000</div>
        </div>
        <div className="flex gap-2">
          <button
            disabled={busy || message.trim().length < 3}
            onClick={submit}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm disabled:opacity-50"
          >
            {busy ? "Sending…" : "Send feedback"}
          </button>
          <a
            href={`mailto:anilnageshwaran@gmail.com?subject=${encodeURIComponent("LifeVault feedback")}&body=${encodeURIComponent(message)}`}
            className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-accent"
          >
            Email instead
          </a>
        </div>
      </div>
    </Card>
  );
}
