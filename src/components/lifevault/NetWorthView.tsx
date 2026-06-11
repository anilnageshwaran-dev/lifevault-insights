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
  accountBalance,
  type AssetCategory,
  type LiabilityCategory,
  type AssetItem,
  type LiabilityItem,
  type NetWorthSnapshot,
} from "@/lib/finance-context";
import { formatMoney, convert } from "@/lib/currency";
import { pct, uid, clamp } from "@/lib/finance-utils";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  Camera,
  LineChart as LineChartIcon,
  Calendar,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Eye,
  EyeOff,
  Download,
  FileDown,
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
import { CurrencySelect } from "./CurrencySelect";
import { amortize } from "@/lib/loan-utils";
import { useServerFn } from "@tanstack/react-start";
import { refreshInvestmentPrices } from "@/lib/investment-prices.functions";
import { detectNewMilestones, type MilestoneAchieved } from "@/lib/milestones";
import { MilestoneCelebration } from "./MilestoneCelebration";
import { MilestonesRow } from "./MilestonesRow";
import { BrokerImportDialog } from "./BrokerImportDialog";
import { generateNetWorthReport } from "@/lib/reports-pdf";
import { useAuth } from "@/lib/auth-context";
import { InvestmentEditModal } from "./InvestmentEditModal";
import { subtypeGroup } from "@/lib/finance-context";

// Equity & Debt merged into the unified "investment" category. Legacy keys
// remain in the type only for backward-compat (migrated on load).
const ASSET_CATS: AssetCategory[] = ["cash", "investment", "gold", "realestate", "crypto"];
const LIAB_CATS: LiabilityCategory[] = ["home", "vehicle", "personal", "credit", "other"];

const CAT_COLORS: Record<AssetCategory, string> = {
  cash: "#10B981",
  investment: "#6366F1",
  equity: "#6366F1",
  debt: "#3B82F6",
  gold: "#F59E0B",
  realestate: "#A855F7",
  crypto: "#F43F5E",
};

const SUBTYPES: Record<AssetCategory, string[]> = {
  cash: ["Fixed Deposit", "Recurring Deposit", "Liquid Fund", "Treasury Bill", "Other"],
  investment: [], // handled by InvestmentEditModal's grouped picker
  equity: [],
  debt: [],
  gold: ["Physical Gold", "Gold ETF", "Sovereign Gold Bond", "Digital Gold", "Other"],
  realestate: ["Primary Home", "Investment Property", "Land", "Commercial", "Other"],
  crypto: ["Bitcoin", "Ethereum", "Altcoin", "Stablecoin", "Other"],
};

