import * as React from "react";
import {
  TrendingUp, TrendingDown, PiggyBank, Shield, Camera, ArrowUp, ArrowDown,
  AlertTriangle, Plus, Receipt, Target, Wallet, FileWarning, ChevronRight,
  HeartPulse, Lightbulb,
} from "lucide-react";
import {
  useFinance, sumAssets, sumLiabilities, assetsByCategory,
  computeHealthScore,
  type NetWorthSnapshot,
} from "@/lib/finance-context";
import { convert, formatMoney } from "@/lib/currency";
import { formatINR, uid } from "@/lib/finance-utils";
import { GlassCard, SectionTitle } from "./primitives";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import { computeExpiryAlerts } from "@/lib/vault-expiry";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

interface Props {
  onNavigate: (tab: "essentials" | "networth" | "cashflow" | "goals" | "vault" | "settings") => void;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Good evening";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function firstName(user: ReturnType<typeof useAuth>["user"]): string {
  const n =
    (user?.user_metadata?.name as string | undefined) ||
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.email ? user.email.split("@")[0] : "");
  return (n || "there").split(/\s+/)[0];
}

function formatToday(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function Money({ value, className }: { value: number; className?: string }) {
  return <span className={`tabular ${className ?? ""}`}>{formatINR(value)}</span>;
}

export function HomeView({ onNavigate }: Props) {
  const { state, setState, fx } = useFinance();
  const { user } = useAuth();
  const base = state.baseCurrency || "INR";

  const totalAssets = sumAssets(state, fx, base);
  const totalLiabs = sumLiabilities(state, fx, base);
  const netWorth = totalAssets - totalLiabs;

  // Snapshot diff
  const lastSnap: NetWorthSnapshot | undefined = state.snapshots.length
    ? state.snapshots[state.snapshots.length - 1]
    : undefined;
  const monthChange = lastSnap ? netWorth - lastSnap.netWorth : 0;

  // Sparkline data (last 6 snapshots, fall back to a flat line)
  const sparkData = React.useMemo(() => {
    const arr = state.snapshots.slice(-6).map((s) => ({ v: s.netWorth }));
    if (arr.length < 2) return [{ v: netWorth * 0.98 }, { v: netWorth }];
    return arr;
  }, [state.snapshots, netWorth]);

  const takeSnapshot = () => {
    const byCat = assetsByCategory(state, fx, base);
    const snap: NetWorthSnapshot = {
      id: uid(),
      date: new Date().toISOString(),
      assets: totalAssets,
      liabilities: totalLiabs,
      netWorth,
      assetBreakdown: byCat,
    };
    setState((s) => ({ ...s, snapshots: [...s.snapshots, snap] }));
    toast.success("Snapshot saved");
  };

  // This month transaction stats
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthTx = state.transactions.filter(
    (t) => new Date(t.date) >= monthStart && !t.transferId,
  );
  const monthIncome = monthTx
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + convert(t.amount, t.currency || base, base, fx), 0);
  const monthExpenses = monthTx
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + convert(t.amount, t.currency || base, base, fx), 0);
  const savingsRate = monthIncome > 0 ? Math.max(0, ((monthIncome - monthExpenses) / monthIncome) * 100) : 0;

  // Emergency runway
  const monthlyBaseline = state.regions.reduce(
    (s, r) => s + convert(r.monthlyExpenses || 0, r.currency, base, fx), 0,
  ) || monthExpenses;
  const efTarget = state.regions.reduce(
    (s, r) => s + convert(r.emergencyFund || 0, r.currency, base, fx), 0,
  );
  const liquidAssets = state.accounts
    .filter((a) => a.emergencyFund)
    .reduce((s, a) => s + convert(a.openingBalance, a.currency, base, fx), 0);
  const runway = monthlyBaseline > 0 ? (Math.max(liquidAssets, efTarget) / monthlyBaseline) : 0;

  // Upcoming bills
  const upcomingBills = React.useMemo(() => {
    const limit = new Date(now.getTime() + 30 * 86_400_000);
    return [...(state.bills ?? [])]
      .filter((b) => {
        const d = new Date(b.nextDue);
        return !isNaN(d.getTime()) && d <= limit;
      })
      .sort((a, b) => new Date(a.nextDue).getTime() - new Date(b.nextDue).getTime())
      .slice(0, 3);
  }, [state.bills, now]);

  // Top goals by nearest deadline
  const topGoals = React.useMemo(() => {
    return [...state.goals]
      .sort((a, b) => a.targetYear - b.targetYear)
      .slice(0, 3);
  }, [state.goals]);

  // Rebalancing alerts: actual vs target by category
  const rebalance = React.useMemo(() => {
    const byCat = assetsByCategory(state, fx, base);
    const tot = Object.values(byCat).reduce((s, v) => s + v, 0);
    if (tot <= 0) return null as null | { cat: string; actual: number; target: number; delta: number };
    const issues = Object.entries(state.targetAllocation).map(([k, target]) => {
      const actual = ((byCat as Record<string, number>)[k] ?? 0) / tot * 100;
      return { cat: k, actual, target, delta: actual - target };
    });
    const worst = issues.reduce((a, b) => Math.abs(b.delta) > Math.abs(a.delta) ? b : a, issues[0]);
    return Math.abs(worst.delta) > 5 ? worst : null;
  }, [state, fx, base]);

  // Expiry alerts (cross-link to vault)
  const expiryAlerts = React.useMemo(() => computeExpiryAlerts(state.vault ?? {}), [state.vault]);

  // Getting started checklist
  const checklist = [
    { id: "profile", label: "Set your financial profile", done: (state.regions?.[0]?.monthlyIncome ?? 0) > 0, target: "essentials" as const },
    { id: "account", label: "Add your first bank account", done: state.accounts.length > 0, target: "cashflow" as const },
    { id: "asset", label: "Add your first asset", done: state.assets.length > 0, target: "networth" as const },
    { id: "ef", label: "Set your emergency fund target", done: efTarget > 0, target: "essentials" as const },
    { id: "goal", label: "Add your first goal", done: state.goals.length > 0, target: "goals" as const },
    { id: "vault", label: "Add your first vault record", done: Object.values(state.vault ?? {}).some((v) => v.length > 0), target: "vault" as const },
  ];
  const completed = checklist.filter((c) => c.done).length;
  const allDone = completed === checklist.length;
  const [onbDismissed, setOnbDismissed] = React.useState<boolean>(() => {
    try { return localStorage.getItem("lifevault_onboard_done") === "1"; } catch { return false; }
  });
  React.useEffect(() => {
    if (allDone) {
      try { localStorage.setItem("lifevault_onboard_done", "1"); } catch {}
    }
  }, [allDone]);

  const showChecklist = !onbDismissed && !allDone;

  // Financial health score (mini)
  const healthScore = React.useMemo(() => computeHealthScore(state, fx), [state, fx]);
  const healthTone =
    healthScore.total >= 71 ? "text-positive"
    : healthScore.total >= 41 ? "text-warning"
    : "text-danger";
  const healthBar =
    healthScore.total >= 71 ? "bg-positive"
    : healthScore.total >= 41 ? "bg-warning"
    : "bg-danger";

  // Quick insights
  type Insight = { emoji: string; text: string; target: Parameters<typeof onNavigate>[0]; cls: string };
  const insights: Insight[] = [];
  if (savingsRate >= 20) {
    insights.push({ emoji: "💡", text: "Savings rate above average", target: "cashflow", cls: "border-positive/30 bg-positive/10 text-positive hover:bg-positive/15" });
  }
  if (efTarget === 0 && liquidAssets === 0) {
    insights.push({ emoji: "⚠️", text: "No emergency fund yet", target: "essentials", cls: "border-warning/30 bg-warning/10 text-warning hover:bg-warning/15" });
  }
  const goalsNeedingMonthly = state.goals.filter((g) => {
    const yrs = Math.max(0, g.targetYear - new Date().getFullYear());
    const future = g.currentCost * Math.pow(1 + g.inflation / 100, yrs);
    return (g.currentSavings || 0) < future;
  }).length;
  if (goalsNeedingMonthly > 0) {
    insights.push({ emoji: "🎯", text: `${goalsNeedingMonthly} goal${goalsNeedingMonthly === 1 ? "" : "s"} need contributions`, target: "goals", cls: "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15" });
  }
  if (lastSnap && monthChange > 0 && insights.length < 3) {
    insights.push({ emoji: "📈", text: `Net worth up ${formatINR(monthChange)}`, target: "networth", cls: "border-positive/30 bg-positive/10 text-positive hover:bg-positive/15" });
  }
  const trimmedInsights = insights.slice(0, 3);



  return (
    <div className="space-y-6 md:space-y-8">
      {/* Greeting */}
      <div>
        <h2 className="font-display text-2xl md:text-3xl">
          {greeting()}, {firstName(user)}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">{formatToday()}</p>
        <p className="text-xs text-muted-foreground mt-0.5">Here's your financial snapshot</p>
      </div>

      {/* Net Worth Hero */}
      <GlassCard className="relative overflow-hidden">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Total Net Worth</div>
            <div className={`font-display text-4xl md:text-5xl mt-2 tabular ${netWorth >= 0 ? "text-positive" : "text-danger"}`}>
              {formatINR(netWorth)}
            </div>
            {lastSnap ? (
              <div className={`mt-1.5 inline-flex items-center gap-1 text-sm tabular ${monthChange >= 0 ? "text-positive" : "text-danger"}`}>
                {monthChange >= 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                {monthChange >= 0 ? "+" : "-"}{formatINR(Math.abs(monthChange))} since last snapshot ({Math.max(0, Math.floor((Date.now() - new Date(lastSnap.date).getTime()) / 86_400_000))} days ago)
              </div>
            ) : (
              <div className="mt-1.5 text-sm text-muted-foreground">
                Take your first snapshot to track changes
              </div>
            )}
            {netWorth < 0 && totalAssets === 0 && (
              <div className="mt-2 text-xs italic text-amber-400/90 max-w-md">
                Your liabilities exceed your assets. Add your assets in Net Worth to see the full picture.
              </div>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={takeSnapshot} className="gap-1.5 shrink-0">
            <Camera className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Take Snapshot</span>
          </Button>
        </div>
        <div className="mt-4 h-16 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkData}>
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Line
                type="monotone" dataKey="v" stroke="var(--color-primary)"
                strokeWidth={2} dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={TrendingUp} tint="positive" label="Income" value={monthIncome} sub={now.toLocaleDateString(undefined, { month: "long", year: "numeric" })} />
        <StatCard icon={TrendingDown} tint="danger" label="Expenses" value={monthExpenses} sub={now.toLocaleDateString(undefined, { month: "long", year: "numeric" })} />
        <StatCard icon={PiggyBank} tint="primary" label="Savings Rate" valueText={`${savingsRate.toFixed(0)}%`} sub="of income saved" />
        <StatCard icon={Shield} tint="warning" label="Runway" valueText={`${runway.toFixed(1)} mo`} sub="of expenses covered" />
      </div>

      {/* Financial Health Score (mini) */}
      <button
        onClick={() => onNavigate("essentials")}
        className="w-full text-left rounded-xl border border-border bg-card p-3 md:p-4 hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <HeartPulse className={`h-4 w-4 ${healthTone}`} />
            <span className="text-sm font-medium">Financial Health</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`font-display text-base tabular ${healthTone}`}>{(healthScore.total / 10).toFixed(1)}/10</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
        <div className="mt-2 h-1.5 w-full rounded-full bg-accent overflow-hidden">
          <div
            className={`h-full rounded-full ${healthBar}`}
            style={{ width: `${Math.max(2, healthScore.total)}%` }}
          />
        </div>
      </button>

      {/* Quick insights */}
      {insights.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {insights.map((ins, i) => (
            <button
              key={i}
              onClick={() => onNavigate(ins.target)}
              className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${ins.cls}`}
            >
              <span>{ins.emoji}</span>
              <span>{ins.text}</span>
            </button>
          ))}
        </div>
      )}


      {/* Expiry alert mini-card */}
      {expiryAlerts.length > 0 && (
        <button
          onClick={() => onNavigate("vault")}
          className="w-full text-left rounded-xl border border-warning/30 bg-warning/10 p-3 md:p-4 flex items-center gap-3 hover:bg-warning/15 transition-colors"
        >
          <FileWarning className="h-5 w-5 text-warning shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">{expiryAlerts.length} item{expiryAlerts.length === 1 ? "" : "s"} expiring soon</div>
            <div className="text-xs text-muted-foreground">Tap to review in your Vault</div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      )}

      {/* Upcoming Bills */}
      <div>
        <SectionTitle
          title="Upcoming Bills"
          right={<button className="text-xs text-primary hover:underline" onClick={() => onNavigate("cashflow")}>View all</button>}
        />
        <GlassCard className="p-2 md:p-3">
          {upcomingBills.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6">No upcoming bills</div>
          ) : (
            <div className="divide-y divide-border">
              {upcomingBills.map((b) => {
                const days = Math.ceil((new Date(b.nextDue).getTime() - Date.now()) / 86_400_000);
                const color =
                  days < 3 ? "text-danger bg-danger/10 border-danger/20"
                  : days < 7 ? "text-warning bg-warning/10 border-warning/20"
                  : "text-positive bg-positive/10 border-positive/20";
                const acc = b.accountId ? state.accounts.find((a) => a.id === b.accountId) : null;
                const ccy = b.currency || acc?.currency || state.baseCurrency || "INR";
                return (
                  <div key={b.id} className="flex items-center gap-3 py-2.5 px-2">
                    <Receipt className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{b.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {new Date(b.nextDue).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                      </div>
                    </div>
                    <div className="tabular text-sm shrink-0">{formatMoney(b.amount, ccy)}</div>
                    <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${color}`}>
                      {days <= 0 ? "Today" : `${days}d`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>
      </div>

      {/* Goals */}
      <div>
        <SectionTitle
          title="Goals"
          right={<button className="text-xs text-primary hover:underline" onClick={() => onNavigate("goals")}>View all</button>}
        />
        <GlassCard className="p-2 md:p-3">
          {topGoals.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6">
              No goals yet —{" "}
              <button className="text-primary hover:underline" onClick={() => onNavigate("goals")}>
                Add your first goal
              </button>
            </div>
          ) : (
            <div className="space-y-2.5 p-1.5">
              {topGoals.map((g) => {
                const monthsLeft = Math.max(1, (g.targetYear - new Date().getFullYear()) * 12);
                const futureCost = g.currentCost * Math.pow(1 + g.inflation / 100, Math.max(0, g.targetYear - new Date().getFullYear()));
                const remaining = Math.max(0, futureCost - (g.currentSavings || 0));
                const monthly = remaining / monthsLeft;
                const progress = futureCost > 0 ? Math.min(100, (g.currentSavings / futureCost) * 100) : 0;
                return (
                  <div key={g.id} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm flex items-center gap-2 min-w-0">
                        <Target className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="truncate">{g.name}</span>
                      </div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
                        {monthsLeft}mo left
                      </span>
                    </div>
                    <Progress value={progress} className="h-1.5" />
                    <div className="text-[11px] text-muted-foreground tabular">
                      {formatINR(monthly)}/mo needed
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>
      </div>

      {/* Rebalance */}
      {rebalance && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 md:p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-medium text-sm">Portfolio Rebalancing Needed</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {rebalance.cat} is {Math.abs(rebalance.delta).toFixed(1)}% {rebalance.delta > 0 ? "above" : "below"} target allocation
            </div>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => onNavigate("networth")}>
              View Net Worth
            </Button>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div>
        <SectionTitle title="Quick Actions" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Button variant="outline" className="justify-start gap-2 h-12" onClick={() => onNavigate("cashflow")}>
            <Plus className="h-4 w-4" /> Add Transaction
          </Button>
          <Button variant="outline" className="justify-start gap-2 h-12" onClick={() => onNavigate("networth")}>
            <Wallet className="h-4 w-4" /> Add Asset
          </Button>
          <Button variant="outline" className="justify-start gap-2 h-12" onClick={() => onNavigate("goals")}>
            <Target className="h-4 w-4" /> New Goal
          </Button>
        </div>
      </div>

      {/* Getting started checklist */}
      {showChecklist && (
        <GlassCard>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-display text-lg">Getting Started</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {completed} of {checklist.length} complete
              </p>
            </div>
            <div className="text-2xl font-display tabular">
              {Math.round((completed / checklist.length) * 100)}%
            </div>
          </div>
          <Progress value={(completed / checklist.length) * 100} className="h-1.5 mb-3" />
          <ul className="space-y-1.5">
            {checklist.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => onNavigate(c.target)}
                  className="w-full flex items-center gap-3 text-left px-2 py-1.5 rounded-md hover:bg-accent transition-colors"
                >
                  <span
                    className={`h-4 w-4 rounded border flex items-center justify-center text-[10px] ${
                      c.done ? "bg-positive border-positive text-white" : "border-border"
                    }`}
                  >
                    {c.done ? "✓" : ""}
                  </span>
                  <span className={`text-sm flex-1 ${c.done ? "text-muted-foreground line-through" : ""}`}>
                    {c.label}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </GlassCard>
      )}

      {allDone && !onbDismissed && (
        <GlassCard>
          <div className="text-center py-2">
            <div className="text-2xl">🎉</div>
            <div className="font-display text-lg mt-1">You're all set! Your vault is ready.</div>
            <Button size="sm" variant="ghost" className="mt-2" onClick={() => setOnbDismissed(true)}>
              Dismiss
            </Button>
          </div>
        </GlassCard>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon, tint, label, value, valueText, sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tint: "positive" | "danger" | "primary" | "warning";
  label: string;
  value?: number;
  valueText?: string;
  sub: string;
}) {
  const tintMap: Record<string, string> = {
    positive: "text-positive bg-positive/10",
    danger: "text-danger bg-danger/10",
    primary: "text-primary bg-primary/10",
    warning: "text-warning bg-warning/10",
  };
  return (
    <div className="rounded-xl border border-border bg-card p-3 md:p-4">
      <div className={`inline-flex items-center justify-center h-8 w-8 rounded-lg ${tintMap[tint]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="mt-2 text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-display text-xl md:text-2xl tabular mt-0.5">
        {valueText ?? <Money value={value ?? 0} />}
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>
    </div>
  );
}

function daysSince(iso: string): number {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));
}
