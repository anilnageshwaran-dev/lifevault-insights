import * as React from "react";
import {
  useFinance,
  computeHealthScore,
  liquidEmergencyAssets,
  idealHealthForRegion,
  type Goal,
  type Region,
} from "@/lib/finance-context";
import { formatMoney, convert } from "@/lib/currency";
import { pct, clamp, uid } from "@/lib/finance-utils";
import {
  GlassCard,
  MoneyInput,
  NumberInput,
  FieldLabel,
  SectionTitle,
} from "./primitives";
import { CurrencySelect } from "./CurrencySelect";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ShieldAlert, HeartPulse, Flame, PiggyBank, Wallet, Target, Lightbulb,
  Plus, X, Pencil, Check,
} from "lucide-react";
import { toast } from "sonner";

function HealthGauge({ score }: { score: number }) {
  const size = 220;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - score / 100);
  const color =
    score >= 71 ? "var(--color-positive)"
    : score >= 41 ? "var(--color-warning)"
    : "var(--color-danger)";
  const label = score >= 71 ? "Strong" : score >= 41 ? "Building" : "Needs Attention";
  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 900ms ease-out, stroke 300ms" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-display text-6xl tabular" style={{ color }}>{score}</div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground mt-1">Health Score</div>
        <div className="text-sm mt-1" style={{ color }}>{label}</div>
      </div>
    </div>
  );
}

