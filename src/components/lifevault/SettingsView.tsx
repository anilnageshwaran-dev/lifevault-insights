import * as React from "react";
import {
  User, Settings as SettingsIcon, ShieldCheck, Database, Sliders, Download, Upload,
  LogOut, Sun, Moon, Monitor, Smartphone, Cloud, RefreshCw,
} from "lucide-react";
import { useFinance, accountBalance } from "@/lib/finance-context";
import { useLock } from "@/lib/lock-context";
import { useTheme } from "@/lib/theme-context";
import { PinKeypad } from "./PinKeypad";
import { CurrencySelect } from "./CurrencySelect";
import { convert } from "@/lib/currency";
import { toast } from "sonner";
import JSZip from "jszip";

type Tab = "account" | "preferences" | "security" | "data" | "general";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "account", label: "Account", icon: User },
  { id: "preferences", label: "Preferences", icon: Sliders },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "data", label: "Data", icon: Database },
  { id: "general", label: "General", icon: SettingsIcon },
];

export function SettingsView() {
  const [tab, setTab] = React.useState<Tab>("account");
  return (
    <div className="grid md:grid-cols-[200px_1fr] gap-6">
      <nav className="space-y-1 md:sticky md:top-24 self-start">
        <div className="flex md:flex-col gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
                  active ? "bg-primary/15 text-foreground border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}>
                <Icon className="h-4 w-4" /> {t.label}
              </button>
            );
          })}
        </div>
      </nav>
      <div className="max-w-2xl space-y-5">
        {tab === "account" && <AccountTab />}
        {tab === "preferences" && <PreferencesTab />}
        {tab === "security" && <SecurityTab />}
        {tab === "data" && <DataTab />}
        {tab === "general" && <GeneralTab />}
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-border bg-card p-5">{children}</div>;
}

function AccountTab() {
  const { meta, updateMeta, resetAll } = useLock();
  const [name, setName] = React.useState(meta.displayName);
  return (
    <Card>
      <h3 className="font-display text-xl mb-4">Account</h3>
      <div className="space-y-4">
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Display Name</label>
          <div className="flex gap-2 mt-1">
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg bg-background border border-border outline-none focus:border-primary" />
            <button onClick={() => { updateMeta({ displayName: name }); toast.success("Saved"); }}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm">Save</button>
          </div>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Status</label>
          <div className="text-sm mt-1 text-foreground">Local vault · zero-knowledge encrypted</div>
        </div>
        <button onClick={() => {
            if (confirm("Sign out and lock your vault? This will reset your PIN.")) {
              if (!confirm("Final confirmation: all data will be wiped from this device. Continue?")) return;
              resetAll();
              toast.success("Signed out");
            }
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-danger text-white text-sm">
          <LogOut className="h-4 w-4" /> Sign Out & Reset
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
        <h3 className="font-display text-xl mb-2 flex items-center gap-2">
          <Cloud className="h-5 w-5" /> Cloud Sync
        </h3>
        <p className="text-sm text-muted-foreground mb-3">
          Your data is encrypted on this device with your PIN. For full Google Drive
          per-user sync to <code>appDataFolder</code>, the host needs to register a
          Google OAuth client; the app currently uses local encrypted storage.
        </p>
        <p className="text-xs text-muted-foreground">
          Use Export JSON below to back up. Import on any device to restore.
        </p>
      </Card>

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
      <Card>
        <h3 className="font-display text-xl mb-2">App Version</h3>
        <div className="text-sm text-muted-foreground">LifeVault v1.2.0</div>
      </Card>
    </div>
  );
}
