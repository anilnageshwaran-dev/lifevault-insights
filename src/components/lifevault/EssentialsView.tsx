import * as React from "react";
import {
  useFinance,
  computeHealthScore,
  liquidEmergencyAssets,
} from "@/lib/finance-context";
import { formatMoney } from "@/lib/currency";
import { pct, clamp } from "@/lib/finance-utils";
import {
  GlassCard,
  MoneyInput,
  NumberInput,
  FieldLabel,
  SectionTitle,
} from "./primitives";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, HeartPulse, Flame, PiggyBank, Wallet } from "lucide-react";

function HealthGauge({ score }: { score: number }) {
  const size = 220;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - score / 100);
  const color =
    score >= 71
      ? "var(--color-positive)"
      : score >= 41
        ? "var(--color-warning)"
        : "var(--color-danger)";
  const label =
    score >= 71 ? "Strong" : score >= 41 ? "Building" : "Needs Attention";

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

export function EssentialsView() {
  const { state, update, fx } = useFinance();
  const base = state.baseCurrency || "INR";
  const score = computeHealthScore(state, fx);
  const liquid = liquidEmergencyAssets(state, fx, base);
  const effectiveEmergency = liquid > 0 ? liquid : state.emergencyFund;

  const runwayMonths =
    state.monthlyExpenses > 0 ? effectiveEmergency / state.monthlyExpenses : 0;

  const emergencyTarget = state.monthlyExpenses * 6;
  const emergencyPct = emergencyTarget > 0 ? clamp((effectiveEmergency / emergencyTarget) * 100) : 0;
  const emergencyStatus: "critical" | "building" | "secured" =
    emergencyPct >= 80 ? "secured" : emergencyPct >= 30 ? "building" : "critical";

  const idealTerm = state.monthlyExpenses * 12 * 25;
  const termGap = Math.max(0, idealTerm - state.termInsurance);

  const idealHealth = state.dependents * 500000;
  const healthGap = idealHealth - state.healthInsurance;

  const savingsRate = state.monthlyIncome > 0 ? (state.intendedSavings / state.monthlyIncome) * 100 : 0;
  const fireYears = savingsRate > 0 ? Math.round((1 / (savingsRate / 100)) * 25) : 0;
  const srStatus: "low" | "good" | "great" =
    savingsRate >= 20 ? "great" : savingsRate >= 10 ? "good" : "low";
  const srColor =
    srStatus === "great" ? "var(--color-positive)"
    : srStatus === "good" ? "var(--color-warning)"
    : "var(--color-danger)";

  // Runway timeline marker (0 → 12m+)
  const markerPct = clamp((runwayMonths / 12) * 100, 0, 100);

  return (
    <div className="space-y-6">
      <GlassCard className="flex flex-col md:flex-row items-center gap-6 md:gap-10">
        <HealthGauge score={score.total} />
        <div className="flex-1 w-full">
          <h2 className="font-display text-3xl">Your Financial Health</h2>
          <p className="text-sm text-muted-foreground mt-1">
            A weighted score across emergency fund, insurance cover, and savings discipline.
          </p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <GlassCard>
          <SectionTitle title="Baseline Inputs" subtitle="The foundation of every calculation" />
          <div className="grid grid-cols-2 gap-x-5 gap-y-4">
            <div>
              <FieldLabel>Age</FieldLabel>
              <NumberInput value={state.age} onChange={(n) => update("age", n)} placeholder="30" />
            </div>
            <div>
              <FieldLabel>Monthly Income</FieldLabel>
              <MoneyInput value={state.monthlyIncome} onChange={(n) => update("monthlyIncome", n)} />
            </div>
            <div>
              <FieldLabel>Monthly Expenses</FieldLabel>
              <MoneyInput value={state.monthlyExpenses} onChange={(n) => update("monthlyExpenses", n)} />
            </div>
            <div>
              <FieldLabel>Intended Monthly Savings</FieldLabel>
              <MoneyInput value={state.intendedSavings} onChange={(n) => update("intendedSavings", n)} />
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-start justify-between gap-3">
            <SectionTitle title="Emergency Fund" subtitle="Six months of expenses, kept liquid" />
            <Wallet className="h-5 w-5 text-primary shrink-0" />
          </div>
          <div className="flex items-end justify-between mb-2">
            <div>
              <div className="text-xs text-muted-foreground">Target</div>
              <div className="font-display text-2xl tabular">{formatMoney(emergencyTarget, base)}</div>
            </div>
            <StatusChip value={emergencyStatus} />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Liquid assets (flagged accounts)</span>
              <span className="tabular">{formatMoney(liquid, base)}</span>
            </div>
            {liquid === 0 && (
              <>
                <FieldLabel>Manual emergency cash</FieldLabel>
                <MoneyInput value={state.emergencyFund} onChange={(n) => update("emergencyFund", n)} />
                <p className="text-[11px] text-muted-foreground">
                  Tip: add an Account in Cash Flow and tick "Part of emergency fund" to track this automatically.
                </p>
              </>
            )}
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
        </GlassCard>

        <GlassCard>
          <div className="flex items-start justify-between gap-3">
            <SectionTitle title="Term Insurance" subtitle="Protect your family's 25 years" />
            <ShieldAlert className="h-5 w-5 text-primary shrink-0" />
          </div>
          <div className="flex items-end justify-between mb-2">
            <div>
              <div className="text-xs text-muted-foreground">Ideal Cover</div>
              <div className="font-display text-2xl tabular">{formatMoney(idealTerm, base)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Gap</div>
              <div className="font-display text-xl tabular"
                style={{ color: termGap > 0 ? "var(--color-danger)" : "var(--color-positive)" }}>
                {formatMoney(termGap, base)}
              </div>
            </div>
          </div>
          <FieldLabel>Current term insurance</FieldLabel>
          <MoneyInput value={state.termInsurance} onChange={(n) => update("termInsurance", n)} />
          <div className="mt-4">
            <ProgressBar value={idealTerm > 0 ? (state.termInsurance / idealTerm) * 100 : 0} />
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-start justify-between gap-3">
            <SectionTitle title="Health Insurance" subtitle="₹5L per dependent recommended" />
            <HeartPulse className="h-5 w-5 text-primary shrink-0" />
          </div>
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>
              <FieldLabel>Dependents</FieldLabel>
              <NumberInput value={state.dependents} onChange={(n) => update("dependents", n)} />
            </div>
            <div>
              <FieldLabel>Current Cover</FieldLabel>
              <MoneyInput value={state.healthInsurance} onChange={(n) => update("healthInsurance", n)} />
            </div>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Recommended</div>
              <div className="font-display text-xl tabular">{formatMoney(idealHealth, base)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">{healthGap >= 0 ? "Gap" : "Surplus"}</div>
              <div className="font-display text-xl tabular"
                style={{ color: healthGap > 0 ? "var(--color-danger)" : "var(--color-positive)" }}>
                {formatMoney(Math.abs(healthGap), base)}
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="lg:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <SectionTitle title="Savings Rate & FIRE Horizon" subtitle="How fast can you reach financial independence?" />
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
                At your current savings rate, you could be financially independent in approximately{" "}
                <span className="font-display text-2xl tabular align-baseline" style={{ color: srColor }}>
                  {fireYears > 0 ? `${fireYears} years` : "—"}
                </span>.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Based on a simplified 25× annual expenses target. Actual timeline varies with returns and inflation.
              </p>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