function StatusChip({ value }: { value: "critical" | "building" | "secured" | "low" | "good" | "great" }) {
  const map: Record<string, { label: string; cls: string }> = {
    critical: { label: "Critical", cls: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
    building: { label: "Building", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
    secured: { label: "Secured", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
    low: { label: "Low", cls: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
    good: { label: "Good", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
    great: { label: "Great", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  };
  const c = map[value];
  return <Badge variant="outline" className={`${c.cls} border`}>{c.label}</Badge>;
}

function ProgressBar({ value, color = "var(--color-primary)" }: { value: number; color?: string }) {
  return (
    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700 ease-out"
        style={{ width: `${clamp(value)}%`, backgroundColor: color }} />
    </div>
  );
}

function flagFor(currency: string): string {
  const map: Record<string, string> = {
    INR: "🇮🇳", GBP: "🇬🇧", USD: "🇺🇸", EUR: "🇪🇺", AUD: "🇦🇺", CAD: "🇨🇦",
    SGD: "🇸🇬", JPY: "🇯🇵", AED: "🇦🇪", SAR: "🇸🇦", CHF: "🇨🇭", CNY: "🇨🇳",
    HKD: "🇭🇰", NZD: "🇳🇿", ZAR: "🇿🇦", THB: "🇹🇭", MYR: "🇲🇾", IDR: "🇮🇩",
    PHP: "🇵🇭", KRW: "🇰🇷", BDT: "🇧🇩", PKR: "🇵🇰", LKR: "🇱🇰", NPR: "🇳🇵",
  };
  return map[currency] || "🌐";
}

export function EssentialsView() {
  const { state, setState, update, fx, refreshFx } = useFinance();
  const base = state.baseCurrency || "INR";
  const score = computeHealthScore(state, fx);
  const [refreshingFx, setRefreshingFx] = React.useState(false);


  // Active region tab
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [editingNameId, setEditingNameId] = React.useState<string | null>(null);
  const [nameDraft, setNameDraft] = React.useState("");

  React.useEffect(() => {
    if (!activeId && state.regions.length > 0) setActiveId(state.regions[0].id);
    if (activeId && !state.regions.find((r) => r.id === activeId)) {
      setActiveId(state.regions[0]?.id ?? null);
    }
  }, [state.regions, activeId]);

  const region = state.regions.find((r) => r.id === activeId) || state.regions[0];

  // ----- Region helpers -----
  const updateRegion = (id: string, patch: Partial<Region>) => {
    setState((s) => ({
      ...s,
      regions: s.regions.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  };
  const addRegion = () => {
    const n: Region = {
      id: uid(),
      name: "New Region",
      currency: base,
      flag: flagFor(base),
      monthlyIncome: 0, monthlyExpenses: 0, intendedSavings: 0,
      emergencyFund: 0, termInsurance: 0, healthInsurance: 0, dependents: 0,
    };
    setState((s) => ({ ...s, regions: [...s.regions, n] }));
    setActiveId(n.id);
    setEditingNameId(n.id);
    setNameDraft(n.name);
  };
  const removeRegion = (id: string) => {
    if (state.regions.length <= 1) {
      toast.error("Keep at least one region");
      return;
    }
    const target = state.regions.find((r) => r.id === id);
    if (!target) return;
    const linkedGoals = state.goals.filter((g) => g.name?.endsWith(`· ${target.name}`)).length;
    const msg = linkedGoals > 0
      ? `${target.name} has ${linkedGoals} linked goal${linkedGoals > 1 ? "s" : ""}. Delete the region anyway? Linked goals will remain in the Goals tab.`
      : `Delete the ${target.name} region? Its baseline, emergency fund and insurance numbers will be removed.`;
    if (!confirm(msg)) return;
    setState((s) => ({ ...s, regions: s.regions.filter((r) => r.id !== id) }));
  };


  if (!region) {
    return (
      <GlassCard>
        <p className="text-sm text-muted-foreground">Setting up your regions…</p>
      </GlassCard>
    );
  }

  // ----- Per-region derived values (in region currency) -----
  const liquidBase = liquidEmergencyAssets(state, fx, base);
  // Show liquid in the active region's currency for context
  const liquidInRegion = convert(liquidBase, base, region.currency, fx);
  const effectiveEmergency = region.emergencyFund + Math.max(0, liquidInRegion);
  const emergencyTarget = region.monthlyExpenses * 6;
  const runwayMonths = region.monthlyExpenses > 0 ? effectiveEmergency / region.monthlyExpenses : 0;
  const emergencyPct = emergencyTarget > 0 ? clamp((effectiveEmergency / emergencyTarget) * 100) : 0;
  const emergencyStatus: "critical" | "building" | "secured" =
    emergencyPct >= 80 ? "secured" : emergencyPct >= 30 ? "building" : "critical";
  const markerPct = clamp((runwayMonths / 12) * 100, 0, 100);

  const idealTerm = region.monthlyExpenses * 12 * 25;
  const termGap = Math.max(0, idealTerm - region.termInsurance);

  const idealHealth = idealHealthForRegion(region);
  const healthGap = idealHealth - region.healthInsurance;

  const savingsRate = region.monthlyIncome > 0 ? (region.intendedSavings / region.monthlyIncome) * 100 : 0;
  const fireYears = savingsRate > 0 ? Math.round((1 / (savingsRate / 100)) * 25) : 0;
  const srStatus: "low" | "good" | "great" =
    savingsRate >= 20 ? "great" : savingsRate >= 10 ? "good" : "low";
  const srColor =
    srStatus === "great" ? "var(--color-positive)"
    : srStatus === "good" ? "var(--color-warning)"
    : "var(--color-danger)";

  const linkEmergencyGoal = () => {
    const target = region.monthlyExpenses * 6;
    if (target <= 0) {
      toast.error("Enter monthly expenses first");
      return;
    }
    const goalName = `Emergency Fund · ${region.name}`;
    const existing = state.goals.find((g) => g.type === "Emergency Fund" && g.name === goalName);
    const targetYear = new Date().getFullYear() + 1;
    if (existing) {
      setState((s) => ({
        ...s,
        goals: s.goals.map((g) => g.id === existing.id
          ? { ...g, currentCost: target, currentSavings: effectiveEmergency, targetYear, currency: region.currency }
          : g),
      }));
      toast.success(`${goalName} updated`);
    } else {
      const goal: Goal = {
        id: uid(),
        name: goalName,
        type: "Emergency Fund",
        currentCost: target,
        targetYear,
        inflation: 0,
        currentSavings: effectiveEmergency,
        currency: region.currency,
        icon: "🛡️",
        linked: `${region.name} emergency fund`,
      };
      setState((s) => ({ ...s, goals: [...s.goals, goal] }));
      toast.success(`Tracking ${goalName} as a Goal`);
    }
  };

  const ccy = region.currency;

  return (
    <div className="space-y-6">
      {/* Aggregate Health Score */}
      <GlassCard className="flex flex-col md:flex-row items-center gap-6 md:gap-10">
        <HealthGauge score={score.total} />
        <div className="flex-1 w-full">
          <h2 className="font-display text-3xl">Your Financial Health</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Aggregated across all regions and converted to {base}.
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
            <span>
              FX rates {fx ? `as of ${new Date(fx.ts).toLocaleString()}` : "unavailable"}
            </span>
            <button
              disabled={refreshingFx}
              onClick={async () => {
                setRefreshingFx(true);
                try { await refreshFx(true); toast.success("FX rates refreshed"); }
                catch { toast.error("Couldn't refresh rates"); }
                finally { setRefreshingFx(false); }
              }}
              className="underline hover:text-foreground disabled:opacity-50"
            >
              {refreshingFx ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-5">
            {[
              { label: "Emergency", val: score.emergency, max: 30 },
              { label: "Term Cover", val: score.insurance, max: 20 },
              { label: "Health Cover", val: score.health, max: 20 },
              { label: "Savings Rate", val: score.savings, max: 30 },
            ].map((s) => (
              <div key={s.label} className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="tabular">{Math.round(s.val)}/{s.max}</span>
                </div>
                <ProgressBar value={(s.val / s.max) * 100} />
              </div>
            ))}
          </div>
        </div>
      </GlassCard>

      {/* Shared household basics — common across all regions */}
      <GlassCard>
        <SectionTitle title="About You" subtitle="Shared across every region" />
        <div className="grid grid-cols-2 gap-x-5 gap-y-4 max-w-md">
          <div>
            <FieldLabel>Age</FieldLabel>
            <NumberInput value={state.age} onChange={(n) => update("age", n)} placeholder="30" />
          </div>
          <div>
            <FieldLabel>Dependents</FieldLabel>
            <NumberInput
              value={state.dependents}
              onChange={(n) => {
                update("dependents", n);
                // Keep per-region health-insurance recommendations in sync
                setState((s) => ({
                  ...s,
                  regions: s.regions.map((r) => ({ ...r, dependents: n })),
                }));
              }}
            />
          </div>
        </div>
      </GlassCard>

      {/* Region tabs */}
      <GlassCard className="!p-3">
        <div className="flex items-center gap-2 flex-wrap">
          {state.regions.map((r) => {
            const isActive = r.id === activeId;
            const isEditing = editingNameId === r.id;
            return (
              <div
                key={r.id}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm border transition ${
                  isActive
                    ? "bg-primary/15 border-primary/40 text-foreground"
                    : "bg-white/[0.02] border-white/10 text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{r.flag || flagFor(r.currency)}</span>
                {isEditing ? (
                  <>
                    <Input
                      autoFocus
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      className="h-6 w-24 text-xs px-2"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          updateRegion(r.id, { name: nameDraft.trim() || r.name });
                          setEditingNameId(null);
                        } else if (e.key === "Escape") {
                          setEditingNameId(null);
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        updateRegion(r.id, { name: nameDraft.trim() || r.name });
                        setEditingNameId(null);
                      }}
                      className="opacity-70 hover:opacity-100"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setActiveId(r.id)} className="font-medium">
                      {r.name}
                    </button>
                    <span className="text-xs opacity-60">· {r.currency}</span>
                    {isActive && (
                      <>
                        <button
                          onClick={() => { setEditingNameId(r.id); setNameDraft(r.name); }}
                          className="opacity-50 hover:opacity-100"
                          title="Rename"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        {state.regions.length > 1 && (
                          <button
                            onClick={() => removeRegion(r.id)}
                            className="opacity-50 hover:opacity-100 hover:text-rose-300"
                            title="Remove region"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            );
          })}
          <button
            onClick={addRegion}
            className="flex items-center gap-1 rounded-full px-3 py-1.5 text-sm border border-dashed border-white/15 text-muted-foreground hover:text-foreground hover:border-primary/40 transition"
          >
            <Plus className="h-3.5 w-3.5" /> Add region
          </button>
        </div>
      </GlassCard>

      {/* Active region body */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <GlassCard>
          <SectionTitle
            title={`${region.name} · Baseline`}
            subtitle={`All values in ${region.currency}`}
          />
          <div className="grid grid-cols-2 gap-x-5 gap-y-4">
            <div className="col-span-2">
              <FieldLabel>Currency for this region</FieldLabel>
              <CurrencySelect
                value={region.currency}
                onChange={(c) => updateRegion(region.id, { currency: c, flag: flagFor(c) })}
              />
            </div>
            <div>
              <FieldLabel>Monthly Income ({ccy})</FieldLabel>
              <MoneyInput value={region.monthlyIncome} onChange={(n) => updateRegion(region.id, { monthlyIncome: n })} />
            </div>
            <div>
              <FieldLabel>Monthly Expenses ({ccy})</FieldLabel>
              <MoneyInput value={region.monthlyExpenses} onChange={(n) => updateRegion(region.id, { monthlyExpenses: n })} />
            </div>
            <div className="col-span-2">
              <FieldLabel>Intended Monthly Savings ({ccy})</FieldLabel>
              <MoneyInput value={region.intendedSavings} onChange={(n) => updateRegion(region.id, { intendedSavings: n })} />
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-start justify-between gap-3">
            <SectionTitle title="Emergency Fund" subtitle={`Six months of expenses · ${ccy}`} />
            <Wallet className="h-5 w-5 text-primary shrink-0" />
          </div>
          <div className="flex items-end justify-between mb-2">
            <div>
              <div className="text-xs text-muted-foreground">Target</div>
              <div className="font-display text-2xl tabular">{formatMoney(emergencyTarget, ccy)}</div>
            </div>
            <StatusChip value={emergencyStatus} />
          </div>
          <div className="space-y-2">
            {liquidInRegion > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Liquid (flagged accounts, converted)</span>
                <span className="tabular">{formatMoney(liquidInRegion, ccy)}</span>
              </div>
            )}
            <FieldLabel>Manual emergency cash ({ccy})</FieldLabel>
            <MoneyInput value={region.emergencyFund} onChange={(n) => updateRegion(region.id, { emergencyFund: n })} />
            <p className="text-[11px] text-muted-foreground">
              Tip: add an Account in Cash Flow and tick "Part of emergency fund" to count it automatically.
            </p>
          </div>
          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Runway: {runwayMonths.toFixed(1)} months</span>
              <span className="tabular">{pct(emergencyPct)}</span>
            </div>
            <div className="relative h-2 rounded-full bg-white/5 overflow-visible">
              <div className="absolute inset-0 h-full rounded-full"
                style={{ background: "linear-gradient(to right, var(--color-danger), var(--color-warning), var(--color-positive))", opacity: 0.25 }} />
              <div className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full border-2 border-background"
                style={{ left: `${markerPct}%`, backgroundColor: emergencyStatus === "secured" ? "var(--color-positive)" : emergencyStatus === "building" ? "var(--color-warning)" : "var(--color-danger)" }} />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>0m</span><span>3m</span><span>6m</span><span>12m+</span>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs text-muted-foreground flex items-start gap-2">
            <Lightbulb className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p><strong className="text-foreground">Aim for {formatMoney(emergencyTarget, ccy)}</strong> — 6 months of your {region.name} expenses, kept liquid.</p>
              <p>Use a sweep-FD, liquid fund, or high-yield savings account in {ccy}.</p>
              <p>Keep it separate from daily spending so you don't dip in. Replenish first if used.</p>
            </div>
          </div>
          <Button size="sm" variant="secondary" className="mt-3 gap-1.5"
            onClick={linkEmergencyGoal} disabled={region.monthlyExpenses <= 0}>
            <Target className="h-3.5 w-3.5" />
            {state.goals.some((g) => g.type === "Emergency Fund" && g.name.endsWith(region.name)) ? "Sync with Goals" : "Track as Goal"}
          </Button>
        </GlassCard>

        <GlassCard>
          <div className="flex items-start justify-between gap-3">
            <SectionTitle title="Term Insurance" subtitle={`Cover for 25 years of ${region.name} expenses`} />
            <ShieldAlert className="h-5 w-5 text-primary shrink-0" />
          </div>
          <div className="flex items-end justify-between mb-2">
            <div>
              <div className="text-xs text-muted-foreground">Ideal Cover ({ccy})</div>
              <div className="font-display text-2xl tabular">{formatMoney(idealTerm, ccy)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Gap</div>
              <div className="font-display text-xl tabular"
                style={{ color: termGap > 0 ? "var(--color-danger)" : "var(--color-positive)" }}>
                {formatMoney(termGap, ccy)}
              </div>
            </div>
          </div>
          <FieldLabel>Current term insurance ({ccy})</FieldLabel>
          <MoneyInput value={region.termInsurance} onChange={(n) => updateRegion(region.id, { termInsurance: n })} />
          <div className="mt-4">
            <ProgressBar value={idealTerm > 0 ? (region.termInsurance / idealTerm) * 100 : 0} />
          </div>
          <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs text-muted-foreground flex items-start gap-2">
            <Lightbulb className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              {region.currency === "INR" ? (
                <>
                  <p><strong className="text-foreground">Rule of thumb: 15–20× annual income</strong> as pure term cover.</p>
                  <p>Buy <strong>pure term</strong> — avoid ULIPs and endowment plans.</p>
                  <p>Prefer claim-settlement ratio &gt; 95% (HDFC Life, ICICI Pru, Max Life). Lock young, add critical-illness + accidental-death riders.</p>
                </>
              ) : region.currency === "GBP" ? (
                <>
                  <p><strong className="text-foreground">UK level term ~10–15× annual income</strong> for the duration of your mortgage / until kids are independent.</p>
                  <p>Compare <strong>level vs decreasing term</strong> — level is steady, decreasing is cheaper and pairs with a repayment mortgage.</p>
                  <p>Write the policy <strong>in trust</strong> so the payout skips probate &amp; inheritance tax. Check Aviva, Legal &amp; General, Vitality, Royal London.</p>
                </>
              ) : (
                <>
                  <p><strong className="text-foreground">Target ~25× annual expenses</strong> as pure term cover.</p>
                  <p>Buy <strong>level term</strong> — avoid investment-linked life products.</p>
                  <p>Lock in young, prefer high claim-settlement ratio, consider riders (CI, AD).</p>
                </>
              )}
              <p className="text-[10px]">Save policy login &amp; nominee in <strong>Vault → Insurance</strong>.</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-start justify-between gap-3">
            <SectionTitle title="Health Insurance" subtitle={`Cover for you and ${region.dependents || 0} dependents`} />
            <HeartPulse className="h-5 w-5 text-primary shrink-0" />
          </div>
          <div>
            <FieldLabel>Current Cover ({ccy})</FieldLabel>
            <MoneyInput value={region.healthInsurance} onChange={(n) => updateRegion(region.id, { healthInsurance: n })} />
          </div>
          <div className="mt-3 flex items-end justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Recommended</div>
              <div className="font-display text-xl tabular">{formatMoney(idealHealth, ccy)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">{healthGap >= 0 ? "Gap" : "Surplus"}</div>
              <div className="font-display text-xl tabular"
                style={{ color: healthGap > 0 ? "var(--color-danger)" : "var(--color-positive)" }}>
                {formatMoney(Math.abs(healthGap), ccy)}
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs text-muted-foreground flex items-start gap-2">
            <Lightbulb className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              {region.currency === "INR" ? (
                <>
                  <p><strong className="text-foreground">Don't rely on employer cover</strong> — it ends with the job.</p>
                  <p>Family floater <strong>₹10–25L</strong> in tier-1 cities + <strong>super top-up ₹50L–1Cr</strong> for catastrophic events at low cost.</p>
                  <p>Insure parents on a <strong>separate policy</strong> so claim history doesn't bleed into your premiums.</p>
                  <p>Watch room-rent sub-limits, day-care cover, pre-existing waiting periods.</p>
                </>
              ) : region.currency === "GBP" ? (
                <>
                  <p>NHS covers most acute care — private health insurance is a <strong>top-up for speed &amp; choice</strong>, not a replacement.</p>
                  <p>Typical PMI <strong>£40–120/month</strong> per adult (Bupa, AXA, Vitality, WPA). Lower the excess to claim more easily; raise it to cut premium.</p>
                  <p>If employer offers PMI, check the <strong>P11D tax</strong> and whether you can continue it on leaving.</p>
                  <p>Critical illness &amp; income protection often matter more than PMI for a working-age family.</p>
                </>
              ) : (
                <>
                  <p>Check what statutory / employer cover already provides before topping up privately.</p>
                  <p>Aim for cover roughly <strong>2× annual expenses per dependent</strong> ({formatMoney(idealHealth, ccy)} suggested).</p>
                  <p>Watch network hospitals, deductibles, and pre-existing condition waiting periods.</p>
                </>
              )}
            </div>
          </div>
        </GlassCard>

        <GlassCard className="lg:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <SectionTitle title={`${region.name} · Savings Rate & FIRE Horizon`} subtitle="Per-region projection in local currency" />
            <Flame className="h-5 w-5 text-primary shrink-0" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            <div>
              <div className="text-xs text-muted-foreground">Savings Rate</div>
              <div className="font-display text-6xl tabular leading-none mt-1" style={{ color: srColor }}>
                {pct(savingsRate, 1)}
              </div>
              <div className="mt-2"><StatusChip value={srStatus} /></div>
            </div>
            <div className="md:col-span-2">
              <PiggyBank className="h-5 w-5 text-muted-foreground mb-2" />
              <p className="text-base text-foreground/90 leading-relaxed">
                At this rate, financial independence in approximately{" "}
                <span className="font-display text-2xl tabular align-baseline" style={{ color: srColor }}>
                  {fireYears > 0 ? `${fireYears} years` : "—"}
                </span>.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Based on 25× annual expenses. Switch region tabs to compare your India vs UK trajectory.
              </p>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
