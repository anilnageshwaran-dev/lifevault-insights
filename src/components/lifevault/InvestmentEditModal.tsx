import * as React from "react";
import { toast } from "sonner";
import {
  useFinance,
  ALL_INVESTMENT_SUBTYPES,
  INVESTMENT_SUBTYPE_GROUPS,
  SIP_ELIGIBLE_SUBTYPES,
  subtypeGroup,
  type AssetItem,
  type InvestmentPurchase,
} from "@/lib/finance-context";
import { formatMoney } from "@/lib/currency";
import { uid } from "@/lib/finance-utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { FieldLabel, MoneyInput, NumberInput } from "./primitives";
import { CurrencySelect } from "./CurrencySelect";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { fdMaturityAmount, monthsElapsed, projectAnnualContribution, equityScenarios } from "@/lib/sip-engine";

const FIXED_INCOME = new Set<string>(INVESTMENT_SUBTYPE_GROUPS["Fixed Income"]);
const STOCKS_LIKE = new Set<string>(["Direct Stock", "Equity MF", "ELSS", "ETF", "Index Fund", "Debt MF", "Hybrid MF", "Balanced Fund", "ESOP", "Unlisted Equity"]);
const GOVT_SCHEMES = new Set<string>(["PPF", "EPF", "NPS"]);
const FD_LIKE = new Set<string>(["FD", "RD", "Bond", "Corporate FD", "RBI Bond", "NSC", "KVP", "Sukanya Samriddhi", "SCSS", "Post Office TD", "G-Sec"]);

function defaultRateFor(subtype: string): number {
  if (subtype === "PPF") return 7.1;
  if (subtype === "EPF") return 8.15;
  if (subtype === "NPS") return 10;
  return 7;
}

interface Props {
  existing: AssetItem | null;
  defaultSubtype?: string;
  onClose: () => void;
}

