import * as React from "react";
import {
  ShieldCheck,
  BarChart3,
  ArrowLeftRight,
  Target,
  Download,
  Upload,
  Vault,
} from "lucide-react";
import { useFinance } from "@/lib/finance-context";
import { EssentialsView } from "./EssentialsView";
import { NetWorthView } from "./NetWorthView";
import { CashFlowView } from "./CashFlowView";
import { GoalsView } from "./GoalsView";
import { toast } from "sonner";

type TabId = "essentials" | "networth" | "cashflow" | "goals";

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "essentials", label: "Essentials", icon: ShieldCheck },
  { id: "networth", label: "Net Worth", icon: BarChart3 },
  { id: "cashflow", label: "Cash Flow", icon: ArrowLeftRight },
  { id: "goals", label: "Goals", icon: Target },
];

export function LifeVaultApp() {
  const [tab, setTab] = React.useState<TabId>("essentials");
  const [animKey, setAnimKey] = React.useState(0);
  const { exportData, importData } = useFinance();
  const fileRef = React.useRef<HTMLInputElement>(null);

  const setTabAnimated = (t: TabId) => {
    setTab(t);
    setAnimKey((k) => k + 1);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      await importData(f);
      toast.success("Data imported");
    } catch {
      toast.error("Invalid backup file");
    } finally {
      e.target.value = "";
    }
  };

  const activeLabel = TABS.find((t) => t.id === tab)!.label;

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 lg:w-64 shrink-0 border-r border-white/5 bg-sidebar/60 backdrop-blur-md p-4 sticky top-0 h-screen">
        <div className="flex items-center gap-2 px-2 py-2 mb-6">
          <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center">
            <Vault className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="font-display text-lg leading-none">LifeVault</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
              Personal Finance
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTabAnimated(t.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                  active
                    ? "bg-primary/15 text-foreground border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/[0.03]"
                }`}
              >
                <Icon className="h-4.5 w-4.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="space-y-2 pt-4 border-t border-white/5">
          <button
            onClick={exportData}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-white/[0.03] transition-colors"
          >
            <Download className="h-3.5 w-3.5" /> Export Data
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-white/[0.03] transition-colors"
          >
            <Upload className="h-3.5 w-3.5" /> Import Data
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={handleImport}
          />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-white/5 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <Vault className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="font-display text-base leading-none">LifeVault</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{activeLabel}</div>
            </div>
          </div>
          <div className="flex gap-1">
            <button
              onClick={exportData}
              className="p-2 rounded-lg text-muted-foreground hover:bg-white/[0.05]"
              aria-label="Export"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="p-2 rounded-lg text-muted-foreground hover:bg-white/[0.05]"
              aria-label="Import"
            >
              <Upload className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Desktop heading */}
        <div className="hidden md:flex items-end justify-between px-8 pt-8 pb-2">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              LifeVault
            </div>
            <h1 className="font-display text-4xl mt-1">{activeLabel}</h1>
          </div>
        </div>

        <div
          key={animKey}
          className="px-4 md:px-8 py-5 pb-28 md:pb-12 animate-[fadeUp_350ms_ease-out]"
        >
          {tab === "essentials" && <EssentialsView />}
          {tab === "networth" && <NetWorthView />}
          {tab === "cashflow" && <CashFlowView />}
          {tab === "goals" && <GoalsView />}
        </div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 border-t border-white/5 bg-background/90 backdrop-blur-md">
        <div className="grid grid-cols-4">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTabAnimated(t.id)}
                className="flex flex-col items-center gap-1 py-3 transition-colors"
                style={{
                  color: active ? "var(--color-primary)" : "var(--color-muted-foreground)",
                }}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px]">{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
