import * as React from "react";
import {
  Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip,
  CartesianGrid,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { formatINR } from "@/lib/finance-utils";
import { sipFutureValue, sipRequired, lumpSumRequired, sipGrowthSeries } from "@/lib/sip-utils";
import { Button } from "@/components/ui/button";

const RATE_PRESETS = [8, 10, 12, 15];

export function SipCalculator() {
  const [mode, setMode] = React.useState<"sip" | "goal">("sip");

  // sip → FV
  const [monthly, setMonthly] = React.useState(10_000);
  const [rate, setRate] = React.useState(12);
  const [years, setYears] = React.useState(10);

  // goal → required SIP
  const [goal, setGoal] = React.useState(50_00_000);
  const [goalYears, setGoalYears] = React.useState(15);
  const [goalRate, setGoalRate] = React.useState(12);

  const fv = sipFutureValue(monthly, rate, years);
  const invested = monthly * 12 * years;
  const gained = Math.max(0, fv - invested);

  const required = sipRequired(goal, goalRate, goalYears);
  const goalInvested = required * 12 * goalYears;
  const goalGained = Math.max(0, goal - goalInvested);

  const chartData = React.useMemo(() => {
    return mode === "sip"
      ? sipGrowthSeries(monthly, rate, years)
      : sipGrowthSeries(required, goalRate, goalYears);
  }, [mode, monthly, rate, years, required, goalRate, goalYears]);

  // Comparison table
  const periods = [5, 10, 15, 20, 25, 30];
  const rates = [8, 10, 12, 15];

  // Investment-type comparison (using current goal target if in goal mode, else fv)
  const targetCorpus = mode === "sip" ? fv : goal;
  const horizonYears = mode === "sip" ? years : goalYears;
  const sipFor = sipRequired(targetCorpus, 12, horizonYears);
  const lumpFor = lumpSumRequired(targetCorpus, 12, horizonYears);
  const fdMonthly = sipRequired(targetCorpus, 7, horizonYears);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="font-display text-3xl flex items-center gap-2">
          <TrendingUp className="h-7 w-7 text-emerald-400" /> SIP Calculator
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Plan your investments with compound growth.</p>
      </div>

      {/* Mode toggle */}
      <div className="inline-flex rounded-lg border border-border p-1 bg-card">
        <button
          onClick={() => setMode("sip")}
          className={`px-4 py-2 rounded-md text-sm transition-colors ${mode === "sip" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
        >
          How much will I have?
        </button>
        <button
          onClick={() => setMode("goal")}
          className={`px-4 py-2 rounded-md text-sm transition-colors ${mode === "goal" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
        >
          How much do I need?
        </button>
      </div>

      {/* Inputs */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        {mode === "sip" ? (
          <>
            <SliderInput
              label="Monthly SIP Amount"
              value={monthly} onChange={setMonthly}
              min={500} max={100_000} step={500}
              format={formatINR}
            />
            <RateButtons label="Expected Annual Return" value={rate} onChange={setRate} presets={RATE_PRESETS} />
            <SliderInput
              label="Time Period (Years)"
              value={years} onChange={setYears}
              min={1} max={40} step={1}
              format={(v) => `${v} yrs`}
            />
          </>
        ) : (
          <>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Target Amount</label>
              <input
                inputMode="decimal" value={goal}
                onChange={(e) => setGoal(Number(e.target.value.replace(/\D/g, "")) || 0)}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-background border border-border tabular"
              />
              <div className="flex gap-2 mt-2 flex-wrap">
                {[10_00_000, 25_00_000, 50_00_000, 1_00_00_000].map((p) => (
                  <button key={p} onClick={() => setGoal(p)}
                    className="px-2.5 py-1 rounded-md border border-border text-xs hover:bg-accent">
                    {formatINR(p)}
                  </button>
                ))}
              </div>
            </div>
            <SliderInput
              label="Time Period (Years)"
              value={goalYears} onChange={setGoalYears}
              min={1} max={40} step={1}
              format={(v) => `${v} yrs`}
            />
            <RateButtons label="Expected Annual Return" value={goalRate} onChange={setGoalRate} presets={RATE_PRESETS} />
          </>
        )}
      </div>

      {/* Results */}
      {mode === "sip" ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ResultCard label="Future Value" value={fv} accent="emerald" big />
          <ResultCard label="Amount Invested" value={invested} />
          <ResultCard label="Wealth Gained" value={gained} accent="indigo" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ResultCard label="Required Monthly SIP" value={required} accent="emerald" big />
          <ResultCard label="Total Invested" value={goalInvested} />
          <ResultCard label="Expected Returns" value={goalGained} accent="indigo" />
        </div>
      )}

      {/* Chart */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="text-sm font-medium mb-3">Growth Over Time</div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="invGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366F1" stopOpacity={0.7} />
                  <stop offset="100%" stopColor="#6366F1" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="gainGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.7} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="year" stroke="#888" fontSize={11} />
              <YAxis stroke="#888" fontSize={11}
                tickFormatter={(v: number) => v >= 1_00_000 ? `${Math.round(v / 1_00_000)}L` : `${Math.round(v / 1000)}K`} />
              <Tooltip
                formatter={(v: number) => formatINR(v)}
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }}
              />
              <Area type="monotone" dataKey="invested" stackId="1" stroke="#6366F1" fill="url(#invGrad)" name="Invested" />
              <Area type="monotone" dataKey="gain" stackId="1" stroke="#10B981" fill="url(#gainGrad)" name="Gain" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Comparison table */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="text-sm font-medium mb-3">How different returns compare</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs tabular">
            <thead className="text-muted-foreground text-left">
              <tr>
                <th className="px-2 py-2">Years</th>
                {rates.map((r) => (
                  <th key={r} className={`px-2 py-2 text-right ${r === 15 ? "text-emerald-400" : ""}`}>{r}%</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p} className="border-t border-border/50">
                  <td className="px-2 py-2">{p}y</td>
                  {rates.map((r) => {
                    const v = mode === "sip"
                      ? sipFutureValue(monthly, r, p)
                      : sipRequired(goal, r, p);
                    return (
                      <td key={r} className={`px-2 py-2 text-right ${r === 15 ? "text-emerald-400" : ""}`}>
                        {formatINR(v)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Investment Type comparison */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="text-sm font-medium">SIP vs Lump Sum vs FD — to reach {formatINR(targetCorpus)} in {horizonYears} years</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3">
            <div className="text-xs text-muted-foreground">Monthly SIP @ 12%</div>
            <div className="text-lg font-display tabular text-emerald-400">{formatINR(sipFor)}</div>
          </div>
          <div className="rounded-xl bg-card border border-border p-3">
            <div className="text-xs text-muted-foreground">Lump Sum today @ 12%</div>
            <div className="text-lg font-display tabular">{formatINR(lumpFor)}</div>
          </div>
          <div className="rounded-xl bg-card border border-border p-3">
            <div className="text-xs text-muted-foreground">Monthly FD @ 7%</div>
            <div className="text-lg font-display tabular">{formatINR(fdMonthly)}</div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Investing monthly via SIP requires ~{Math.max(0, Math.round((1 - sipFor / fdMonthly) * 100))}% less capital than FD to reach the same goal.
        </p>
      </div>
    </div>
  );
}

function SliderInput({
  label, value, onChange, min, max, step, format,
}: {
  label: string; value: number; onChange: (n: number) => void;
  min: number; max: number; step: number; format: (v: number) => string;
}) {
  return (
    <div>
      <div className="flex justify-between items-baseline">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</label>
        <span className="tabular text-sm font-medium">{format(value)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full mt-2 accent-primary"
      />
      <input
        type="number" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))}
        className="mt-2 w-full px-3 py-1.5 rounded-lg bg-background border border-border text-sm tabular"
      />
    </div>
  );
}

function RateButtons({ label, value, onChange, presets }: {
  label: string; value: number; onChange: (n: number) => void; presets: number[];
}) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</label>
      <div className="flex flex-wrap gap-2 mt-2">
        {presets.map((p) => (
          <button key={p} onClick={() => onChange(p)}
            className={`px-3 py-1.5 rounded-lg text-sm border ${
              value === p ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"
            }`}>
            {p}%
          </button>
        ))}
        <input type="number" step="0.5" min="0" max="50" value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="w-20 px-2 py-1.5 rounded-lg bg-background border border-border text-sm tabular" />
      </div>
    </div>
  );
}

function ResultCard({
  label, value, accent, big,
}: {
  label: string; value: number; accent?: "emerald" | "indigo"; big?: boolean;
}) {
  const color =
    accent === "emerald" ? "text-emerald-400"
    : accent === "indigo" ? "text-indigo-400"
    : "text-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-display tabular mt-2 ${color} ${big ? "text-3xl md:text-4xl" : "text-2xl"}`}>
        {formatINR(value)}
      </div>
    </div>
  );
}
