import * as React from "react";
import {
  useFinance,
  EXPENSE_CATEGORIES,
  categoriesForType,
  accountBalance,
  type Transaction,
  type TxType,
  type Account,
  type AccountType,
  type Bill,
  type BillFrequency,
} from "@/lib/finance-context";
import { formatMoney, convert, CURRENCIES, getCurrency } from "@/lib/currency";
import { pct, uid, clamp } from "@/lib/finance-utils";
import {
  GlassCard, MoneyInput, FieldLabel, SectionTitle, EmptyState,
} from "./primitives";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Trash2, Receipt, AlertTriangle, Wallet, CreditCard, Banknote,
  ChevronLeft, ChevronRight, Search, CalendarClock, CheckCircle2, Repeat,
} from "lucide-react";
import { toast } from "sonner";
import { CurrencySelect } from "./CurrencySelect";

const BANKS = [
  "HDFC", "SBI", "ICICI", "Axis", "Kotak", "Yes Bank", "IndusInd",
  "PNB", "BOB", "Canara", "Federal", "RBL", "HSBC",
  "Standard Chartered", "DBS",
];

const ACCOUNT_COLORS = [
  { id: "teal", v: "#14B8A6" },
  { id: "blue", v: "#3B82F6" },
  { id: "green", v: "#10B981" },
  { id: "amber", v: "#F59E0B" },
  { id: "red", v: "#EF4444" },
  { id: "purple", v: "#A855F7" },
];

const ACCOUNT_ICONS = ["🏦", "💳", "💵", "📱", "💼", "🏧", "💎", "💰", "🪙", "📊", "📈", "🧾"];

type SubTab = "transactions" | "accounts" | "bills" | "budget" | "insights";

export function CashFlowView() {
  const [tab, setTab] = React.useState<SubTab>("transactions");

  return (
    <div className="space-y-6">
      <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] w-fit overflow-x-auto">
        {([
          { id: "transactions", label: "Transactions" },
          { id: "accounts", label: "Accounts" },
          { id: "bills", label: "Bills" },
          { id: "budget", label: "Budget" },
          { id: "insights", label: "Insights" },
        ] as const).map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 text-sm rounded-lg transition-colors ${
              tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "transactions" && <TransactionsTab />}
      {tab === "accounts" && <AccountsTab />}
      {tab === "bills" && <BillsTab />}
      {tab === "budget" && <BudgetTab />}
      {tab === "insights" && <InsightsTab />}

      {tab !== "bills" && <QuickAddFab />}
    </div>
  );
}

// ────────────────────────────────────────────── TRANSACTIONS