export function InvestmentEditModal({ existing, defaultSubtype, onClose }: Props) {
  const { state, setState } = useFinance();
  const base = state.baseCurrency || "INR";
  const isNew = !existing;

  const [form, setForm] = React.useState<AssetItem>(() =>
    existing ?? {
      id: uid(),
      category: "investment",
      subtype: defaultSubtype || "Direct Stock",
      name: "",
      value: 0,
      invested: 0,
      currency: base,
      purchases: [],
    },
  );
  const [confirmDel, setConfirmDel] = React.useState(false);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [addMoreOpen, setAddMoreOpen] = React.useState(false);

  const sub = form.subtype || "Other";
  const isStockLike = STOCKS_LIKE.has(sub);
  const isFD = FD_LIKE.has(sub);
  const isGovt = GOVT_SCHEMES.has(sub);
  const canSip = SIP_ELIGIBLE_SUBTYPES.has(sub);
  const ccy = form.currency || base;

  // Auto-derive for stock-like
  React.useEffect(() => {
    if (!isStockLike) return;
    const units = form.units || 0;
    const avg = form.avgPrice || 0;
    const cur = form.currentPrice || 0;
    const invested = units * avg;
    const value = units * (cur || avg);
    setForm((f) => ({ ...f, invested, value }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.units, form.avgPrice, form.currentPrice, isStockLike]);

  // Auto-derive for FD-like
  React.useEffect(() => {
    if (!isFD) return;
    const p = form.principal || 0;
    const r = form.interestRate || 0;
    const t = form.tenureMonths || 0;
    if (!p || !t) return;
    const mat = fdMaturityAmount(p, r, t);
    // current value linear by elapsed months
    const elapsed = Math.min(t, monthsElapsed(form.startDate));
    const current = elapsed > 0 ? fdMaturityAmount(p, r, elapsed) : p;
    let matDate = "";
    if (form.startDate) {
      const [y, m, d] = form.startDate.split("-").map(Number);
      const dt = new Date(y, (m || 1) - 1 + t, d || 1);
      matDate = dt.toISOString().slice(0, 10);
    }
    setForm((f) => ({
      ...f,
      maturityAmount: Math.round(mat),
      maturityDate: matDate || f.maturityDate,
      value: Math.round(current),
      invested: p,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.principal, form.interestRate, form.tenureMonths, form.startDate, isFD]);

  // Auto for PPF/EPF/NPS
  React.useEffect(() => {
    if (!isGovt) return;
    setForm((f) => ({ ...f, value: f.currentBalance || 0 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.currentBalance, isGovt]);

  const save = () => {
    if (!form.name) { toast.error("Name is required"); return; }
    setState((s) => ({
      ...s,
      assets: isNew ? [...s.assets, form] : s.assets.map((a) => (a.id === form.id ? form : a)),
    }));
    toast.success(isNew ? "Investment added" : "Investment updated");
    onClose();
  };

  const doDelete = () => {
    setState((s) => ({ ...s, assets: s.assets.filter((a) => a.id !== form.id) }));
    toast.success("Investment deleted");
    onClose();
  };

  const addMore = (purchase: InvestmentPurchase) => {
    setForm((f) => {
      const purchases = [...(f.purchases ?? []), purchase];
      let next: AssetItem = { ...f, purchases };
      if (isStockLike && purchase.units && purchase.price) {
        const oldUnits = f.units || 0;
        const oldAvg = f.avgPrice || 0;
        const newUnits = purchase.units;
        const newPrice = purchase.price;
        const totalUnits = oldUnits + newUnits;
        const weighted = totalUnits > 0
          ? (oldUnits * oldAvg + newUnits * newPrice) / totalUnits
          : oldAvg;
        next = {
          ...next,
          units: totalUnits,
          avgPrice: weighted,
          invested: (f.invested || 0) + purchase.amount,
          value: totalUnits * (f.currentPrice || newPrice),
        };
      } else if (isFD || isGovt) {
        next = {
          ...next,
          invested: (f.invested || 0) + purchase.amount,
          value: (f.value || 0) + purchase.amount,
          currentBalance: isGovt ? (f.currentBalance || 0) + purchase.amount : f.currentBalance,
          principal: isFD ? (f.principal || 0) + purchase.amount : f.principal,
        };
      } else {
        next = {
          ...next,
          invested: (f.invested || 0) + purchase.amount,
          value: (f.value || 0) + purchase.amount,
        };
      }
      return next;
    });
    setAddMoreOpen(false);
    toast.success("Purchase added");
  };

  // Projection block
  const projection = React.useMemo(() => {
    if (isFD) {
      const elapsed = monthsElapsed(form.startDate);
      const remaining = Math.max(0, (form.tenureMonths || 0) - elapsed);
      const interest = (form.maturityAmount || 0) - (form.principal || 0);
      return {
        kind: "fd" as const,
        maturity: form.maturityAmount || 0,
        interest,
        remaining,
      };
    }
    if (isGovt) {
      const rate = form.expectedRate || defaultRateFor(sub);
      const years = 15;
      const proj = projectAnnualContribution(
        form.currentBalance || 0,
        form.annualContribution || 0,
        rate,
        years,
      );
      return {
        kind: "govt" as const,
        projected: proj,
        annualInterest: (form.currentBalance || 0) * (rate / 100),
        years,
      };
    }
    if (isStockLike) {
      return {
        kind: "equity" as const,
        scenarios: equityScenarios(form.value || 0, 10),
      };
    }
    return null;
  }, [isFD, isGovt, isStockLike, form, sub]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {isNew ? "Add Investment" : "Edit Investment"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <div>
            <FieldLabel>Type *</FieldLabel>
            <Select value={sub} onValueChange={(v) => setForm({ ...form, subtype: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                {(Object.entries(INVESTMENT_SUBTYPE_GROUPS) as [keyof typeof INVESTMENT_SUBTYPE_GROUPS, readonly string[]][]).map(([g, list]) => (
                  <React.Fragment key={g}>
                    <div className="px-2 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">{g}</div>
                    {list.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </React.Fragment>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <FieldLabel>Name *</FieldLabel>
            <input className="underline-input" placeholder={isStockLike ? "e.g. Reliance / Axis Bluechip Fund" : "Investment name"}
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Currency</FieldLabel>
              <CurrencySelect value={ccy} onChange={(c) => setForm({ ...form, currency: c })} />
            </div>
          </div>

          {/* --- Subtype-specific fields --- */}
          {isStockLike && (
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>{sub === "Direct Stock" ? "Shares" : "Units"}</FieldLabel>
                  <NumberInput value={form.units || 0} onChange={(n) => setForm({ ...form, units: n })} />
                </div>
                <div>
                  <FieldLabel>{sub === "Direct Stock" ? "Avg Purchase Price" : "Avg NAV"}</FieldLabel>
                  <MoneyInput value={form.avgPrice || 0} onChange={(n) => setForm({ ...form, avgPrice: n })} />
                </div>
                <div>
                  <FieldLabel>{sub === "Direct Stock" ? "Current Price" : "Current NAV"}</FieldLabel>
                  <MoneyInput value={form.currentPrice || 0} onChange={(n) => setForm({ ...form, currentPrice: n })} />
                </div>
                <div>
                  <FieldLabel>Ticker / ISIN</FieldLabel>
                  <input className="underline-input" value={form.ticker || ""} onChange={(e) => setForm({ ...form, ticker: e.target.value })} />
                </div>
              </div>
              <PnLRow invested={form.invested || 0} value={form.value || 0} ccy={ccy} />
            </div>
          )}

          {isFD && (
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Principal</FieldLabel>
                  <MoneyInput value={form.principal || 0} onChange={(n) => setForm({ ...form, principal: n })} />
                </div>
                <div>
                  <FieldLabel>Interest Rate (% p.a.)</FieldLabel>
                  <NumberInput value={form.interestRate || 0} onChange={(n) => setForm({ ...form, interestRate: n })} />
                </div>
                <div>
                  <FieldLabel>Start Date</FieldLabel>
                  <input type="date" className="underline-input" value={form.startDate || ""}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                </div>
                <div>
                  <FieldLabel>Tenure (months)</FieldLabel>
                  <NumberInput value={form.tenureMonths || 0} onChange={(n) => setForm({ ...form, tenureMonths: n })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                <div>Maturity Date: <span className="text-foreground tabular">{form.maturityDate || "—"}</span></div>
                <div>Maturity Amount: <span className="text-foreground tabular">{formatMoney(form.maturityAmount || 0, ccy)}</span></div>
              </div>
            </div>
          )}

          {isGovt && (
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Current Balance</FieldLabel>
                  <MoneyInput value={form.currentBalance || 0} onChange={(n) => setForm({ ...form, currentBalance: n })} />
                </div>
                <div>
                  <FieldLabel>Annual Contribution</FieldLabel>
                  <MoneyInput value={form.annualContribution || 0} onChange={(n) => setForm({ ...form, annualContribution: n })} />
                </div>
                <div>
                  <FieldLabel>Expected Rate %</FieldLabel>
                  <NumberInput value={form.expectedRate ?? defaultRateFor(sub)}
                    onChange={(n) => setForm({ ...form, expectedRate: n })} />
                </div>
              </div>
            </div>
          )}

          {!isStockLike && !isFD && !isGovt && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Current Value *</FieldLabel>
                <MoneyInput value={form.value || 0} onChange={(n) => setForm({ ...form, value: n })} />
              </div>
              <div>
                <FieldLabel>Total Invested</FieldLabel>
                <MoneyInput value={form.invested || 0} onChange={(n) => setForm({ ...form, invested: n })} />
              </div>
            </div>
          )}

          {/* --- Expected returns block --- */}
          {projection && (
            <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.04] p-3 space-y-2">
              <div className="text-[10px] uppercase tracking-widest text-emerald-300/80">Expected Returns</div>
              {projection.kind === "fd" && (
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-[11px] text-muted-foreground">Maturity</div>
                    <div className="tabular font-display">{formatMoney(projection.maturity, ccy)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground">Interest</div>
                    <div className="tabular font-display text-positive">{formatMoney(projection.interest, ccy)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground">Months left</div>
                    <div className="tabular font-display">{projection.remaining}</div>
                  </div>
                </div>
              )}
              {projection.kind === "govt" && (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-[11px] text-muted-foreground">Projected ({projection.years}y)</div>
                    <div className="tabular font-display">{formatMoney(projection.projected, ccy)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground">Annual interest</div>
                    <div className="tabular font-display text-positive">{formatMoney(projection.annualInterest, ccy)}</div>
                  </div>
                </div>
              )}
              {projection.kind === "equity" && (
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {projection.scenarios.map((s) => (
                    <div key={s.label} className="rounded-lg bg-white/[0.03] p-2">
                      <div className="text-[10px] text-muted-foreground">{s.label}</div>
                      <div className="tabular text-sm">{formatMoney(s.futureValue, ccy)}</div>
                      <div className="text-[10px] text-muted-foreground">in 10 yr</div>
                    </div>
                  ))}
                </div>
              )}
              <div className="text-[10px] italic text-muted-foreground">Estimated — not guaranteed</div>
            </div>
          )}

          {/* --- SIP block --- */}
          {canSip && (
            <div className="rounded-xl border border-primary/15 bg-primary/[0.05] p-3 space-y-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={!!form.sipEnabled}
                  onChange={(e) => setForm({
                    ...form,
                    sipEnabled: e.target.checked,
                    sipFrequency: form.sipFrequency || "monthly",
                    sipStatus: form.sipStatus || "active",
                    sipDate: form.sipDate || 1,
                  })} />
                <span>I invest in this regularly (SIP)</span>
              </label>
              {form.sipEnabled && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>SIP Amount</FieldLabel>
                    <MoneyInput value={form.sipAmount || 0} onChange={(n) => setForm({ ...form, sipAmount: n })} />
                  </div>
                  <div>
                    <FieldLabel>Frequency</FieldLabel>
                    <Select value={form.sipFrequency || "monthly"} onValueChange={() => { /* monthly only for now */ }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <FieldLabel>SIP Date (1–28)</FieldLabel>
                    <Select value={String(form.sipDate || 1)} onValueChange={(v) => setForm({ ...form, sipDate: Number(v) })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-60">
                        {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                          <SelectItem key={d} value={String(d)}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <FieldLabel>SIP Start Date</FieldLabel>
                    <input type="date" className="underline-input" value={form.sipStartDate || ""}
                      onChange={(e) => setForm({ ...form, sipStartDate: e.target.value })} />
                  </div>
                  <div className="col-span-2">
                    <FieldLabel>Status</FieldLabel>
                    <Select value={form.sipStatus || "active"} onValueChange={(v) => setForm({ ...form, sipStatus: v as "active" | "paused" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="paused">Paused</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* --- History --- */}
          {(form.purchases?.length ?? 0) > 0 && (
            <div className="rounded-xl border border-white/5 bg-white/[0.02]">
              <button
                type="button"
                onClick={() => setHistoryOpen((v) => !v)}
                className="w-full flex items-center justify-between p-3 text-sm">
                <span>History ({form.purchases!.length})</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${historyOpen ? "rotate-180" : ""}`} />
              </button>
              {historyOpen && (
                <div className="px-3 pb-3 space-y-1 text-xs">
                  {form.purchases!.slice().reverse().map((p) => (
                    <div key={p.id} className="flex justify-between gap-2 border-t border-white/5 pt-1.5">
                      <span>{p.date}</span>
                      <span className="tabular">{formatMoney(p.amount, ccy)}</span>
                      {p.units ? <span className="tabular">{p.units} u</span> : <span />}
                      {p.price ? <span className="tabular">@ {formatMoney(p.price, ccy)}</span> : <span />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* --- Footer buttons --- */}
          <div className="grid grid-cols-3 gap-2 pt-2">
            <Button onClick={save}>Save</Button>
            <Button variant="secondary" onClick={() => setAddMoreOpen(true)} className="gap-1">
              <Plus className="h-3.5 w-3.5" /> Add More
            </Button>
            {!isNew && (
              <Button variant="outline" onClick={() => setConfirmDel(true)} className="gap-1 text-rose-400">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            )}
          </div>
        </div>

        {addMoreOpen && (
          <AddMoreDialog
            asset={form}
            onClose={() => setAddMoreOpen(false)}
            onAdd={addMore}
          />
        )}

        <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this investment?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes the holding and its purchase history. Past transactions stay in Cash Flow.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={doDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}

function PnLRow({ invested, value, ccy }: { invested: number; value: number; ccy: string }) {
  const gain = value - invested;
  const pct = invested > 0 ? (gain / invested) * 100 : 0;
  return (
    <div className="grid grid-cols-3 gap-2 text-xs">
      <div>
        <div className="text-[10px] text-muted-foreground">Invested</div>
        <div className="tabular">{formatMoney(invested, ccy)}</div>
      </div>
      <div>
        <div className="text-[10px] text-muted-foreground">Current Value</div>
        <div className="tabular">{formatMoney(value, ccy)}</div>
      </div>
      <div>
        <div className="text-[10px] text-muted-foreground">P&L</div>
        <div className="tabular" style={{ color: gain >= 0 ? "var(--color-positive)" : "var(--color-danger)" }}>
          {gain >= 0 ? "+" : ""}{formatMoney(gain, ccy)} ({pct.toFixed(1)}%)
        </div>
      </div>
    </div>
  );
}

function AddMoreDialog({ asset, onClose, onAdd }: {
  asset: AssetItem;
  onClose: () => void;
  onAdd: (p: InvestmentPurchase) => void;
}) {
  const sub = asset.subtype || "";
  const isStock = STOCKS_LIKE.has(sub);
  const isFixed = FIXED_INCOME.has(sub);
  const [date, setDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = React.useState(0);
  const [units, setUnits] = React.useState(0);
  const [price, setPrice] = React.useState(0);

  const submit = () => {
    if (isStock) {
      if (!units || !price) { toast.error("Units and price are required"); return; }
      onAdd({ id: uid(), date, amount: units * price, units, price });
    } else {
      if (!amount) { toast.error("Amount is required"); return; }
      onAdd({ id: uid(), date, amount });
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add purchase / deposit</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div>
            <FieldLabel>Date</FieldLabel>
            <input type="date" className="underline-input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          {isStock ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Units</FieldLabel>
                <NumberInput value={units} onChange={setUnits} />
              </div>
              <div>
                <FieldLabel>Price</FieldLabel>
                <MoneyInput value={price} onChange={setPrice} />
              </div>
            </div>
          ) : (
            <div>
              <FieldLabel>{isFixed ? "Additional deposit" : "Amount"}</FieldLabel>
              <MoneyInput value={amount} onChange={setAmount} />
            </div>
          )}
          <Button className="w-full" onClick={submit}>Add</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
