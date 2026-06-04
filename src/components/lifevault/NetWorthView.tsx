import * as React from "react";
import {
  useFinance,
  ASSET_LABELS,
  LIABILITY_LABELS,
  sumAssets,
  sumLiabilities,
  assetsByCategory,
  newAsset,
  newLiability,
  type AssetCategory,
  type LiabilityCategory,
  type NetWorthSnapshot,
} from "@/lib/finance-context";
import { formatINR, pct, uid, clamp } from "@/lib/finance-utils";
import {
  GlassCard,
  MoneyInput,
  NumberInput,
  FieldLabel,
  SectionTitle,
  EmptyState,
} from "./primitives";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Trash2,
  Camera,
  Upload,
  LineChart as LineChartIcon,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";

const ASSET_CATS: AssetCategory[] = [
  "cash",
  "equity",
  "debt",
  "gold",
  "realestate",
  "crypto",
];
const LIAB_CATS: LiabilityCategory[] = [
  "home",
  "vehicle",
  "personal",
  "credit",
  "other",
];

const CAT_COLORS: Record<AssetCategory, string> = {
  cash: "#10B981",
  equity: "#6366F1",
  debt: "#3B82F6",
  gold: "#F59E0B",
  realestate: "#A855F7",
  crypto: "#F43F5E",
};