function TransactionsTab() {
  const { state, setState, fx } = useFinance();
  const base = state.baseCurrency || "INR";
  const [filterType, setFilterType] = React.useState<"all" | TxType>("all");
  const [search, setSearch] = React.useState("");
  const [monthOffset, setMonthOffset] = React.useState(0);

  const now = new Date();
  const viewing = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const monthStart = new Date(viewing.getFullYear(), viewing.getMonth(), 1);
  const monthEnd = new Date(viewing.getFullYear(), viewing.getMonth() + 1, 0, 23, 59, 59);

  const filtered = state.transactions
    .filter((t) => {
      const d = new Date(t.date);
      return d >= monthStart && d <= monthEnd;
    })
    .filter((t) => filterType === "all" || t.type === filterType)
    .filter((t) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (t.description || "").toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q);
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const accById = React.useMemo(
    () => Object.fromEntries(state.accounts.map((a) => [a.id, a])),
    [state.accounts],
  );

  return (
    <GlassCard>
      <SectionTitle title="Transactions" subtitle={`${filtered.length} entries this month`} />

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button onClick={() => setMonthOffset((o) => o - 1)}
          className="p-2 rounded-lg hover:bg-accent">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-sm font-medium min-w-32 text-center">
          {viewing.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
        </div>
        <button onClick={() => setMonthOffset((o) => o + 1)} disabled={monthOffset >= 0}
          className="p-2 rounded-lg hover:bg-accent disabled:opacity-30">
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-48 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search description or category"
            className="w-full pl-10 pr-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm outline-none focus:border-primary" />
        </div>
      </div>

      <div className="flex gap-1 p-1 rounded-lg bg-white/[0.04] w-fit mb-3">
        {(["all", "income", "expense", "investment"] as const).map((t) => (
          <button key={t} onClick={() => setFilterType(t)}
            className={`px-3 py-1 text-xs capitalize rounded-md transition-colors ${
              filterType === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}>
            {t}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Receipt} title="No transactions"
          description="Tap the + button to log your first transaction." />
      ) : (
        <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
          {filtered.map((t) => {
            const acc = t.accountId ? accById[t.accountId] : undefined;
            const ccy = t.currency || acc?.currency || base;
            return (
              <div key={t.id}
                className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 border border-white/5 bg-white/[0.02]">
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate">{t.description || t.category}</div>
                  <div className="text-[11px] text-muted-foreground flex flex-wrap gap-1.5 items-center">
                    <span>{new Date(t.date).toLocaleDateString("en-IN")}</span>
                    {acc && (
                      <>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: acc.color }} />
                          {acc.name}
                        </span>
                      </>
                    )}
                    <span>·</span>
                    <span>{t.category}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="tabular text-sm"
                    style={{
                      color: t.type === "income" ? "var(--color-positive)"
                        : t.type === "expense" ? "var(--color-danger)"
                        : "var(--color-primary)",
                    }}>
                    {t.type === "expense" ? "−" : t.type === "income" ? "+" : ""}
                    {formatMoney(t.amount, ccy)}
                  </div>
                  {ccy !== base && (
                    <div className="text-[10px] text-muted-foreground">
                      · {formatMoney(convert(t.amount, ccy, base, fx), base)}
                    </div>
                  )}
                </div>
                <button className="text-muted-foreground hover:text-rose-400"
                  onClick={() => {
                    if (!confirm("Delete this transaction?")) return;
                    setState((s) => ({ ...s, transactions: s.transactions.filter((x) => x.id !== t.id) }));
                    toast.success("Deleted");
                  }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}

// ────────────────────────────────────────────── ACCOUNTS

function AccountsTab() {
  const { state, setState } = useFinance();
  const base = state.baseCurrency || "INR";
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Account | null>(null);

  return (
    <GlassCard>
      <SectionTitle title="Accounts" subtitle="Bank, cards, cash and wallets"
        right={
          <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-1">
            <Plus className="h-4 w-4" /> Add Account
          </Button>
        } />

      {state.accounts.length === 0 ? (
        <EmptyState icon={Wallet} title="No accounts yet"
          description="Add bank, credit card, cash or wallet accounts to track balances and link transactions."
          cta={<Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-1">
            <Plus className="h-4 w-4" /> Add your first account
          </Button>} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {state.accounts.map((a) => {
            const bal = accountBalance(state, a.id);
            const isCC = a.type === "credit";
            const util = isCC && a.creditLimit ? clamp((bal / a.creditLimit) * 100) : 0;
            return (
              <div key={a.id} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center text-xl"
                      style={{ backgroundColor: a.color + "22" }}>{a.icon}</div>
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: a.color }} />
                        {a.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {a.type === "bank" ? a.accountSubtype || "Bank" : a.type === "credit" ? "Credit Card" : a.type}
                        {a.last4 ? ` · ····${a.last4}` : ""}
                        {a.emergencyFund ? " · 🛡 Emergency" : ""}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditing(a); setOpen(true); }}
                      className="p-1.5 rounded hover:bg-accent text-muted-foreground text-xs">Edit</button>
                    <button onClick={() => {
                      if (!confirm("Delete this account? Its transactions will be kept.")) return;
                      setState((s) => ({ ...s, accounts: s.accounts.filter((x) => x.id !== a.id) }));
                      toast.success("Deleted");
                    }} className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-rose-400">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="flex items-end justify-between pt-1">
                  <div>
                    <div className="text-[11px] text-muted-foreground">
                      {isCC ? "Outstanding" : "Current Balance"}
                    </div>
                    <div className="font-display text-2xl tabular"
                      style={{ color: isCC ? "var(--color-danger)" : undefined }}>
                      {formatMoney(bal, a.currency)}
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground">{a.currency}</div>
                </div>
                {isCC && a.creditLimit ? (
                  <div className="space-y-1">
                    <div className="text-[11px] text-muted-foreground flex justify-between">
                      <span>Utilisation</span>
                      <span>{util.toFixed(0)}% of {formatMoney(a.creditLimit, a.currency)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full"
                        style={{ width: `${util}%`, backgroundColor: util > 70 ? "var(--color-danger)" : "var(--color-warning)" }} />
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {open && <AccountFormDialog
        account={editing}
        onClose={() => { setOpen(false); setEditing(null); }}
        base={base}
      />}
    </GlassCard>
  );
}

function AccountFormDialog({ account, onClose, base }:
  { account: Account | null; onClose: () => void; base: string }) {
  const { state, setState } = useFinance();
  const isNew = !account;

  const [type, setType] = React.useState<AccountType>(account?.type || "bank");
  const [form, setForm] = React.useState<Account>(
    account ?? {
      id: uid(),
      type: "bank",
      name: "",
      bank: "",
      accountSubtype: "Savings",
      last4: "",
      openingBalance: 0,
      currency: base,
      asOf: new Date().toISOString().slice(0, 10),
      color: ACCOUNT_COLORS[0].v,
      icon: ACCOUNT_ICONS[0],
      emergencyFund: false,
      creditLimit: undefined,
    },
  );

  React.useEffect(() => {
    setForm((f) => ({ ...f, type }));
  }, [type]);

  const save = () => {
    if (!form.name) { toast.error("Name is required"); return; }
    const finalForm = { ...form };
    if (isNew) {
      // Create opening-balance transaction
      const opening = finalForm.openingBalance || 0;
      setState((s) => {
        const next: Account = { ...finalForm, id: finalForm.id || uid() };
        const newTx: Transaction[] = [];
        if (opening !== 0) {
          newTx.push({
            id: uid(),
            date: finalForm.asOf,
            type: finalForm.type === "credit" ? "expense" : "income",
            category: finalForm.type === "credit" ? "Credit Card Payment" : "Other Income",
            description: "Opening balance",
            amount: 0, // amount handled via openingBalance field, not a tx
            accountId: next.id,
            currency: next.currency,
          });
        }
        // We chose not to also push a fake transaction; openingBalance is already
        // included in accountBalance(). So we skip newTx push to avoid double counting.
        return { ...s, accounts: [...s.accounts, next] };
      });
      toast.success("Account added");
    } else {
      setState((s) => ({ ...s, accounts: s.accounts.map((a) => a.id === finalForm.id ? finalForm : a) }));
      toast.success("Account updated");
    }
    onClose();
  };

  const isBank = type === "bank";
  const isCC = type === "credit";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {isNew ? "Add Account" : "Edit Account"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div>
            <FieldLabel>Account Type</FieldLabel>
            <div className="grid grid-cols-5 gap-1 mt-1 p-1 rounded-lg bg-white/[0.04]">
              {(["bank", "credit", "cash", "wallet", "other"] as AccountType[]).map((t) => (
                <button key={t} onClick={() => setType(t)}
                  className={`py-1.5 text-xs capitalize rounded-md ${
                    type === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  }`}>{t === "credit" ? "Card" : t}</button>
              ))}
            </div>
          </div>

          <div>
            <FieldLabel>{isCC ? "Card Nickname *" : isBank ? "Account Nickname *" : "Name *"}</FieldLabel>
            <input className="underline-input" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={isBank ? "e.g. HDFC Savings" : isCC ? "e.g. Axis Magnus" : "e.g. Cash in Hand"} />
          </div>

          {(isBank || isCC) && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>{isCC ? "Issuer / Bank *" : "Bank Name *"}</FieldLabel>
                <input className="underline-input" list="bank-list" value={form.bank || ""}
                  onChange={(e) => setForm({ ...form, bank: e.target.value })} />
                <datalist id="bank-list">
                  {BANKS.map((b) => <option key={b} value={b} />)}
                </datalist>
              </div>
              <div>
                <FieldLabel>Last 4 Digits</FieldLabel>
                <input className="underline-input" maxLength={4} inputMode="numeric"
                  value={form.last4 || ""} onChange={(e) => setForm({ ...form, last4: e.target.value.replace(/\D/g, "").slice(0, 4) })} />
              </div>
            </div>
          )}

          {isBank && (
            <div>
              <FieldLabel>Account Type</FieldLabel>
              <Select value={form.accountSubtype || "Savings"}
                onValueChange={(v) => setForm({ ...form, accountSubtype: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Savings", "Current", "Salary", "NRE", "NRO"].map((t) =>
                    <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>{isCC ? "Opening Outstanding *" : "Opening Balance *"}</FieldLabel>
              <MoneyInput value={form.openingBalance}
                onChange={(n) => setForm({ ...form, openingBalance: n })} />
              {isCC && <p className="text-[10px] text-muted-foreground mt-1">Current amount owed on this card</p>}
            </div>
            <div>
              <FieldLabel>Currency *</FieldLabel>
              <CurrencySelect value={form.currency} onChange={(c) => setForm({ ...form, currency: c })} />
            </div>
          </div>

          {isCC && (
            <div>
              <FieldLabel>Credit Limit (optional)</FieldLabel>
              <MoneyInput value={form.creditLimit || 0}
                onChange={(n) => setForm({ ...form, creditLimit: n || undefined })} />
              <p className="text-[10px] text-muted-foreground mt-1">Shows utilisation % when set</p>
            </div>
          )}

          <div>
            <FieldLabel>Balance as of</FieldLabel>
            <input type="date" className="underline-input" value={form.asOf}
              onChange={(e) => setForm({ ...form, asOf: e.target.value })} />
          </div>

          {(isBank || isCC) && (
            <details className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <summary className="text-sm font-medium cursor-pointer">
                {isCC ? "Card login (net banking)" : "Internet banking login"}
                <span className="text-[10px] text-muted-foreground ml-2">— encrypted with your PIN</span>
              </summary>
              <div className="space-y-3 pt-3">
                <div>
                  <FieldLabel>Login URL</FieldLabel>
                  <input className="underline-input" placeholder="https://..."
                    value={form.loginUrl || ""}
                    onChange={(e) => setForm({ ...form, loginUrl: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>User ID / Customer ID</FieldLabel>
                    <input className="underline-input" autoComplete="off"
                      value={form.loginUsername || ""}
                      onChange={(e) => setForm({ ...form, loginUsername: e.target.value })} />
                  </div>
                  <div>
                    <FieldLabel>Password</FieldLabel>
                    <input type="password" className="underline-input" autoComplete="new-password"
                      value={form.loginPassword || ""}
                      onChange={(e) => setForm({ ...form, loginPassword: e.target.value })} />
                  </div>
                </div>
                <div>
                  <FieldLabel>Notes (transaction password, profile password, hints)</FieldLabel>
                  <textarea rows={2} className="underline-input"
                    value={form.loginNotes || ""}
                    onChange={(e) => setForm({ ...form, loginNotes: e.target.value })} />
                </div>
              </div>
            </details>
          )}

          <div>
            <FieldLabel>Colour</FieldLabel>
            <div className="flex gap-2 mt-1">
              {ACCOUNT_COLORS.map((c) => (
                <button key={c.id} onClick={() => setForm({ ...form, color: c.v })}
                  className={`h-7 w-7 rounded-full transition-all ${form.color === c.v ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : ""}`}
                  style={{ backgroundColor: c.v }} />
              ))}
            </div>
          </div>

          <div>
            <FieldLabel>Icon</FieldLabel>
            <div className="grid grid-cols-6 gap-2 mt-1">
              {ACCOUNT_ICONS.map((i) => (
                <button key={i} onClick={() => setForm({ ...form, icon: i })}
                  className={`h-9 rounded-lg border text-lg ${form.icon === i ? "border-primary bg-primary/15" : "border-border"}`}>
                  {i}
                </button>
              ))}
            </div>
          </div>

          {!isCC && (
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={!!form.emergencyFund}
                onChange={(e) => setForm({ ...form, emergencyFund: e.target.checked })}
                className="mt-0.5" />
              <span>
                Part of emergency fund
                <span className="block text-[11px] text-muted-foreground">Counts toward your runway in Essentials</span>
              </span>
            </label>
          )}

          <Button className="w-full" onClick={save} disabled={!form.name}>
            {isNew ? "Save Account" : "Update Account"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────────────────────── BUDGET

function BudgetTab() {
  const { state, setState } = useFinance();
  const base = state.baseCurrency || "INR";

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
    <div className="space-y-4">
      {overBudgetCats.length > 0 && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-rose-300 shrink-0 mt-0.5" />
          <div>
            <div className="text-rose-200 font-medium">
              {overBudgetCats.length} budget{overBudgetCats.length > 1 ? "s" : ""} exceeded this month
            </div>
            <div className="text-xs text-rose-200/80 mt-0.5">{overBudgetCats.join(", ")}</div>
          </div>
        </div>
      )}
      <GlassCard>
        <SectionTitle title="Budget Guardrails" subtitle="Set monthly limits per expense category" />
        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
          {EXPENSE_CATEGORIES.map((c) => {
            const budget = state.budgets[c] || 0;
            const spent = monthSpend[c] || 0;
            const ratio = budget > 0 ? (spent / budget) * 100 : 0;
            const color = ratio >= 85 ? "var(--color-danger)" : ratio >= 70 ? "var(--color-warning)" : "var(--color-positive)";
            return (
              <div key={c} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span>{c}</span>
                  <div className="flex items-center gap-2">
                    <span className="tabular text-xs text-muted-foreground">{formatMoney(spent, base)} / </span>
                    <div className="w-28">
                      <MoneyInput value={budget}
                        onChange={(n) => setState((s) => ({ ...s, budgets: { ...s.budgets, [c]: n } }))}
                        placeholder="budget" />
                    </div>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full transition-all duration-700 ease-out rounded-full"
                    style={{ width: `${clamp(ratio)}%`, backgroundColor: color }} />
                </div>
                {budget > 0 && (
                  <div className="text-[11px] text-muted-foreground tabular">{pct(ratio, 0)} used</div>
                )}
              </div>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
}

// ────────────────────────────────────────────── INSIGHTS

function InsightsTab() {
  const { state, fx } = useFinance();
  const base = state.baseCurrency || "INR";
  const [period, setPeriod] = React.useState<"thisMonth" | "lastMonth" | "3m" | "6m" | "12m" | "ytd">("thisMonth");

  const { start, end, months } = React.useMemo(() => {
    const now = new Date();
    let start: Date, end = new Date(now);
    let months = 1;
    if (period === "thisMonth") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === "lastMonth") {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59);
    } else if (period === "3m") { start = new Date(now); start.setMonth(start.getMonth() - 3); months = 3; }
    else if (period === "6m") { start = new Date(now); start.setMonth(start.getMonth() - 6); months = 6; }
    else if (period === "12m") { start = new Date(now); start.setMonth(start.getMonth() - 12); months = 12; }
    else { start = new Date(now.getFullYear(), 0, 1); months = now.getMonth() + 1; }
    return { start, end, months };
  }, [period]);

  const accById = React.useMemo(
    () => Object.fromEntries(state.accounts.map((a) => [a.id, a])),
    [state.accounts],
  );

  const [acctFilter, setAcctFilter] = React.useState<string>("all");
  const [ccyFilter, setCcyFilter] = React.useState<string>("all");
  const currencies = React.useMemo(() => {
    const set = new Set<string>();
    state.accounts.forEach((a) => set.add(a.currency));
    state.transactions.forEach((t) => {
      if (t.currency) set.add(t.currency);
    });
    if (set.size === 0) set.add(base);
    return Array.from(set);
  }, [state.accounts, state.transactions, base]);

  const inPeriod = state.transactions.filter((t) => {
    const d = new Date(t.date);
    if (d < start || d > end) return false;
    if (acctFilter !== "all" && t.accountId !== acctFilter) return false;
    const ccy = t.currency || (t.accountId ? accById[t.accountId]?.currency : base) || base;
    if (ccyFilter !== "all" && ccy !== ccyFilter) return false;
    return true;
  });
  const toBase = (t: Transaction) => {
    const ccy = t.currency || (t.accountId ? accById[t.accountId]?.currency : base) || base;
    return convert(t.amount, ccy, base, fx);
  };
  const income = inPeriod.filter((t) => t.type === "income").reduce((s, t) => s + toBase(t), 0);
  const expense = inPeriod.filter((t) => t.type === "expense").reduce((s, t) => s + toBase(t), 0);
  const invested = inPeriod.filter((t) => t.type === "investment").reduce((s, t) => s + toBase(t), 0);

  // Per-account breakdown (for current period & filters)
  const perAccount = React.useMemo(() => {
    const map = new Map<string, { income: number; expense: number; invested: number }>();
    inPeriod.forEach((t) => {
      const key = t.accountId || "__none";
      const cur = map.get(key) || { income: 0, expense: 0, invested: 0 };
      const v = toBase(t);
      if (t.type === "income") cur.income += v;
      else if (t.type === "expense") cur.expense += v;
      else cur.invested += v;
      map.set(key, cur);
    });
    return Array.from(map.entries());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inPeriod]);

  return (
    <GlassCard>
      <SectionTitle title="Cash Flow Insights" subtitle="Compare income, spending, investing" />
      <div className="flex gap-1 p-1 rounded-lg bg-white/[0.04] w-fit mb-3 flex-wrap">
        {([
          { id: "thisMonth", label: "This Month" },
          { id: "lastMonth", label: "Last Month" },
          { id: "3m", label: "3M" },
          { id: "6m", label: "6M" },
          { id: "12m", label: "12M" },
          { id: "ytd", label: "YTD" },
        ] as const).map((p) => (
          <button key={p.id} onClick={() => setPeriod(p.id)}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              period === p.id ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}>{p.label}</button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="min-w-44">
          <Select value={acctFilter} onValueChange={setAcctFilter}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              {state.accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: a.color }} />
                    {a.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-32">
          <Select value={ccyFilter} onValueChange={setCcyFilter}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All currencies</SelectItem>
              {currencies.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Total Income", val: income, color: "var(--color-positive)" },
          { label: "Total Expenses", val: expense, color: "var(--color-danger)" },
          { label: "Total Invested", val: invested, color: "var(--color-primary)" },
        ].map((t) => (
          <div key={t.label} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{t.label}</div>
            <div className="font-display text-2xl tabular mt-1" style={{ color: t.color }}>
              {formatMoney(t.val, base)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              avg {formatMoney(t.val / months, base)} / mo
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.02] p-4">
        <div className="text-xs text-muted-foreground">Net cash flow</div>
        <div className="font-display text-3xl tabular"
          style={{ color: income - expense >= 0 ? "var(--color-positive)" : "var(--color-danger)" }}>
          {formatMoney(income - expense, base)}
        </div>
      </div>

      {perAccount.length > 0 && (
        <div className="mt-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">By account</div>
          <div className="space-y-1.5">
            {perAccount.map(([id, v]) => {
              const a = id === "__none" ? null : accById[id];
              const net = v.income - v.expense;
              return (
                <div key={id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 border border-white/5 bg-white/[0.02] text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    {a ? (
                      <>
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: a.color }} />
                        <span className="truncate">{a.name}</span>
                        <span className="text-[10px] text-muted-foreground">· {a.currency}</span>
                      </>
                    ) : <span className="text-muted-foreground">No account</span>}
                  </div>
                  <div className="flex gap-3 tabular text-xs">
                    <span style={{ color: "var(--color-positive)" }}>+{formatMoney(v.income, base)}</span>
                    <span style={{ color: "var(--color-danger)" }}>−{formatMoney(v.expense, base)}</span>
                    <span className="font-medium" style={{ color: net >= 0 ? "var(--color-positive)" : "var(--color-danger)" }}>
                      {formatMoney(net, base)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </GlassCard>
  );
}

// ────────────────────────────────────────────── QUICK ADD FAB

function QuickAddFab() {
  const { state, setState } = useFinance();
  const base = state.baseCurrency || "INR";
  const [open, setOpen] = React.useState(false);

  const defaultAccountId = state.lastUsedAccountId || state.accounts[0]?.id;
  const defaultAccount = state.accounts.find((a) => a.id === defaultAccountId);

  const blank = (): Omit<Transaction, "id"> => ({
    date: new Date().toISOString().slice(0, 10),
    type: "expense",
    category: "Food & Dining",
    description: "",
    amount: 0,
    accountId: defaultAccountId,
    currency: defaultAccount?.currency || base,
  });

  const [tx, setTx] = React.useState<Omit<Transaction, "id">>(blank());

  React.useEffect(() => {
    if (open) setTx(blank());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const selectedAccount = state.accounts.find((a) => a.id === tx.accountId);
  const txCurrency = selectedAccount?.currency || tx.currency || base;
  const cats = categoriesForType(tx.type);

  React.useEffect(() => {
    // Reset category when type changes
    if (!cats.includes(tx.category)) {
      setTx((t) => ({ ...t, category: cats[0] }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tx.type]);

  const save = () => {
    if (!tx.amount) { toast.error("Enter an amount"); return; }
    setState((s) => ({
      ...s,
      transactions: [...s.transactions, { id: uid(), ...tx, currency: txCurrency }],
      lastUsedAccountId: tx.accountId || s.lastUsedAccountId,
    }));
    toast.success("Transaction saved");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button onClick={() => setOpen(true)}
        className="fixed bottom-24 md:bottom-6 right-6 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30 flex items-center justify-center hover:scale-105 transition-transform z-30"
        aria-label="Add transaction">
        <Plus className="h-6 w-6" />
      </button>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Quick Add Transaction</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-white/[0.04]">
            {(["income", "expense", "investment"] as const).map((t) => (
              <button key={t} onClick={() => setTx({ ...tx, type: t })}
                className={`py-2 text-xs capitalize rounded-md transition-colors ${
                  tx.type === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}>{t}</button>
            ))}
          </div>

          <div>
            <FieldLabel>Date</FieldLabel>
            <input type="date" className="underline-input" value={tx.date}
              onChange={(e) => setTx({ ...tx, date: e.target.value })} />
          </div>

          <div>
            <FieldLabel>Account</FieldLabel>
            {state.accounts.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">
                No accounts yet. Add one in Cash Flow → Accounts to organise your transactions.
              </p>
            ) : (
              <Select value={tx.accountId || ""}
                onValueChange={(v) => setTx({ ...tx, accountId: v, currency: state.accounts.find((a) => a.id === v)?.currency })}>
                <SelectTrigger><SelectValue placeholder="Pick an account" /></SelectTrigger>
                <SelectContent>
                  {state.accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: a.color }} />
                        {a.name} <span className="text-[10px] text-muted-foreground">· {a.currency}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {!selectedAccount && (
            <div>
              <FieldLabel>Currency</FieldLabel>
              <CurrencySelect value={tx.currency || base}
                onChange={(c) => setTx({ ...tx, currency: c })} />
            </div>
          )}

          <div>
            <FieldLabel>Category</FieldLabel>
            <Select value={tx.category} onValueChange={(v) => setTx({ ...tx, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                {cats.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <FieldLabel>Description</FieldLabel>
            <input className="underline-input" placeholder="e.g. Coffee with friends"
              value={tx.description} onChange={(e) => setTx({ ...tx, description: e.target.value })} />
          </div>

          <div>
            <FieldLabel>Amount ({getCurrency(txCurrency).symbol})</FieldLabel>
            <MoneyInput value={tx.amount} onChange={(n) => setTx({ ...tx, amount: n })} />
          </div>

          <Button className="w-full" onClick={save} disabled={!tx.amount}>
            Save Transaction
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────────────────────── BILLS

function addToDate(iso: string, freq: BillFrequency): string {
  const d = new Date(iso);
  switch (freq) {
    case "weekly": d.setDate(d.getDate() + 7); break;
    case "monthly": d.setMonth(d.getMonth() + 1); break;
    case "quarterly": d.setMonth(d.getMonth() + 3); break;
    case "halfYearly": d.setMonth(d.getMonth() + 6); break;
    case "yearly": d.setFullYear(d.getFullYear() + 1); break;
    case "onetime": return iso;
  }
  return d.toISOString().slice(0, 10);
}

const FREQ_LABEL: Record<BillFrequency, string> = {
  weekly: "Weekly", monthly: "Monthly", quarterly: "Quarterly",
  halfYearly: "Half-yearly", yearly: "Yearly", onetime: "One-time",
};

function daysUntil(iso: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(iso); d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

function BillsTab() {
  const { state, setState } = useFinance();
  const base = state.baseCurrency || "INR";
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Bill | null>(null);
  const [view, setView] = React.useState<"upcoming" | "overdue" | "recurring" | "paid">("upcoming");

  const accById = React.useMemo(
    () => Object.fromEntries(state.accounts.map((a) => [a.id, a])),
    [state.accounts],
  );

  const bills = state.bills;
  const overdue = bills.filter((b) => daysUntil(b.nextDue) < 0);
  const upcoming = bills.filter((b) => {
    const d = daysUntil(b.nextDue);
    return d >= 0 && d <= 30;
  }).sort((a, b) => a.nextDue.localeCompare(b.nextDue));
  const recurring = bills.filter((b) => b.frequency !== "onetime");
  const paidHistory = bills.flatMap((b) =>
    b.history.map((h) => ({ bill: b, payment: h }))
  ).sort((a, b) => b.payment.date.localeCompare(a.payment.date));

  const markPaid = (bill: Bill, when?: string) => {
    const paidDate = when || new Date().toISOString().slice(0, 10);
    const acc = bill.accountId ? accById[bill.accountId] : null;
    const ccy = bill.currency || acc?.currency || base;
    const tx: Transaction = {
      id: uid(),
      date: paidDate,
      type: "expense",
      category: bill.category || "Utilities",
      description: bill.name,
      amount: bill.amount,
      accountId: bill.accountId,
      currency: ccy,
    };
    setState((s) => {
      const updated = s.bills.map((x) => {
        if (x.id !== bill.id) return x;
        const next: Bill = {
          ...x,
          history: [...x.history, { date: paidDate, amount: x.amount, txId: tx.id }],
          nextDue: x.frequency === "onetime" ? x.nextDue : addToDate(x.nextDue, x.frequency),
        };
        return next;
      });
      return { ...s, bills: updated, transactions: [...s.transactions, tx] };
    });
    toast.success(`${bill.name} marked paid · transaction logged`);
  };

  const startNew = () => { setEditing(null); setOpen(true); };

  return (
    <div className="space-y-4">
      <GlassCard>
        <SectionTitle
          title="Bills"
          subtitle="Recurring debits — track upcoming, overdue, and history"
          right={
            <Button onClick={startNew} className="gap-1">
              <Plus className="h-4 w-4" /> Add Bill
            </Button>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          {([
            { id: "upcoming", label: "Upcoming", count: upcoming.length, icon: CalendarClock, color: "var(--color-warning)" },
            { id: "overdue", label: "Overdue", count: overdue.length, icon: AlertTriangle, color: "var(--color-danger)" },
            { id: "recurring", label: "Recurring", count: recurring.length, icon: Repeat, color: "var(--color-primary)" },
            { id: "paid", label: "Paid", count: paidHistory.length, icon: CheckCircle2, color: "var(--color-positive)" },
          ] as const).map((v) => {
            const Icon = v.icon;
            const active = view === v.id;
            return (
              <button key={v.id} onClick={() => setView(v.id)}
                className={`rounded-xl border p-3 text-left transition-all ${
                  active ? "border-primary/40 bg-primary/10" : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"
                }`}>
                <div className="flex items-center justify-between">
                  <Icon className="h-4 w-4" style={{ color: v.color }} />
                  <span className="font-display text-xl tabular">{v.count}</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">{v.label}</div>
              </button>
            );
          })}
        </div>

        {bills.length === 0 ? (
          <EmptyState icon={CalendarClock} title="No bills yet"
            description="Add bills like rent, EMIs, subscriptions or utilities to track upcoming debits."
            cta={<Button onClick={startNew} className="gap-1"><Plus className="h-4 w-4" /> Add your first bill</Button>} />
        ) : view === "paid" ? (
          paidHistory.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="No payments recorded" description="Mark a bill as paid to see history here." />
          ) : (
            <div className="space-y-1.5">
              {paidHistory.slice(0, 50).map(({ bill, payment }, i) => {
                const acc = bill.accountId ? accById[bill.accountId] : null;
                const ccy = bill.currency || acc?.currency || base;
                return (
                  <div key={`${bill.id}-${payment.date}-${i}`}
                    className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 border border-white/5 bg-white/[0.02]">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm truncate">{bill.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        Paid {new Date(payment.date).toLocaleDateString("en-IN")}
                        {acc && <> · {acc.name}</>}
                      </div>
                    </div>
                    <div className="tabular text-sm" style={{ color: "var(--color-positive)" }}>
                      {formatMoney(payment.amount, ccy)}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          (() => {
            const list = view === "upcoming" ? upcoming : view === "overdue" ? overdue : recurring;
            if (list.length === 0) {
              const msg = view === "upcoming" ? "Nothing due in the next 30 days."
                : view === "overdue" ? "No overdue bills — great work!"
                : "No recurring bills set up.";
              return <EmptyState icon={CheckCircle2} title="All clear" description={msg} />;
            }
            return (
              <div className="space-y-2">
                {list.map((b) => {
                  const d = daysUntil(b.nextDue);
                  const acc = b.accountId ? accById[b.accountId] : null;
                  const ccy = b.currency || acc?.currency || base;
                  const dueColor = d < 0 ? "var(--color-danger)" : d <= 3 ? "var(--color-warning)" : "var(--color-muted-foreground)";
                  const dueText = d < 0 ? `${Math.abs(d)}d overdue`
                    : d === 0 ? "Due today" : d === 1 ? "Due tomorrow" : `In ${d}d`;
                  return (
                    <div key={b.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">{b.name}</span>
                          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/[0.04] text-muted-foreground">
                            {FREQ_LABEL[b.frequency]}
                          </span>
                          {b.autopay && (
                            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
                              Autopay
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap gap-1.5 items-center">
                          <span>{new Date(b.nextDue).toLocaleDateString("en-IN")}</span>
                          <span>·</span>
                          <span style={{ color: dueColor }}>{dueText}</span>
                          {acc && (<><span>·</span>
                            <span className="inline-flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: acc.color }} />
                              {acc.name}
                            </span></>)}
                          <span>·</span><span>{b.category}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="tabular font-display text-lg">{formatMoney(b.amount, ccy)}</div>
                      </div>
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="secondary" onClick={() => markPaid(b)}>
                          Mark paid
                        </Button>
                        <button onClick={() => { setEditing(b); setOpen(true); }}
                          className="p-2 rounded-lg hover:bg-accent text-muted-foreground text-xs">Edit</button>
                        <button onClick={() => {
                          if (!confirm("Delete this bill? Past payments stay in transactions.")) return;
                          setState((s) => ({ ...s, bills: s.bills.filter((x) => x.id !== b.id) }));
                          toast.success("Deleted");
                        }} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-rose-400">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()
        )}
      </GlassCard>

      {open && <BillFormDialog bill={editing} onClose={() => { setOpen(false); setEditing(null); }} base={base} />}
    </div>
  );
}

function BillFormDialog({ bill, onClose, base }:
  { bill: Bill | null; onClose: () => void; base: string }) {
  const { state, setState } = useFinance();
  const isNew = !bill;
  const defaultAccount = state.accounts[0];
  const [form, setForm] = React.useState<Bill>(
    bill ?? {
      id: uid(),
      name: "",
      amount: 0,
      currency: defaultAccount?.currency || base,
      category: "Utilities",
      accountId: defaultAccount?.id,
      frequency: "monthly",
      nextDue: new Date().toISOString().slice(0, 10),
      autopay: false,
      notes: "",
      history: [],
    },
  );

  const selectedAccount = state.accounts.find((a) => a.id === form.accountId);
  const ccy = selectedAccount?.currency || form.currency || base;

  const save = () => {
    if (!form.name) { toast.error("Bill name is required"); return; }
    if (!form.amount) { toast.error("Amount is required"); return; }
    setState((s) => ({
      ...s,
      bills: isNew ? [...s.bills, form] : s.bills.map((b) => b.id === form.id ? form : b),
    }));
    toast.success(isNew ? "Bill added" : "Bill updated");
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {isNew ? "Add Bill" : "Edit Bill"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div>
            <FieldLabel>Name *</FieldLabel>
            <input className="underline-input" placeholder="e.g. Rent, Electricity, Netflix"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Amount ({getCurrency(ccy).symbol}) *</FieldLabel>
              <MoneyInput value={form.amount} onChange={(n) => setForm({ ...form, amount: n })} />
            </div>
            <div>
              <FieldLabel>Frequency</FieldLabel>
              <Select value={form.frequency}
                onValueChange={(v) => setForm({ ...form, frequency: v as BillFrequency })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(FREQ_LABEL) as BillFrequency[]).map((f) =>
                    <SelectItem key={f} value={f}>{FREQ_LABEL[f]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <FieldLabel>Next due date *</FieldLabel>
              <input type="date" className="underline-input" value={form.nextDue}
                onChange={(e) => setForm({ ...form, nextDue: e.target.value })} />
            </div>
            <div>
              <FieldLabel>Category</FieldLabel>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <FieldLabel>Debit account</FieldLabel>
            {state.accounts.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">
                Add an account first so paid bills create the right transaction.
              </p>
            ) : (
              <Select value={form.accountId || ""}
                onValueChange={(v) => setForm({ ...form, accountId: v, currency: state.accounts.find((a) => a.id === v)?.currency })}>
                <SelectTrigger><SelectValue placeholder="Pick an account" /></SelectTrigger>
                <SelectContent>
                  {state.accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: a.color }} />
                        {a.name} <span className="text-[10px] text-muted-foreground">· {a.currency}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={!!form.autopay} className="mt-0.5"
              onChange={(e) => setForm({ ...form, autopay: e.target.checked })} />
            <span>Autopay enabled
              <span className="block text-[11px] text-muted-foreground">Marks bill so you know it'll auto-debit</span>
            </span>
          </label>
          <div>
            <FieldLabel>Notes</FieldLabel>
            <textarea rows={2} className="underline-input"
              value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <Button className="w-full" onClick={save} disabled={!form.name || !form.amount}>
            {isNew ? "Save Bill" : "Update Bill"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
