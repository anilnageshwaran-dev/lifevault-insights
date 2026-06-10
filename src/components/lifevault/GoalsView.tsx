import * as React from "react";
import { useFinance, type Goal } from "@/lib/finance-context";
import { formatMoney, getCurrency } from "@/lib/currency";
import { pct, uid, clamp } from "@/lib/finance-utils";
import {
  GlassCard, MoneyInput, NumberInput, FieldLabel, SectionTitle, EmptyState,
} from "./primitives";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Target, Plus, Trash2, Pencil, Calculator, X, TrendingUp, FileDown,
} from "lucide-react";
import { toast } from "sonner";
import { CurrencySelect } from "./CurrencySelect";
import {
  Dialog as SipDialog,
  DialogContent as SipDialogContent,
  DialogHeader as SipDialogHeader,
  DialogTitle as SipDialogTitle,
} from "@/components/ui/dialog";
import { SipCalculator } from "./SipCalculator";
import { generateGoalsReport } from "@/lib/reports-pdf";
import { useAuth } from "@/lib/auth-context";

interface Template { name: string; icon: string; inflation: number; }
const TEMPLATES: Record<string, Template> = {
  "Home Purchase":    { name: "Home Purchase",    icon: "🏠", inflation: 7 },
  "Vehicle":          { name: "Vehicle",          icon: "🚗", inflation: 8 },
  "Higher Education": { name: "Higher Education", icon: "🎓", inflation: 10 },
  "Wedding":          { name: "Wedding",          icon: "💍", inflation: 8 },
  "Retirement":       { name: "Retirement",       icon: "🌅", inflation: 6 },
  "Travel":           { name: "Travel",           icon: "✈️", inflation: 5 },
  "Emergency Fund":   { name: "Emergency Fund",   icon: "🛡️", inflation: 0 },
  "Custom":           { name: "Custom",           icon: "🎯", inflation: 6 },
};
const GOAL_TYPES = Object.keys(TEMPLATES);

function computeGoal(g: Goal) {
  const years = Math.max(0, g.targetYear - new Date().getFullYear());
  const futureTarget = g.currentCost * Math.pow(1 + g.inflation / 100, years);
  const progress = futureTarget > 0 ? (g.currentSavings / futureTarget) * 100 : 0;
  const monthlyNeeded = years > 0 ? (futureTarget - g.currentSavings) / (years * 12) : futureTarget;
  return { years, futureTarget, progress, monthlyNeeded: Math.max(0, monthlyNeeded) };
}