export function NetWorthView() {
  const { state, setState } = useFinance();
  const totalAssets = sumAssets(state);
  const totalLiabs = sumLiabilities(state);
  const netWorth = totalAssets - totalLiabs;
  const byCat = assetsByCategory(state);

  const takeSnapshot = () => {
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

  return (
    <div className="space-y-6">
      {/* Hero */}
      <GlassCard className="relative overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Total Assets
            </div>
            <div className="font-display text-3xl tabular mt-1">
              {formatINR(totalAssets)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Total Liabilities
            </div>
            <div
              className="font-display text-3xl tabular mt-1"
              style={{ color: "var(--color-danger)" }}
            >
              {formatINR(totalLiabs)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Net Worth
            </div>
            <div
              className="font-display text-4xl md:text-5xl tabular mt-1"
              style={{
                color:
                  netWorth >= 0
                    ? "var(--color-positive)"
                    : "var(--color-danger)",
              }}
            >
              {formatINR(netWorth)}
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <Button onClick={takeSnapshot} className="gap-2">
            <Camera className="h-4 w-4" /> Take Snapshot
          </Button>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <GlassCard>
          <SectionTitle title="Asset Ledger" subtitle="Group your holdings by class" />
          <Accordion type="multiple" className="space-y-1">
            {ASSET_CATS.map((cat) => {
              const items = state.assets.filter((a) => a.category === cat);
              const total = items.reduce((s, a) => s + a.value, 0);
              return (
                <AccordionItem
                  key={cat}
                  value={cat}
                  className="border border-white/5 rounded-xl px-3 bg-white/[0.02]"
                >
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex flex-1 items-center justify-between pr-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: CAT_COLORS[cat] }}
                        />
                        <span className="text-sm">{ASSET_LABELS[cat]}</span>
                      </div>
                      <div className="tabular text-sm">{formatINR(total)}</div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-2">
                    {items.length === 0 && (
                      <p className="text-xs text-muted-foreground py-1">
                        No entries yet.
                      </p>
                    )}
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="grid grid-cols-12 gap-2 items-center"
                      >
                        <input
                          className="underline-input col-span-5"
                          placeholder="Name"
                          value={item.name}
                          onChange={(e) =>
                            setState((s) => ({
                              ...s,
                              assets: s.assets.map((a) =>
                                a.id === item.id
                                  ? { ...a, name: e.target.value }
                                  : a,
                              ),
                            }))
                          }
                        />
                        <div className="col-span-4">
                          <MoneyInput
                            value={item.value}
                            onChange={(n) =>
                              setState((s) => ({
                                ...s,
                                assets: s.assets.map((a) =>
                                  a.id === item.id ? { ...a, value: n } : a,
                                ),
                              }))
                            }
                          />
                        </div>
                        <div className="col-span-2 text-xs text-muted-foreground tabular text-right">
                          {totalAssets > 0
                            ? pct((item.value / totalAssets) * 100, 1)
                            : "0%"}
                        </div>
                        <button
                          className="col-span-1 text-muted-foreground hover:text-rose-400 transition-colors flex justify-end"
                          onClick={() =>
                            setState((s) => ({
                              ...s,
                              assets: s.assets.filter((a) => a.id !== item.id),
                            }))
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1"
                        onClick={() =>
                          setState((s) => ({
                            ...s,
                            assets: [...s.assets, newAsset(cat)],
                          }))
                        }
                      >
                        <Plus className="h-3.5 w-3.5" /> Add row
                      </Button>
                      {cat === "equity" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() =>
                            toast.info("CSV import coming soon")
                          }
                        >
                          <Upload className="h-3.5 w-3.5" /> Import from Zerodha CSV
                        </Button>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </GlassCard>

        <GlassCard>
          <SectionTitle title="Liabilities Ledger" subtitle="Loans & outstanding dues" />
          <Accordion type="multiple" className="space-y-1">
            {LIAB_CATS.map((cat) => {
              const items = state.liabilities.filter((l) => l.category === cat);
              const total = items.reduce((s, l) => s + l.principal, 0);
              return (
                <AccordionItem
                  key={cat}
                  value={cat}
                  className="border border-white/5 rounded-xl px-3 bg-white/[0.02]"
                >
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex flex-1 items-center justify-between pr-3">
                      <span className="text-sm">{LIABILITY_LABELS[cat]}</span>
                      <div
                        className="tabular text-sm"
                        style={{ color: "var(--color-danger)" }}
                      >
                        {formatINR(total)}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    {items.length === 0 && (
                      <p className="text-xs text-muted-foreground py-1">
                        No loans logged here.
                      </p>
                    )}
                    {items.map((item) => {
                      // Simplified amortization split
                      const months =
                        item.emi > 0 && item.principal > 0
                          ? Math.ceil(item.principal / item.emi)
                          : 0;
                      const totalPaid = item.emi * months;
                      const totalInterest = Math.max(0, totalPaid - item.principal);
                      const sum = item.principal + totalInterest;
                      const principalPct =
                        sum > 0 ? (item.principal / sum) * 100 : 0;
                      return (
                        <div
                          key={item.id}
                          className="rounded-lg bg-white/[0.02] border border-white/5 p-3 space-y-2"
                        >
                          <div className="grid grid-cols-12 gap-2 items-center">
                            <input
                              className="underline-input col-span-11"
                              placeholder="Loan name"
                              value={item.name}
                              onChange={(e) =>
                                setState((s) => ({
                                  ...s,
                                  liabilities: s.liabilities.map((l) =>
                                    l.id === item.id
                                      ? { ...l, name: e.target.value }
                                      : l,
                                  ),
                                }))
                              }
                            />
                            <button
                              className="col-span-1 text-muted-foreground hover:text-rose-400 flex justify-end"
                              onClick={() =>
                                setState((s) => ({
                                  ...s,
                                  liabilities: s.liabilities.filter(
                                    (l) => l.id !== item.id,
                                  ),
                                }))
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <FieldLabel>Principal</FieldLabel>
                              <MoneyInput
                                value={item.principal}
                                onChange={(n) =>
                                  setState((s) => ({
                                    ...s,
                                    liabilities: s.liabilities.map((l) =>
                                      l.id === item.id
                                        ? { ...l, principal: n }
                                        : l,
                                    ),
                                  }))
                                }
                              />
                            </div>
                            <div>
                              <FieldLabel>Rate %</FieldLabel>
                              <NumberInput
                                value={item.rate}
                                onChange={(n) =>
                                  setState((s) => ({
                                    ...s,
                                    liabilities: s.liabilities.map((l) =>
                                      l.id === item.id ? { ...l, rate: n } : l,
                                    ),
                                  }))
                                }
                              />
                            </div>
                            <div>
                              <FieldLabel>EMI</FieldLabel>
                              <MoneyInput
                                value={item.emi}
                                onChange={(n) =>
                                  setState((s) => ({
                                    ...s,
                                    liabilities: s.liabilities.map((l) =>
                                      l.id === item.id ? { ...l, emi: n } : l,
                                    ),
                                  }))
                                }
                              />
                            </div>
                          </div>
                          {item.emi > 0 && item.principal > 0 && (
                            <div className="space-y-1 pt-1">
                              <div className="flex justify-between text-[11px] text-muted-foreground">
                                <span>Principal {formatINR(item.principal)}</span>
                                <span>Interest {formatINR(totalInterest)}</span>
                              </div>
                              <div className="h-2 rounded-full overflow-hidden flex">
                                <div
                                  className="h-full transition-all duration-700"
                                  style={{
                                    width: `${principalPct}%`,
                                    backgroundColor: "var(--color-primary)",
                                  }}
                                />
                                <div
                                  className="h-full transition-all duration-700"
                                  style={{
                                    width: `${100 - principalPct}%`,
                                    backgroundColor: "var(--color-danger)",
                                  }}
                                />
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                ~{months} months remaining
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1"
                      onClick={() =>
                        setState((s) => ({
                          ...s,
                          liabilities: [...s.liabilities, newLiability(cat)],
                        }))
                      }
                    >
                      <Plus className="h-3.5 w-3.5" /> Add loan
                    </Button>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </GlassCard>
      </div>

      <AllocationEngine />

      <SnapshotHistory />
    </div>
  );
}

function AllocationEngine() {
  const { state, setState } = useFinance();
  const byCat = assetsByCategory(state);
  const total = sumAssets(state);
  const targetSum = ASSET_CATS.reduce(
    (s, c) => s + (state.targetAllocation[c] || 0),
    0,
  );

  const targetData = ASSET_CATS.map((c) => ({
    name: ASSET_LABELS[c],
    value: state.targetAllocation[c] || 0,
    fill: CAT_COLORS[c],
  }));
  const actualData = ASSET_CATS.map((c) => ({
    name: ASSET_LABELS[c],
    value: total > 0 ? (byCat[c] / total) * 100 : 0,
    fill: CAT_COLORS[c],
  }));

  return (
    <GlassCard>
      <SectionTitle
        title="Target vs Actual Allocation"
        subtitle="Set your target mix and rebalance when reality drifts"
        right={
          <div
            className="text-xs tabular px-2 py-1 rounded-md border"
            style={{
              color:
                targetSum === 100 ? "var(--color-positive)" : "var(--color-danger)",
              borderColor:
                targetSum === 100
                  ? "rgba(16,185,129,0.3)"
                  : "rgba(244,63,94,0.3)",
            }}
          >
            Targets sum: {targetSum}%
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          {ASSET_CATS.map((c) => (
            <div key={c} className="grid grid-cols-12 items-center gap-3">
              <div className="col-span-5 flex items-center gap-2 text-sm">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: CAT_COLORS[c] }}
                />
                {ASSET_LABELS[c]}
              </div>
              <div className="col-span-4">
                <NumberInput
                  value={state.targetAllocation[c]}
                  onChange={(n) =>
                    setState((s) => ({
                      ...s,
                      targetAllocation: { ...s.targetAllocation, [c]: n },
                    }))
                  }
                  placeholder="Target %"
                />
              </div>
              <div className="col-span-3 text-right text-xs text-muted-foreground tabular">
                actual {pct(actualData.find((d) => d.name === ASSET_LABELS[c])!.value, 1)}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-xs text-muted-foreground text-center mb-1">Target</div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={targetData}
                  innerRadius={42}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {targetData.map((d, i) => (
                    <Cell key={i} fill={d.fill} />
                  ))}
                </Pie>
                <RTooltip
                  contentStyle={{
                    background: "#0A0F1E",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                  }}
                  formatter={(v: number) => `${v.toFixed(1)}%`}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div>
            <div className="text-xs text-muted-foreground text-center mb-1">Actual</div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={actualData}
                  innerRadius={42}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {actualData.map((d, i) => (
                    <Cell key={i} fill={d.fill} />
                  ))}
                </Pie>
                <RTooltip
                  contentStyle={{
                    background: "#0A0F1E",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                  }}
                  formatter={(v: number) => `${v.toFixed(1)}%`}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="py-2">Class</th>
              <th className="py-2 text-right">Target</th>
              <th className="py-2 text-right">Actual</th>
              <th className="py-2 text-right">Deviation</th>
              <th className="py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {ASSET_CATS.map((c) => {
              const t = state.targetAllocation[c] || 0;
              const a = total > 0 ? (byCat[c] / total) * 100 : 0;
              const dev = a - t;
              const targetAmt = (t / 100) * total;
              const diff = targetAmt - byCat[c];
              const cls =
                Math.abs(dev) > 10
                  ? "bg-rose-500/10"
                  : Math.abs(dev) > 5
                    ? "bg-amber-500/10"
                    : "";
              const action =
                Math.abs(diff) < 1
                  ? "Hold"
                  : diff > 0
                    ? `Add ${formatINR(diff)}`
                    : `Reduce ${formatINR(-diff)}`;
              return (
                <tr key={c} className={`border-t border-white/5 ${cls}`}>
                  <td className="py-2.5 flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: CAT_COLORS[c] }}
                    />
                    {ASSET_LABELS[c]}
                  </td>
                  <td className="py-2.5 text-right tabular">{pct(t, 1)}</td>
                  <td className="py-2.5 text-right tabular">{pct(a, 1)}</td>
                  <td
                    className="py-2.5 text-right tabular"
                    style={{
                      color:
                        dev > 0
                          ? "var(--color-positive)"
                          : dev < 0
                            ? "var(--color-danger)"
                            : undefined,
                    }}
                  >
                    {dev > 0 ? "+" : ""}
                    {pct(dev, 1)}
                  </td>
                  <td className="py-2.5 text-right tabular">{action}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}

function SnapshotHistory() {
  const { state } = useFinance();
  const data = state.snapshots
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((s) => ({
      date: new Date(s.date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
      }),
      networth: s.netWorth,
    }));

  const last = state.snapshots[state.snapshots.length - 1];
  const prev = state.snapshots[state.snapshots.length - 2];
  const delta = last && prev ? last.netWorth - prev.netWorth : 0;

  // Per category changes
  const deltas: { label: string; change: number }[] = [];
  if (last && prev) {
    (Object.keys(last.assetBreakdown) as AssetCategory[]).forEach((k) => {
      const change = (last.assetBreakdown[k] || 0) - (prev.assetBreakdown[k] || 0);
      if (Math.abs(change) > 0)
        deltas.push({ label: ASSET_LABELS[k], change });
    });
    const liabChange = last.liabilities - prev.liabilities;
    if (liabChange !== 0)
      deltas.push({ label: "Liabilities", change: -liabChange });
  }

  return (
    <GlassCard>
      <SectionTitle title="Net Worth History" subtitle="Track your trajectory over time" />
      {state.snapshots.length < 2 ? (
        <EmptyState
          icon={LineChartIcon}
          title="No history yet"
          description="Take your first snapshot to begin tracking. After two snapshots you'll see your delta."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data}>
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#6B7280", fontSize: 11 }}
                  stroke="#1F2937"
                />
                <YAxis
                  tick={{ fill: "#6B7280", fontSize: 11 }}
                  stroke="#1F2937"
                  tickFormatter={(v) =>
                    v >= 100000 ? `${(v / 100000).toFixed(1)}L` : `${v / 1000}k`
                  }
                />
                <RTooltip
                  contentStyle={{
                    background: "#0A0F1E",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                  }}
                  formatter={(v: number) => formatINR(v)}
                />
                <Line
                  type="monotone"
                  dataKey="networth"
                  stroke="#10B981"
                  strokeWidth={2.5}
                  dot={{ fill: "#10B981", r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-xl border border-white/5 p-4 bg-white/[0.02]">
            <div className="text-xs text-muted-foreground">Since last snapshot</div>
            <div
              className="font-display text-3xl tabular mt-1"
              style={{
                color: delta >= 0 ? "var(--color-positive)" : "var(--color-danger)",
              }}
            >
              {delta >= 0 ? "+" : ""}
              {formatINR(delta)}
            </div>
            <div className="mt-4 space-y-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                What Changed
              </div>
              {deltas.length === 0 && (
                <div className="text-xs text-muted-foreground">No movement.</div>
              )}
              {deltas.map((d, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{d.label}</span>
                  <span
                    className="tabular"
                    style={{
                      color:
                        d.change >= 0
                          ? "var(--color-positive)"
                          : "var(--color-danger)",
                    }}
                  >
                    {d.change >= 0 ? "+" : ""}
                    {formatINR(d.change)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
