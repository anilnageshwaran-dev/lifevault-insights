import * as React from "react";
import {
  useFinance,
  EXPENSE_CATEGORIES,
  ALL_TX_CATEGORIES,
  type Transaction,
  type TxType,
  type RecurringTemplate,
} from "@/lib/finance-context";
import { formatINR, pct, uid, clamp } from "@/lib/finance-utils";
import {
  GlassCard,
  MoneyInput,
  FieldLabel,
  SectionTitle,
  EmptyState,
} from "./primitives";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Repeat, Receipt, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export function CashFlowView() {
  const { state, setState } = useFinance();
  const [period, setPeriod] = React.useState<3 | 6 | 12>(12);
  const [filterCat, setFilterCat] = React.useState<string>("all");
  const [filterType, setFilterType] = React.useState<string>("all");

  const cutoff = React.useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - period);
    return d;
  }, [period]);

  const inPeriod = state.transactions.filter(
    (t) => new Date(t.date) >= cutoff,
  );
  const totals = {
    income: inPeriod.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
    expense: inPeriod.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
    invested: inPeriod.filter((t) => t.type === "investment").reduce((s, t) => s + t.amount, 0),
  };

  const filtered = state.transactions
    .filter((t) => (filterCat === "all" ? true : t.category === filterCat))
    .filter((t) => (filterType === "all" ? true : t.type === filterType))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Current month spend per category
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthSpend: Record<string, number> = {};
  state.transactions
    .filter((t) => t.type === "expense" && new Date(t.date) >= monthStart)
    .forEach((t) => {
      monthSpend[t.category] = (monthSpend[t.category] || 0) + t.amount;
    });

  const overBudgetCats = EXPENSE_CATEGORIES.filter((c) => {
    const b = state.budgets[c] || 0;
    return b > 0 && (monthSpend[c] || 0) > b;
  });

  return (
    <div className="space-y-6">
      {/* Summary ribbon */}
      <GlassCard>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="font-display text-xl">Cash Flow Summary</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Past {period} months · ₹ figures
            </p>
          </div>
          <div className="flex gap-1 p-1 rounded-lg bg-white/[0.04] w-fit">
            {([3, 6, 12] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  period === p
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p}M
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: "Total Income", val: totals.income, color: "var(--color-positive)" },
            { label: "Total Expenses", val: totals.expense, color: "var(--color-danger)" },
            { label: "Total Invested", val: totals.invested, color: "var(--color-primary)" },
          ].map((t) => (
            <div
              key={t.label}
              className="rounded-xl border border-white/5 bg-white/[0.02] p-4"
            >
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                {t.label}
              </div>
              <div
                className="font-display text-2xl tabular mt-1"
                style={{ color: t.color }}
              >
                {formatINR(t.val)}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                avg {formatINR(t.val / period)} / mo
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {overBudgetCats.length > 0 && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-rose-300 shrink-0 mt-0.5" />
          <div>
            <div className="text-rose-200 font-medium">
              {overBudgetCats.length} budget{overBudgetCats.length > 1 ? "s" : ""} exceeded this month
            </div>
            <div className="text-xs text-rose-200/80 mt-0.5">
              {overBudgetCats.join(", ")}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <GlassCard>
          <SectionTitle
            title="Transactions"
            subtitle={`${filtered.length} entries`}
          />
          <div className="flex gap-2 mb-3">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-32 bg-white/[0.04] border-white/10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="investment">Investment</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterCat} onValueChange={setFilterCat}>
              <SelectTrigger className="flex-1 bg-white/[0.04] border-white/10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value="all">All categories</SelectItem>
                {ALL_TX_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="max-h-[420px] overflow-y-auto pr-1 space-y-1.5">
            {filtered.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="No transactions yet"
                description="Tap the + button to log your first transaction."
              />
            ) : (
              filtered.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 border border-white/5 bg-white/[0.02]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm truncate">
                      {t.description || t.category}
                    </div>
                    <div className="text-[11px] text-muted-foreground flex gap-2">
                      <span>{new Date(t.date).toLocaleDateString("en-IN")}</span>
                      <span>·</span>
                      <span>{t.category}</span>
                    </div>
                  </div>
                  <div
                    className="tabular text-sm shrink-0"
                    style={{
                      color:
                        t.type === "income"
                          ? "var(--color-positive)"
                          : t.type === "expense"
                            ? "var(--color-danger)"
                            : "var(--color-primary)",
                    }}
                  >
                    {t.type === "expense" ? "-" : t.type === "income" ? "+" : ""}
                    {formatINR(t.amount)}
                  </div>
                  <button
                    className="text-muted-foreground hover:text-rose-400"
                    onClick={() =>
                      setState((s) => ({
                        ...s,
                        transactions: s.transactions.filter(
                          (x) => x.id !== t.id,
                        ),
                      }))
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </GlassCard>

        <GlassCard>
          <SectionTitle title="Budget Guardrails" subtitle="Set limits, stay on track" />
          <div className="space-y-3 max-h-[490px] overflow-y-auto pr-1">
            {EXPENSE_CATEGORIES.map((c) => {
              const budget = state.budgets[c] || 0;
              const spent = monthSpend[c] || 0;
              const ratio = budget > 0 ? (spent / budget) * 100 : 0;
              const color =
                ratio >= 85
                  ? "var(--color-danger)"
                  : ratio >= 70
                    ? "var(--color-warning)"
                    : "var(--color-positive)";
              return (
                <div key={c} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span>{c}</span>
                    <div className="flex items-center gap-2">
                      <span className="tabular text-xs text-muted-foreground">
                        {formatINR(spent)} / 
                      </span>
                      <div className="w-28">
                        <MoneyInput
                          value={budget}
                          onChange={(n) =>
                            setState((s) => ({
                              ...s,
                              budgets: { ...s.budgets, [c]: n },
                            }))
                          }
                          placeholder="budget"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full transition-all duration-700 ease-out rounded-full"
                      style={{
                        width: `${clamp(ratio)}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                  {budget > 0 && (
                    <div className="text-[11px] text-muted-foreground tabular">
                      {pct(ratio, 0)} used
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </GlassCard>
      </div>

      <RecurringPanel />

      <QuickAddFab />
    </div>
  );
}

function RecurringPanel() {
  const { state, setState } = useFinance();
  const [form, setForm] = React.useState<Omit<RecurringTemplate, "id">>({
    name: "",
    amount: 0,
    type: "expense",
    category: "Housing",
    frequency: "monthly",
    nextDue: new Date().toISOString().slice(0, 10),
  });

  const addTemplate = () => {
    if (!form.name || !form.amount) {
      toast.error("Name and amount required");
      return;
    }
    setState((s) => ({
      ...s,
      recurring: [...s.recurring, { id: uid(), ...form }],
    }));
    setForm({ ...form, name: "", amount: 0 });
    toast.success("Recurring template added");
  };

  const autoGenerate = () => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const monthly = state.recurring.filter(
      (r) =>
        r.frequency === "monthly" &&
        new Date(r.nextDue) >= monthStart &&
        new Date(r.nextDue) <= monthEnd,
    );
    if (monthly.length === 0) {
      toast.info("No monthly recurring items due this month");
      return;
    }
    const newTx: Transaction[] = monthly.map((r) => ({
      id: uid(),
      date: r.nextDue,
      type: r.type,
      category: r.category,
      description: r.name,
      amount: r.amount,
    }));
    setState((s) => ({
      ...s,
      transactions: [...s.transactions, ...newTx],
      recurring: s.recurring.map((r) =>
        r.frequency === "monthly" &&
        new Date(r.nextDue) >= monthStart &&
        new Date(r.nextDue) <= monthEnd
          ? {
              ...r,
              nextDue: new Date(
                new Date(r.nextDue).setMonth(
                  new Date(r.nextDue).getMonth() + 1,
                ),
              )
                .toISOString()
                .slice(0, 10),
            }
          : r,
      ),
    }));
    toast.success(`Generated ${newTx.length} transactions`);
  };

  return (
    <GlassCard>
      <SectionTitle
        title="Recurring Templates"
        subtitle="Set it once, auto-log every cycle"
        right={
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={autoGenerate}
          >
            <Repeat className="h-3.5 w-3.5" /> Auto-Generate This Month
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end mb-4">
        <div className="md:col-span-2">
          <FieldLabel>Name</FieldLabel>
          <input
            className="underline-input"
            placeholder="Netflix"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <FieldLabel>Amount</FieldLabel>
          <MoneyInput
            value={form.amount}
            onChange={(n) => setForm({ ...form, amount: n })}
          />
        </div>
        <div>
          <FieldLabel>Type</FieldLabel>
          <Select
            value={form.type}
            onValueChange={(v) => setForm({ ...form, type: v as TxType })}
          >
            <SelectTrigger className="bg-white/[0.04] border-white/10 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="expense">Expense</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="investment">Investment</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <FieldLabel>Frequency</FieldLabel>
          <Select
            value={form.frequency}
            onValueChange={(v) =>
              setForm({ ...form, frequency: v as RecurringTemplate["frequency"] })
            }
          >
            <SelectTrigger className="bg-white/[0.04] border-white/10 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <FieldLabel>Next Due</FieldLabel>
          <input
            type="date"
            className="underline-input"
            value={form.nextDue}
            onChange={(e) => setForm({ ...form, nextDue: e.target.value })}
          />
        </div>
      </div>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={addTemplate} className="gap-1">
          <Plus className="h-3.5 w-3.5" /> Add Template
        </Button>
      </div>

      {state.recurring.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          No recurring templates yet.
        </p>
      ) : (
        <div className="space-y-1.5">
          {state.recurring.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between rounded-lg px-3 py-2 border border-white/5 bg-white/[0.02]"
            >
              <div>
                <div className="text-sm">{r.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {r.frequency} · next {new Date(r.nextDue).toLocaleDateString("en-IN")} · {r.category}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="tabular text-sm">{formatINR(r.amount)}</div>
                <button
                  className="text-muted-foreground hover:text-rose-400"
                  onClick={() =>
                    setState((s) => ({
                      ...s,
                      recurring: s.recurring.filter((x) => x.id !== r.id),
                    }))
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}

function QuickAddFab() {
  const { setState } = useFinance();
  const [open, setOpen] = React.useState(false);
  const [tx, setTx] = React.useState<Omit<Transaction, "id">>({
    date: new Date().toISOString().slice(0, 10),
    type: "expense",
    category: "Food & Groceries",
    description: "",
    amount: 0,
  });

  const save = () => {
    if (!tx.amount) {
      toast.error("Enter an amount");
      return;
    }
    setState((s) => ({
      ...s,
      transactions: [...s.transactions, { id: uid(), ...tx }],
    }));
    toast.success("Transaction saved");
    setOpen(false);
    setTx({ ...tx, description: "", amount: 0 });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="fixed bottom-24 md:bottom-6 right-6 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30 flex items-center justify-center hover:scale-105 transition-transform z-30"
          aria-label="Add transaction"
        >
          <Plus className="h-6 w-6" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Quick Add Transaction</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-white/[0.04]">
            {(["income", "expense", "investment"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTx({ ...tx, type: t })}
                className={`py-2 text-xs capitalize rounded-md transition-colors ${
                  tx.type === t
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div>
            <FieldLabel>Date</FieldLabel>
            <input
              type="date"
              className="underline-input"
              value={tx.date}
              onChange={(e) => setTx({ ...tx, date: e.target.value })}
            />
          </div>
          <div>
            <FieldLabel>Category</FieldLabel>
            <Select
              value={tx.category}
              onValueChange={(v) => setTx({ ...tx, category: v })}
            >
              <SelectTrigger className="bg-white/[0.04] border-white/10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {ALL_TX_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <FieldLabel>Description</FieldLabel>
            <input
              className="underline-input"
              placeholder="Coffee with friends"
              value={tx.description}
              onChange={(e) => setTx({ ...tx, description: e.target.value })}
            />
          </div>
          <div>
            <FieldLabel>Amount (₹)</FieldLabel>
            <MoneyInput
              value={tx.amount}
              onChange={(n) => setTx({ ...tx, amount: n })}
            />
          </div>
          <Button className="w-full" onClick={save}>
            Save Transaction
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