export function NetWorthView() {
  const { state, setState, fx } = useFinance();
  const { user } = useAuth();
  const base = state.baseCurrency || "INR";

  const [openAdd, setOpenAdd] = React.useState<{ kind: "asset" | "liability"; category: string } | null>(null);
  const [editInvestment, setEditInvestment] = React.useState<AssetItem | null>(null);
  const [addInvestment, setAddInvestment] = React.useState(false);
  const [scheduleFor, setScheduleFor] = React.useState<LiabilityItem | null>(null);
  const [refreshingPrices, setRefreshingPrices] = React.useState(false);
  const [hideValues, setHideValues] = React.useState(false);
  const [displayCcy, setDisplayCcy] = React.useState<string>(base);
  const [celebrate, setCelebrate] = React.useState<MilestoneAchieved | null>(null);
  const [brokerOpen, setBrokerOpen] = React.useState(false);
  const refreshPricesFn = useServerFn(refreshInvestmentPrices);

  // Per-currency breakdown (native amounts, no FX conversion)
  const byCurrency = React.useMemo(() => {
    const m = new Map<string, { assets: number; liabs: number }>();
    const bump = (ccy: string, kind: "assets" | "liabs", amt: number) => {
      if (!amt) return;
      const cur = m.get(ccy) || { assets: 0, liabs: 0 };
      cur[kind] += amt;
      m.set(ccy, cur);
    };
    state.assets.forEach((a) => bump(a.currency || base, "assets", a.value || 0));
    state.accounts.forEach((a) => {
      const bal = accountBalance(state, a.id);
      if (a.type === "credit") bump(a.currency || base, "liabs", bal);
      else bump(a.currency || base, "assets", bal);
    });
    state.liabilities.forEach((l) => bump(l.currency || base, "liabs", l.principal || 0));
    return Array.from(m.entries())
      .map(([ccy, v]) => ({ ccy, ...v, net: v.assets - v.liabs }))
      .sort((a, b) => b.assets - a.assets);
  }, [state, base]);

  // Currencies the user actually uses (for the display toggle)
  const userCurrencies = React.useMemo(() => {
    const set = new Set<string>([base, ...byCurrency.map((r) => r.ccy)]);
    return Array.from(set);
  }, [base, byCurrency]);

  // Totals converted into the chosen display currency
  const totalAssets = sumAssets(state, fx, displayCcy);
  const totalLiabs = sumLiabilities(state, fx, displayCcy);
  const netWorth = totalAssets - totalLiabs;
  const byCat = assetsByCategory(state, fx, base);

  const achieved = state.milestonesAchieved ?? [];

  const takeSnapshot = () => {
    const snap: NetWorthSnapshot = {
      id: uid(),
      date: new Date().toISOString(),
      assets: totalAssets,
      liabilities: totalLiabs,
      netWorth,
      assetBreakdown: byCat,
    };
    // Detect newly crossed milestones (in INR baseline regardless of display ccy)
    const nwInBase = sumAssets(state, fx, base) - sumLiabilities(state, fx, base);
    const newOnes = detectNewMilestones(nwInBase, achieved);
    const additions: MilestoneAchieved[] = newOnes.map((m) => ({
      amount: m.amount,
      label: m.label,
      emoji: m.emoji,
      date: snap.date,
      netWorth: nwInBase,
    }));
    setState((s) => ({
      ...s,
      snapshots: [...s.snapshots, snap],
      milestonesAchieved: [...(s.milestonesAchieved ?? []), ...additions],
    }));
    toast.success("Snapshot saved");
    // Celebrate the highest new milestone
    if (additions.length > 0) {
      setCelebrate(additions[additions.length - 1]);
    }
  };

  const ownerName =
    (user?.user_metadata?.name as string | undefined) ||
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email || "Account holder";

  const exportReport = () => {
    try {
      generateNetWorthReport(state, fx, ownerName);
      toast.success("Report downloaded");
    } catch (e) {
      toast.error((e as Error).message || "Report failed");
    }
  };

  const refreshPrices = async () => {
    const holdings = state.assets
      .filter((a) => (a.category === "equity" || a.category === "crypto" || a.category === "investment") && a.ticker && (a.units ?? 0) > 0)
      .map((a) => ({
        id: a.id,
        ticker: a.ticker as string,
        name: a.name,
        kind: a.category === "crypto" ? ("crypto" as const) : (a.subtype === "Equity MF" || a.subtype === "Equity Mutual Fund" || a.subtype === "ELSS" || a.subtype === "Debt MF" || a.subtype === "Hybrid MF") ? ("mutualfund" as const) : ("stock" as const),
        currency: a.currency || base,
      }));
    if (holdings.length === 0) {
      toast.info("Edit an equity, mutual fund or crypto asset and set its Ticker (e.g. AAPL, RELIANCE.NS, BTC) and Units held to enable live price refresh.");
      return;
    }
    setRefreshingPrices(true);
    try {
      const { results, error } = await refreshPricesFn({ data: { holdings } });
      if (error) { toast.error(error); return; }
      let updated = 0;
      setState((s) => {
        const map = new Map(results.map((r) => [r.id, r]));
        const next = s.assets.map((a) => {
          const r = map.get(a.id);
          if (!r || r.price == null || !a.units) return a;
          updated += 1;
          return { ...a, avgPrice: a.avgPrice ?? r.price, value: Math.round((a.units * r.price) * 100) / 100 };
        });
        return { ...s, assets: next };
      });
      toast.success(updated > 0 ? `Updated ${updated} holding${updated > 1 ? "s" : ""}` : "No prices returned by the AI");
    } catch (e) {
      toast.error((e as Error).message || "Price refresh failed");
    } finally {
      setRefreshingPrices(false);
    }
  };

  return (
    <div className={`space-y-6 ${hideValues ? "[&_.tabular]:blur-md [&_.tabular]:select-none" : ""}`}>
      <GlassCard className="relative overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Total Assets</div>
            <div className="font-display text-3xl tabular mt-1">{formatMoney(totalAssets, displayCcy)}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Total Liabilities</div>
            <div className="font-display text-3xl tabular mt-1" style={{ color: "var(--color-danger)" }}>
              {formatMoney(totalLiabs, displayCcy)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Net Worth</div>
            <div className="font-display text-4xl md:text-5xl tabular mt-1"
              style={{ color: netWorth >= 0 ? "var(--color-positive)" : "var(--color-danger)" }}>
              {formatMoney(netWorth, displayCcy)}
            </div>
            {netWorth < 0 && totalAssets === 0 && (
              <div className="mt-2 text-xs italic text-amber-400/90">
                Your liabilities exceed your assets. Add your assets in Net Worth to see the full picture.
              </div>
            )}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          {userCurrencies.length > 1 && (
            <div className="inline-flex rounded-lg border border-border bg-white/[0.02] p-0.5">
              {userCurrencies.map((c) => (
                <button
                  key={c}
                  onClick={() => setDisplayCcy(c)}
                  className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                    displayCcy === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}>
                  {c}
                </button>
              ))}
            </div>
          )}
          <Button
            onClick={() => setHideValues((v) => !v)}
            variant="outline"
            className="gap-2"
            title={hideValues ? "Show values" : "Hide values"}>
            {hideValues ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            <span className="hidden sm:inline">{hideValues ? "Show" : "Hide"} values</span>
          </Button>
          <Button onClick={refreshPrices} disabled={refreshingPrices} variant="outline" className="gap-2">
            <RefreshCw className={`h-4 w-4 ${refreshingPrices ? "animate-spin" : ""}`} />
            {refreshingPrices ? "Refreshing…" : "Refresh Market Prices"}
          </Button>
          <Button onClick={() => setBrokerOpen(true)} variant="outline" className="gap-2">
            <Download className="h-4 w-4" /> Import from Broker
          </Button>
          <Button onClick={exportReport} variant="outline" className="gap-2">
            <FileDown className="h-4 w-4" /> Report
          </Button>
          <Button onClick={takeSnapshot} className="gap-2">
            <Camera className="h-4 w-4" /> Take Snapshot
          </Button>
        </div>
      </GlassCard>

      <MilestonesRow achieved={achieved} netWorth={netWorth} />

      <CurrencyRatesCard />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <GlassCard>
          <SectionTitle title="Asset Ledger" subtitle="Group your holdings by class" />
          <Accordion type="multiple" className="space-y-1">
            {ASSET_CATS.map((cat) => {
              const manualItems = state.assets.filter((a) => a.category === cat);
              const accountItems =
                cat === "cash"
                  ? state.accounts.filter((a) => a.type !== "credit" && a.type !== "fd").map((a) => ({
                      isAccount: true as const,
                      id: a.id,
                      name: `${a.name}${a.last4 ? ` ····${a.last4}` : ""}`,
                      value: accountBalance(state, a.id),
                      currency: a.currency,
                      hint: "From Cash Flow → Accounts",
                    }))
                  : cat === "investment"
                  ? state.accounts.filter((a) => a.type === "fd").map((a) => ({
                      isAccount: true as const,
                      id: a.id,
                      name: `${a.name}${a.last4 ? ` ····${a.last4}` : ""}`,
                      value: accountBalance(state, a.id),
                      currency: a.currency,
                      hint: `Fixed Deposit · Cash Flow${a.maturityDate ? ` · Matures ${a.maturityDate}` : ""}${a.interestRate ? ` · ${a.interestRate}% p.a.` : ""}`,
                    }))
                  : [];
              const total =
                manualItems.reduce((s, a) => s + convert(a.value, a.currency || base, base, fx), 0) +
                accountItems.reduce((s, a) => s + convert(a.value, a.currency, base, fx), 0);

              // For investments, group manual items by subtypeGroup for nicer display.
              const groupedInvestments = cat === "investment"
                ? (["Stocks & Equity", "Fixed Income", "Hybrid & Other"] as const).map((g) => ({
                    group: g,
                    items: manualItems.filter((a) => subtypeGroup(a.subtype) === g),
                  })).filter((g) => g.items.length > 0)
                : null;

              return (
                <AccordionItem key={cat} value={cat}
                  className="border border-white/5 rounded-xl px-3 bg-white/[0.02]">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex flex-1 items-center justify-between pr-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CAT_COLORS[cat] }} />
                        <span className="text-sm">{ASSET_LABELS[cat]}</span>
                      </div>
                      <div className="tabular text-sm">{formatMoney(total, base)}</div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-2">
                    {accountItems.map((a) => (
                      <div key={a.id}
                        className="flex items-center justify-between text-sm rounded-lg bg-white/[0.02] border border-white/5 px-3 py-2">
                        <div>
                          <div>{a.name}</div>
                          <div className="text-[11px] text-muted-foreground">{a.hint}</div>
                        </div>
                        <div className="tabular text-sm">
                          {formatMoney(a.value, a.currency)}
                          {a.currency !== base && (
                            <span className="text-[11px] text-muted-foreground ml-1">
                              · {formatMoney(convert(a.value, a.currency, base, fx), base)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    {manualItems.length === 0 && accountItems.length === 0 && (
                      <p className="text-xs text-muted-foreground py-1">No entries yet.</p>
                    )}

                    {/* Investments: grouped by subtype group, tap to edit */}
                    {cat === "investment" && groupedInvestments?.map(({ group, items }) => (
                      <div key={group} className="space-y-1.5">
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground pt-1">{group}</div>
                        {items.map((item) => (
                          <InvestmentRow key={item.id} item={item} base={base} fx={fx} onEdit={() => setEditInvestment(item)} />
                        ))}
                      </div>
                    ))}

                    {/* Non-investment categories: existing row layout */}
                    {cat !== "investment" && manualItems.map((item) => {
                      const invested = item.invested || 0;
                      const gain = invested > 0 ? item.value - invested : 0;
                      const gainPct = invested > 0 ? (gain / invested) * 100 : 0;
                      const gainColor = gain >= 0 ? "var(--color-positive)" : "var(--color-danger)";
                      return (
                      <div key={item.id}
                        className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.02] border border-white/5 px-3 py-2">
                        <div className="min-w-0">
                          <div className="text-sm truncate">{item.name || "(unnamed)"}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {item.subtype || ASSET_LABELS[cat]}
                            {invested ? ` · Invested ${formatMoney(invested, item.currency || base)}` : ""}
                            {item.units ? ` · ${item.units} units` : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="tabular text-sm text-right">
                            {formatMoney(item.value, item.currency || base)}
                            {invested > 0 && (
                              <div className="text-[11px] flex items-center justify-end gap-1" style={{ color: gainColor }}>
                                {gain >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                {gain >= 0 ? "+" : ""}{formatMoney(gain, item.currency || base)} ({gainPct.toFixed(1)}%)
                              </div>
                            )}
                            {(item.currency || base) !== base && (
                              <div className="text-[11px] text-muted-foreground">
                                · {formatMoney(convert(item.value, item.currency || base, base, fx), base)}
                              </div>
                            )}
                          </div>
                          <button className="text-muted-foreground hover:text-rose-400"
                            onClick={() => {
                              if (!confirm("Delete this asset?")) return;
                              setState((s) => ({ ...s, assets: s.assets.filter((a) => a.id !== item.id) }));
                              toast.success("Deleted");
                            }}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );})}

                    {cat === "investment" ? (
                      <Button variant="ghost" size="sm" className="gap-1"
                        onClick={() => setAddInvestment(true)}>
                        <Plus className="h-3.5 w-3.5" /> Add Investment
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" className="gap-1"
                        onClick={() => setOpenAdd({ kind: "asset", category: cat })}>
                        <Plus className="h-3.5 w-3.5" /> Add asset
                      </Button>
                    )}
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
              const manualItems = state.liabilities.filter((l) => l.category === cat);
              const cardItems = cat === "credit"
                ? state.accounts.filter((a) => a.type === "credit").map((a) => ({
                    isAccount: true as const,
                    id: a.id,
                    name: `${a.name}${a.last4 ? ` ····${a.last4}` : ""}`,
                    outstanding: accountBalance(state, a.id),
                    limit: a.creditLimit || 0,
                    currency: a.currency,
                  }))
                : [];
              const total =
                manualItems.reduce((s, l) => s + convert(l.principal || 0, l.currency || base, base, fx), 0) +
                cardItems.reduce((s, c) => s + convert(c.outstanding, c.currency, base, fx), 0);
              return (
                <AccordionItem key={cat} value={cat}
                  className="border border-white/5 rounded-xl px-3 bg-white/[0.02]">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex flex-1 items-center justify-between pr-3">
                      <span className="text-sm">{LIABILITY_LABELS[cat]}</span>
                      <div className="tabular text-sm" style={{ color: "var(--color-danger)" }}>
                        {formatMoney(total, base)}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    {cardItems.map((c) => {
                      const util = c.limit > 0 ? clamp((c.outstanding / c.limit) * 100) : 0;
                      return (
                        <div key={c.id} className="rounded-lg bg-white/[0.02] border border-white/5 p-3 space-y-2">
                          <div className="flex justify-between text-sm">
                            <div>
                              <div>{c.name}</div>
                              <div className="text-[11px] text-muted-foreground">From Cash Flow → Accounts</div>
                            </div>
                            <div className="tabular">{formatMoney(c.outstanding, c.currency)}</div>
                          </div>
                          {c.limit > 0 && (
                            <div className="space-y-1">
                              <div className="text-[11px] text-muted-foreground flex justify-between">
                                <span>Utilisation</span>
                                <span>{util.toFixed(0)}% of {formatMoney(c.limit, c.currency)}</span>
                              </div>
                              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                                <div className="h-full rounded-full transition-all"
                                  style={{ width: `${util}%`, backgroundColor: util > 70 ? "var(--color-danger)" : "var(--color-warning)" }} />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {manualItems.length === 0 && cardItems.length === 0 && (
                      <p className="text-xs text-muted-foreground py-1">No loans logged here.</p>
                    )}
                    {manualItems.map((item) => (
                      <div key={item.id} className="rounded-lg bg-white/[0.02] border border-white/5 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm">{item.name || "(unnamed)"}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {item.rate}% · EMI {formatMoney(item.emi, item.currency || base)}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="tabular text-sm" style={{ color: "var(--color-danger)" }}>
                              {formatMoney(item.principal, item.currency || base)}
                            </div>
                            <button
                              className="text-muted-foreground hover:text-foreground"
                              title="View EMI schedule"
                              onClick={() => setScheduleFor(item)}>
                              <Calendar className="h-4 w-4" />
                            </button>
                            <button className="text-muted-foreground hover:text-rose-400"
                              onClick={() => {
                                if (!confirm("Delete this liability?")) return;
                                setState((s) => ({ ...s, liabilities: s.liabilities.filter((l) => l.id !== item.id) }));
                                toast.success("Deleted");
                              }}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {cat !== "credit" && (
                      <Button variant="ghost" size="sm" className="gap-1"
                        onClick={() => setOpenAdd({ kind: "liability", category: cat })}>
                        <Plus className="h-3.5 w-3.5" /> Add loan
                      </Button>
                    )}
                    {cat === "credit" && (
                      <p className="text-[11px] text-muted-foreground">
                        Credit card outstandings come from accounts in Cash Flow → Accounts.
                      </p>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </GlassCard>
      </div>

      <AllocationEngine />
      <SnapshotHistory />

      {openAdd?.kind === "asset" && (
        <AddAssetDialog
          category={openAdd.category as AssetCategory}
          onClose={() => setOpenAdd(null)}
        />
      )}
      {openAdd?.kind === "liability" && (
        <AddLiabilityDialog
          category={openAdd.category as LiabilityCategory}
          onClose={() => setOpenAdd(null)}
        />
      )}
      {scheduleFor && (
        <LoanScheduleDialog liability={scheduleFor} onClose={() => setScheduleFor(null)} />
      )}
      <BrokerImportDialog open={brokerOpen} onClose={() => setBrokerOpen(false)} />
      <MilestoneCelebration milestone={celebrate} onClose={() => setCelebrate(null)} />
      {(editInvestment || addInvestment) && (
        <InvestmentEditModal
          existing={editInvestment}
          onClose={() => { setEditInvestment(null); setAddInvestment(false); }}
        />
      )}
    </div>
  );
}

function InvestmentRow({ item, base, fx, onEdit }: {
  item: AssetItem;
  base: string;
  fx: ReturnType<typeof useFinance>["fx"];
  onEdit: () => void;
}) {
  const invested = item.invested || 0;
  const gain = invested > 0 ? item.value - invested : 0;
  const gainPct = invested > 0 ? (gain / invested) * 100 : 0;
  const gainColor = gain >= 0 ? "var(--color-positive)" : "var(--color-danger)";
  const sipBadge = item.sipEnabled && item.sipStatus === "active"
    ? <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/15 text-primary ml-1">SIP</span>
    : null;
  return (
    <button
      onClick={onEdit}
      className="w-full text-left flex items-center justify-between gap-2 rounded-lg bg-white/[0.02] border border-white/5 px-3 py-2 hover:bg-white/[0.04] transition-colors">
      <div className="min-w-0">
        <div className="text-sm truncate">{item.name || "(unnamed)"} {sipBadge}</div>
        <div className="text-[11px] text-muted-foreground">
          {item.subtype || "Investment"}
          {invested ? ` · Invested ${formatMoney(invested, item.currency || base)}` : ""}
          {item.units ? ` · ${item.units} u` : ""}
        </div>
      </div>
      <div className="tabular text-sm text-right shrink-0">
        {formatMoney(item.value, item.currency || base)}
        {invested > 0 && (
          <div className="text-[11px] flex items-center justify-end gap-1" style={{ color: gainColor }}>
            {gain >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {gain >= 0 ? "+" : ""}{formatMoney(gain, item.currency || base)} ({gainPct.toFixed(1)}%)
          </div>
        )}
        {(item.currency || base) !== base && (
          <div className="text-[11px] text-muted-foreground">
            · {formatMoney(convert(item.value, item.currency || base, base, fx), base)}
          </div>
        )}
      </div>
    </button>
  );
}

function LoanScheduleDialog({ liability, onClose }: { liability: LiabilityItem; onClose: () => void }) {
  const { state, setState } = useFinance();
  const base = state.baseCurrency || "INR";
  const ccy = liability.currency || base;
  const [extra, setExtra] = React.useState<number>(0);
  const [investRate, setInvestRate] = React.useState<number>(10);

  const baseResult = React.useMemo(
    () => amortize(liability.principal, liability.rate, liability.emi),
    [liability.principal, liability.rate, liability.emi],
  );
  const fastResult = React.useMemo(
    () => amortize(liability.principal, liability.rate, liability.emi + Math.max(0, extra)),
    [liability.principal, liability.rate, liability.emi, extra],
  );

  const monthsSaved = isFinite(baseResult.months) && isFinite(fastResult.months)
    ? Math.max(0, baseResult.months - fastResult.months) : 0;
  const interestSaved = isFinite(baseResult.totalInterest) && isFinite(fastResult.totalInterest)
    ? Math.max(0, baseResult.totalInterest - fastResult.totalInterest) : 0;

  // Prepay-vs-invest comparison.
  // If we direct `extra` every month either to (a) prepayment or (b) invest at investRate
  // for `months` (base loan duration), compare outcomes.
  const monthlyInv = (investRate / 100) / 12;
  const horizonMonths = isFinite(baseResult.months) ? baseResult.months : 0;
  // Future value of monthly contribution `extra` for horizonMonths
  const investFV = monthlyInv === 0
    ? extra * horizonMonths
    : extra * ((Math.pow(1 + monthlyInv, horizonMonths) - 1) / monthlyInv);
  // Prepay benefit ≈ interest saved + (extra contributions stopped after early payoff,
  // then invested at investRate until horizonMonths)
  const idleMonths = Math.max(0, horizonMonths - (isFinite(fastResult.months) ? fastResult.months : 0));
  const idleFV = monthlyInv === 0
    ? (liability.emi + extra) * idleMonths
    : (liability.emi + extra) * ((Math.pow(1 + monthlyInv, idleMonths) - 1) / monthlyInv);
  const prepayNet = interestSaved + idleFV;

  const recordPayment = () => {
    const amt = Number(prompt("Payment amount", String(liability.emi)));
    if (!amt || amt <= 0) return;
    const today = new Date().toISOString().slice(0, 10);
    setState((s) => {
      const interest = liability.principal * (liability.rate / 100) / 12;
      const principalPaid = Math.max(0, amt - interest);
      const newPrincipal = Math.max(0, liability.principal - principalPaid);
      const tx = {
        id: uid(),
        date: today,
        type: "expense" as const,
        category: "EMI & Loans",
        description: `EMI: ${liability.name}`,
        amount: amt,
        currency: ccy,
      };
      return {
        ...s,
        liabilities: s.liabilities.map((l) => (l.id === liability.id ? { ...l, principal: newPrincipal } : l)),
        transactions: [tx, ...s.transactions],
      };
    });
    toast.success("Payment recorded");
    onClose();
  };

  const monthsLabel = (m: number) =>
    m === Infinity ? "Never amortizes"
    : m === 0 ? "Paid off"
    : `${m} mo (${Math.floor(m / 12)}y ${m % 12}m)`;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{liability.name} · Payoff Planner</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-3 text-sm">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Outstanding</div>
            <div className="tabular font-display text-lg">{formatMoney(liability.principal, ccy)}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Months left</div>
            <div className="font-display text-lg">{monthsLabel(baseResult.months)}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total Interest</div>
            <div className="tabular font-display text-lg" style={{ color: "var(--color-danger)" }}>
              {isFinite(baseResult.totalInterest) ? formatMoney(baseResult.totalInterest, ccy) : "—"}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Payoff Date</div>
            <div className="font-display text-lg">{baseResult.payoffDate ?? "—"}</div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-background/40 p-3 space-y-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Extra payment planner</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-xs text-muted-foreground">
              Extra per month ({ccy})
              <input
                type="number" min={0}
                value={extra || ""}
                onChange={(e) => setExtra(Math.max(0, Number(e.target.value) || 0))}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground tabular"
              />
            </label>
            <label className="text-xs text-muted-foreground">
              Investment return for comparison (% / yr)
              <input
                type="number" min={0} step="0.1"
                value={investRate}
                onChange={(e) => setInvestRate(Math.max(0, Number(e.target.value) || 0))}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground tabular"
              />
            </label>
          </div>
          {extra > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm pt-1">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">New duration</div>
                <div className="font-display text-base">{monthsLabel(fastResult.months)}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Months saved</div>
                <div className="font-display text-base text-positive tabular">{monthsSaved}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Interest saved</div>
                <div className="font-display text-base text-positive tabular">{formatMoney(interestSaved, ccy)}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">New payoff</div>
                <div className="font-display text-base">{fastResult.payoffDate ?? "—"}</div>
              </div>
            </div>
          )}
          {extra > 0 && horizonMonths > 0 && (
            <div className="rounded-lg border border-border bg-card/60 p-3 mt-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Prepay vs Invest — over {Math.floor(horizonMonths / 12)}y {horizonMonths % 12}m
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-[11px] text-muted-foreground">Prepay path net benefit</div>
                  <div className="font-display text-lg tabular" style={{ color: "var(--color-positive)" }}>
                    {formatMoney(prepayNet, ccy)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">Invest path final value</div>
                  <div className="font-display text-lg tabular">{formatMoney(investFV, ccy)}</div>
                </div>
              </div>
              <div className="text-[11px] text-muted-foreground mt-2">
                {prepayNet > investFV
                  ? `Prepaying wins by ${formatMoney(prepayNet - investFV, ccy)}.`
                  : `Investing wins by ${formatMoney(investFV - prepayNet, ccy)}.`}
                {" "}Estimates assume the same monthly cash flow either way.
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 py-3">
          <Button size="sm" onClick={recordPayment}>Record EMI Payment</Button>
        </div>
        <div className="overflow-auto border border-white/5 rounded-lg">
          <table className="w-full text-xs tabular">
            <thead className="sticky top-0 bg-background">
              <tr className="text-left text-muted-foreground">
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2 text-right">EMI</th>
                <th className="px-3 py-2 text-right">Principal</th>
                <th className="px-3 py-2 text-right">Interest</th>
                <th className="px-3 py-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {(extra > 0 ? fastResult : baseResult).schedule.map((row) => (
                <tr key={row.month} className="border-t border-white/5">
                  <td className="px-3 py-1.5">{row.month}</td>
                  <td className="px-3 py-1.5">{row.date}</td>
                  <td className="px-3 py-1.5 text-right">{formatMoney(row.emi, ccy)}</td>
                  <td className="px-3 py-1.5 text-right">{formatMoney(row.principal, ccy)}</td>
                  <td className="px-3 py-1.5 text-right" style={{ color: "var(--color-danger)" }}>{formatMoney(row.interest, ccy)}</td>
                  <td className="px-3 py-1.5 text-right">{formatMoney(row.balance, ccy)}</td>
                </tr>
              ))}
              {baseResult.schedule.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-4 text-center text-muted-foreground">No schedule to display.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddAssetDialog({ category, onClose }: { category: AssetCategory; onClose: () => void }) {
  const { state, setState } = useFinance();
  const base = state.baseCurrency || "INR";
  const subs = SUBTYPES[category];
  const [subtype, setSubtype] = React.useState(subs[0]);
  const [form, setForm] = React.useState<AssetItem>({
    ...newAsset(category),
    subtype: subs[0],
    currency: base,
  });

  const isStock = category === "equity" && subtype === "Direct Stock";
  const isMF = category === "equity" && subtype === "Equity Mutual Fund";

  React.useEffect(() => {
    setForm((f) => ({ ...f, subtype }));
  }, [subtype]);

  // Auto invested for stocks/MF
  React.useEffect(() => {
    if ((isStock || isMF) && form.units && form.avgPrice) {
      setForm((f) => ({ ...f, invested: (f.units || 0) * (f.avgPrice || 0) }));
    }
  }, [form.units, form.avgPrice, isStock, isMF]);

  const save = () => {
    if (!form.name || !form.value) {
      toast.error("Name and current value are required");
      return;
    }
    setState((s) => ({ ...s, assets: [...s.assets, { ...form, id: uid() }] }));
    toast.success("Asset added");
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            Add {ASSET_LABELS[category]}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div>
            <FieldLabel>Subtype</FieldLabel>
            <Select value={subtype} onValueChange={setSubtype}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {subs.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {(isStock || isMF) && (
            <>
              <div>
                <FieldLabel>{isStock ? "Search stock ticker" : "Search fund name"} <span className="text-[10px] text-muted-foreground ml-1">BETA</span></FieldLabel>
                <input className="underline-input" placeholder={isStock ? "e.g. RELIANCE" : "e.g. Parag Parikh Flexi Cap"}
                  value={form.ticker || ""} onChange={(e) => setForm({ ...form, ticker: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>{isStock ? "No. of Shares" : "Units Held"}</FieldLabel>
                  <NumberInput value={form.units || 0} onChange={(n) => setForm({ ...form, units: n })} />
                </div>
                <div>
                  <FieldLabel>{isStock ? "Avg. Purchase Price" : "Avg. NAV"}</FieldLabel>
                  <MoneyInput value={form.avgPrice || 0} onChange={(n) => setForm({ ...form, avgPrice: n })} />
                </div>
              </div>
            </>
          )}

          <div>
            <FieldLabel>Name *</FieldLabel>
            <input className="underline-input" placeholder="e.g. Reliance Industries"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Current Value *</FieldLabel>
              <MoneyInput value={form.value} onChange={(n) => setForm({ ...form, value: n })} />
            </div>
            <div>
              <FieldLabel>Currency *</FieldLabel>
              <CurrencySelect value={form.currency || base} onChange={(c) => setForm({ ...form, currency: c })} />
            </div>
          </div>
          <div>
            <FieldLabel>Total Invested {isStock || isMF ? "(auto)" : ""}</FieldLabel>
            <MoneyInput value={form.invested || 0} onChange={(n) => setForm({ ...form, invested: n })} />
          </div>
          <div>
            <FieldLabel>Notes</FieldLabel>
            <input className="underline-input" placeholder="Optional"
              value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>

          <Button className="w-full" onClick={save} disabled={!form.name || !form.value}>
            Save Asset
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddLiabilityDialog({ category, onClose }: { category: LiabilityCategory; onClose: () => void }) {
  const { state, setState } = useFinance();
  const base = state.baseCurrency || "INR";
  const [form, setForm] = React.useState<LiabilityItem>({
    ...newLiability(category),
    currency: base,
  });

  const save = () => {
    if (!form.name || !form.principal || !form.rate) {
      toast.error("Name, outstanding, and rate are required");
      return;
    }
    setState((s) => ({ ...s, liabilities: [...s.liabilities, { ...form, id: uid() }] }));
    toast.success("Liability added");
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            Add {LIABILITY_LABELS[category]}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div>
            <FieldLabel>Name *</FieldLabel>
            <input className="underline-input" placeholder="e.g. HDFC Home Loan"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Outstanding *</FieldLabel>
              <MoneyInput value={form.principal} onChange={(n) => setForm({ ...form, principal: n })} />
            </div>
            <div>
              <FieldLabel>Currency *</FieldLabel>
              <CurrencySelect value={form.currency || base} onChange={(c) => setForm({ ...form, currency: c })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Interest Rate % *</FieldLabel>
              <NumberInput value={form.rate} onChange={(n) => setForm({ ...form, rate: n })} />
            </div>
            <div>
              <FieldLabel>Monthly EMI</FieldLabel>
              <MoneyInput value={form.emi} onChange={(n) => setForm({ ...form, emi: n })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Start Date</FieldLabel>
              <input type="date" className="underline-input"
                value={form.startDate || ""} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <FieldLabel>Due Date</FieldLabel>
              <input type="date" className="underline-input"
                value={form.dueDate || ""} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
          </div>
          <div>
            <FieldLabel>Original Principal</FieldLabel>
            <MoneyInput value={form.originalPrincipal || 0} onChange={(n) => setForm({ ...form, originalPrincipal: n })} />
          </div>
          <div>
            <FieldLabel>Notes</FieldLabel>
            <input className="underline-input" value={form.notes || ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <Button className="w-full" onClick={save}
            disabled={!form.name || !form.principal || !form.rate}>
            Save Liability
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AllocationEngine() {
  const { state, setState, fx } = useFinance();
  const base = state.baseCurrency || "INR";
  const byCat = assetsByCategory(state, fx, base);
  const total = sumAssets(state, fx, base);
  const targetSum = ASSET_CATS.reduce((s, c) => s + (state.targetAllocation[c] || 0), 0);

  const targetData = ASSET_CATS.map((c) => ({
    name: ASSET_LABELS[c], value: state.targetAllocation[c] || 0, fill: CAT_COLORS[c],
  }));
  const actualData = ASSET_CATS.map((c) => ({
    name: ASSET_LABELS[c], value: total > 0 ? (byCat[c] / total) * 100 : 0, fill: CAT_COLORS[c],
  }));

  return (
    <GlassCard>
      <SectionTitle title="Target vs Actual Allocation"
        subtitle="Set your target mix and rebalance when reality drifts"
        right={
          <div className="text-xs tabular px-2 py-1 rounded-md border"
            style={{
              color: targetSum === 100 ? "var(--color-positive)" : "var(--color-danger)",
              borderColor: targetSum === 100 ? "rgba(16,185,129,0.3)" : "rgba(244,63,94,0.3)",
            }}>
            Targets sum: {targetSum}%
          </div>
        } />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          {ASSET_CATS.map((c) => (
            <div key={c} className="grid grid-cols-12 items-center gap-3">
              <div className="col-span-5 flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CAT_COLORS[c] }} />
                {ASSET_LABELS[c]}
              </div>
              <div className="col-span-4">
                <NumberInput value={state.targetAllocation[c]}
                  onChange={(n) => setState((s) => ({ ...s, targetAllocation: { ...s.targetAllocation, [c]: n } }))}
                  placeholder="Target %" />
              </div>
              <div className="col-span-3 text-right text-xs text-muted-foreground tabular">
                actual {pct(actualData.find((d) => d.name === ASSET_LABELS[c])!.value, 1)}
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Target", data: targetData },
            { label: "Actual", data: actualData },
          ].map((g) => (
            <div key={g.label}>
              <div className="text-xs text-muted-foreground text-center mb-1">{g.label}</div>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={g.data} innerRadius={42} outerRadius={70} paddingAngle={2} dataKey="value">
                    {g.data.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Pie>
                  <RTooltip contentStyle={{ background: "#0A0F1E", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                    formatter={(v: number) => `${v.toFixed(1)}%`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}

function SnapshotHistory() {
  const { state } = useFinance();
  const base = state.baseCurrency || "INR";
  const data = state.snapshots.slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((s) => ({
      date: new Date(s.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      networth: s.netWorth,
    }));

  return (
    <GlassCard>
      <SectionTitle title="Net Worth History" subtitle="Track your trajectory over time" />
      {state.snapshots.length < 2 ? (
        <EmptyState icon={LineChartIcon} title="No history yet"
          description="Take your first snapshot to begin tracking." />
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data}>
            <XAxis dataKey="date" tick={{ fill: "#6B7280", fontSize: 11 }} stroke="#1F2937" />
            <YAxis tick={{ fill: "#6B7280", fontSize: 11 }} stroke="#1F2937"
              tickFormatter={(v) => v >= 100000 ? `${(v / 100000).toFixed(1)}L` : `${v / 1000}k`} />
            <RTooltip contentStyle={{ background: "#0A0F1E", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
              formatter={(v: number) => formatMoney(v, base)} />
            <Line type="monotone" dataKey="networth" stroke="#10B981" strokeWidth={2.5}
              dot={{ fill: "#10B981", r: 3 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </GlassCard>
  );
}