export function GoalsView() {
  const { state, setState } = useFinance();
  const { user } = useAuth();
  const base = state.baseCurrency || "INR";
  const [open, setOpen] = React.useState(false);
  const [calcOpen, setCalcOpen] = React.useState(false);
  const [sipOpen, setSipOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Goal | null>(null);

  const ownerName =
    (user?.user_metadata?.name as string | undefined) ||
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email || "Account holder";

  const exportReport = () => {
    try {
      generateGoalsReport(state, ownerName);
      toast.success("Goals report downloaded");
    } catch (e) { toast.error((e as Error).message || "Report failed"); }
  };

  const blank: Goal = {
    id: "", name: "", type: "Home Purchase", currentCost: 0,
    targetYear: new Date().getFullYear() + 5, inflation: 7,
    linked: "", currentSavings: 0, currency: base, icon: TEMPLATES["Home Purchase"].icon,
  };
  const [form, setForm] = React.useState<Goal>(blank);

  const applyTemplate = (typeName: string) => {
    const t = TEMPLATES[typeName];
    setForm((f) => ({ ...f, type: typeName, icon: t.icon, inflation: t.inflation }));
  };

  const startNew = () => { setEditing(null); setForm(blank); setOpen(true); };
  const startEdit = (g: Goal) => { setEditing(g); setForm({ ...g, icon: g.icon || TEMPLATES[g.type]?.icon }); setOpen(true); };

  const save = () => {
    if (!form.name || !form.currentCost) { toast.error("Name and current cost required"); return; }
    if (editing) {
      setState((s) => ({ ...s, goals: s.goals.map((g) => g.id === editing.id ? form : g) }));
      toast.success("Goal updated");
    } else {
      setState((s) => ({ ...s, goals: [...s.goals, { ...form, id: uid() }] }));
      toast.success("Goal added");
    }
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      <GlassCard>
        <SectionTitle title="Your Goals" subtitle="Future-priced and tracked monthly"
          right={
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => setSipOpen(true)} className="gap-1">
                <TrendingUp className="h-4 w-4" /> <span className="hidden sm:inline">SIP Calc</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCalcOpen(true)} className="gap-1">
                <Calculator className="h-4 w-4" /> <span className="hidden sm:inline">Inflation</span>
              </Button>
              <Button variant="outline" size="sm" onClick={exportReport} className="gap-1">
                <FileDown className="h-4 w-4" /> <span className="hidden sm:inline">Report</span>
              </Button>
              <Button size="sm" onClick={startNew} className="gap-1"><Plus className="h-4 w-4" /> Add Goal</Button>
            </div>
          } />
        {state.goals.length === 0 ? (
          <EmptyState icon={Target} title="No goals yet"
            description="Add your first life goal and we'll inflation-adjust it for you."
            cta={<Button onClick={startNew} className="gap-1"><Plus className="h-4 w-4" /> Add Your First Goal</Button>} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {state.goals.map((g) => {
              const c = computeGoal(g);
              const ccy = g.currency || base;
              return (
                <div key={g.id} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="text-3xl">{g.icon || TEMPLATES[g.type]?.icon || "🎯"}</div>
                      <div className="min-w-0">
                        <div className="font-display text-lg truncate">{g.name}</div>
                        <div className="text-[11px] text-muted-foreground">{g.type} · {ccy}</div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => startEdit(g)} className="p-1.5 rounded-md hover:bg-white/5 text-muted-foreground">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => {
                        if (!confirm("Delete this goal?")) return;
                        setState((s) => ({ ...s, goals: s.goals.filter((x) => x.id !== g.id) }));
                        toast.success("Deleted");
                      }} className="p-1.5 rounded-md hover:bg-white/5 text-muted-foreground hover:text-rose-400">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-muted-foreground">Today's cost</div>
                      <div className="tabular text-sm">{formatMoney(g.currentCost, ccy)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">In {c.years}y</div>
                      <div className="tabular text-sm" style={{ color: "var(--color-warning)" }}>
                        {formatMoney(c.futureTarget, ccy)}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                      <span>Progress</span>
                      <span className="tabular">{pct(c.progress, 1)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${clamp(c.progress)}%`, backgroundColor: "var(--color-positive)" }} />
                    </div>
                  </div>
                  <div className="flex items-end justify-between pt-1">
                    <div>
                      <div className="text-[11px] text-muted-foreground">Monthly SIP needed</div>
                      <div className="font-display text-2xl tabular" style={{ color: "var(--color-positive)" }}>
                        {formatMoney(c.monthlyNeeded, ccy)}
                      </div>
                    </div>
                    <div className="rounded-full bg-white/5 text-[11px] px-2 py-1 text-muted-foreground">
                      {c.years > 0 ? `${c.years}y left` : "Due now"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      {calcOpen && <InflationPanel onClose={() => setCalcOpen(false)} />}

      <SipDialog open={sipOpen} onOpenChange={setSipOpen}>
        <SipDialogContent className="w-[calc(100vw-1.5rem)] sm:w-full max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6">
          <SipDialogHeader>
            <SipDialogTitle className="sr-only">SIP Calculator</SipDialogTitle>
          </SipDialogHeader>
          <SipCalculator />
        </SipDialogContent>
      </SipDialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {editing ? "Edit Goal" : "New Goal"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <FieldLabel>Template</FieldLabel>
              <Select value={form.type} onValueChange={applyTemplate}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GOAL_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{TEMPLATES[t].icon} {t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <FieldLabel>Goal Name</FieldLabel>
              <input className="underline-input" placeholder="Buy a home"
                value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Current Cost</FieldLabel>
                <MoneyInput value={form.currentCost} onChange={(n) => setForm({ ...form, currentCost: n })} />
              </div>
              <div>
                <FieldLabel>Currency</FieldLabel>
                <CurrencySelect value={form.currency || base} onChange={(c) => setForm({ ...form, currency: c })} />
              </div>
              <div>
                <FieldLabel>Target Year</FieldLabel>
                <NumberInput value={form.targetYear} onChange={(n) => setForm({ ...form, targetYear: n })}
                  min={new Date().getFullYear() + 1} />
              </div>
              <div>
                <FieldLabel>Inflation %</FieldLabel>
                <NumberInput value={form.inflation} onChange={(n) => setForm({ ...form, inflation: n })} />
              </div>
              <div className="col-span-2">
                <FieldLabel>Current Savings</FieldLabel>
                <MoneyInput value={form.currentSavings} onChange={(n) => setForm({ ...form, currentSavings: n })} />
              </div>
              <div className="col-span-2">
                <FieldLabel>Linked Asset / SIP (optional)</FieldLabel>
                <input className="underline-input" placeholder="e.g. Parag Parikh Flexi Cap"
                  value={form.linked || ""} onChange={(e) => setForm({ ...form, linked: e.target.value })} />
              </div>
            </div>
            <Button className="w-full" onClick={save} disabled={!form.name || !form.currentCost}>
              {editing ? "Update Goal" : "Create Goal"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InflationPanel({ onClose }: { onClose: () => void }) {
  const { state } = useFinance();
  const base = state.baseCurrency || "INR";
  const [cost, setCost] = React.useState(1000000);
  const [years, setYears] = React.useState(10);
  const [rate, setRate] = React.useState(6);
  const [ccy, setCcy] = React.useState(base);

  const future = cost * Math.pow(1 + rate / 100, years);
  const sip = years > 0 ? future / (years * 12) : future;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={onClose} />
      <aside className="fixed top-0 right-0 bottom-0 z-50 w-full md:w-96 bg-card border-l border-border p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display text-xl flex items-center gap-2">
            <Calculator className="h-5 w-5" /> Inflation Calculator
          </h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-accent"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <FieldLabel>Currency</FieldLabel>
            <CurrencySelect value={ccy} onChange={setCcy} />
          </div>
          <div>
            <FieldLabel>Current Estimated Cost ({getCurrency(ccy).symbol})</FieldLabel>
            <MoneyInput value={cost} onChange={setCost} />
          </div>
          <div>
            <FieldLabel>Years to Goal</FieldLabel>
            <NumberInput value={years} onChange={setYears} />
          </div>
          <div>
            <FieldLabel>Expected Inflation Rate %</FieldLabel>
            <NumberInput value={rate} onChange={setRate} />
          </div>
          <div className="rounded-xl border border-border bg-background p-4 space-y-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Future Inflated Amount</div>
              <div className="font-display text-3xl tabular mt-1" style={{ color: "var(--color-warning)" }}>
                {formatMoney(future, ccy)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Cost × (1 + rate/100) ^ years
              </p>
            </div>
            <div className="pt-3 border-t border-border">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Required Monthly SIP</div>
              <div className="font-display text-3xl tabular mt-1" style={{ color: "var(--color-positive)" }}>
                {formatMoney(sip, ccy)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Future Amount ÷ (years × 12) — simple linear
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
