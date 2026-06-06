import * as React from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText, CheckCircle2, AlertTriangle } from "lucide-react";
import Papa from "papaparse";
import { useFinance, ALL_TX_CATEGORIES, type Transaction, type TxType } from "@/lib/finance-context";
import { uid } from "@/lib/finance-utils";
import { categorize } from "@/lib/tx-categorize";
import { toast } from "sonner";

interface ParsedRow {
  date: string;
  description: string;
  amount: number;
  type: TxType;
  category: string;
  matched: boolean;
  include: boolean;
  duplicate?: boolean;
}

interface Props { open: boolean; onClose: () => void; }

const BANKS = ["HDFC", "SBI", "ICICI", "Axis", "Kotak", "Yes Bank", "IndusInd", "PNB", "Other"];

export function StatementImportDialog({ open, onClose }: Props) {
  const { state, setState } = useFinance();
  const [bank, setBank] = React.useState("HDFC");
  const [rows, setRows] = React.useState<ParsedRow[] | null>(null);
  const [accountId, setAccountId] = React.useState<string>(state.accounts[0]?.id ?? "");
  const [skipDup, setSkipDup] = React.useState(true);
  const [filter, setFilter] = React.useState<"all" | "income" | "expense" | "uncat">("all");

  const parseFile = (file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        try {
          const mapped = mapRows(res.data, state.transactions);
          if (mapped.length === 0) {
            toast.error("No transactions found. Check CSV format.");
            return;
          }
          setRows(mapped);
        } catch (e) { toast.error((e as Error).message || "Parse failed"); }
      },
      error: (e) => toast.error(e.message),
    });
  };

  const doImport = () => {
    if (!rows) return;
    if (!accountId) { toast.error("Select an account to tag transactions to"); return; }
    const incl = rows.filter((r) => r.include && !(skipDup && r.duplicate));
    if (incl.length === 0) { toast.error("No rows to import"); return; }
    const txs: Transaction[] = incl.map((r) => ({
      id: uid(),
      date: r.date,
      type: r.type,
      category: r.category,
      description: r.description,
      amount: r.amount,
      accountId,
    }));
    setState((s) => ({ ...s, transactions: [...txs, ...s.transactions] }));
    const skipped = rows.filter((r) => r.duplicate && skipDup).length;
    toast.success(`Imported ${incl.length} transactions${skipped > 0 ? ` (${skipped} duplicates skipped)` : ""}`);
    setRows(null);
    onClose();
  };

  const filtered = rows?.filter((r) => {
    if (filter === "all") return true;
    if (filter === "uncat") return !r.matched;
    return r.type === filter;
  });

  const income = rows?.filter((r) => r.type === "income" && r.include).reduce((s, r) => s + r.amount, 0) ?? 0;
  const expense = rows?.filter((r) => r.type === "expense" && r.include).reduce((s, r) => s + r.amount, 0) ?? 0;
  const uncat = rows?.filter((r) => !r.matched).length ?? 0;
  const dups = rows?.filter((r) => r.duplicate).length ?? 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Import Bank Statement</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {!rows && (
            <>
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Bank</label>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {BANKS.map((b) => (
                    <button key={b} onClick={() => setBank(b)}
                      className={`px-3 py-1.5 rounded-lg text-sm border ${
                        bank === b ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"
                      }`}>
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-background/40 p-3 text-xs">
                <div className="font-medium mb-1.5 flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> How to download</div>
                <div className="text-muted-foreground">
                  Most banks let you download a statement as CSV from net banking → Accounts → Statement. We support common Indian bank formats (date, narration/description, debit/credit columns).
                </div>
              </div>

              <label className="rounded-2xl border-2 border-dashed border-border p-8 flex flex-col items-center gap-3 cursor-pointer hover:bg-accent/30">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <div className="text-sm font-medium">Drop CSV or click to choose</div>
                <div className="text-xs text-muted-foreground">.csv files only</div>
                <input type="file" accept=".csv,text/csv" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) parseFile(f); }} />
              </label>
            </>
          )}

          {rows && filtered && (
            <div className="space-y-3">
              <div className="rounded-xl border border-border bg-background/40 p-3 text-xs grid grid-cols-2 md:grid-cols-4 gap-2">
                <Stat label="Rows" value={rows.length.toString()} />
                <Stat label="Income" value={`₹${income.toLocaleString()}`} tone="positive" />
                <Stat label="Expenses" value={`₹${expense.toLocaleString()}`} tone="danger" />
                <Stat label="Uncategorised" value={`${uncat} · ${dups} dup`} tone="warning" />
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                <select value={accountId} onChange={(e) => setAccountId(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-background border border-border text-sm">
                  <option value="">Choose account…</option>
                  {state.accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}
                  className="px-3 py-1.5 rounded-lg bg-background border border-border text-sm">
                  <option value="all">All</option>
                  <option value="income">Income only</option>
                  <option value="expense">Expenses only</option>
                  <option value="uncat">Uncategorised only</option>
                </select>
                <label className="text-xs flex items-center gap-1.5 ml-auto">
                  <input type="checkbox" checked={skipDup} onChange={(e) => setSkipDup(e.target.checked)} />
                  Skip duplicates
                </label>
              </div>

              <div className="border border-border rounded-lg overflow-x-auto max-h-80">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-card text-muted-foreground">
                    <tr>
                      <th className="px-2 py-2 text-left">Date</th>
                      <th className="px-2 py-2 text-left">Description</th>
                      <th className="px-2 py-2 text-left">Category</th>
                      <th className="px-2 py-2 text-right">Amount</th>
                      <th className="px-2 py-2 text-center">Incl</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r, i) => {
                      const realIdx = rows.indexOf(r);
                      return (
                        <tr key={i} className={`border-t border-border ${r.duplicate ? "bg-warning/10" : ""}`}>
                          <td className="px-2 py-1.5 tabular">{r.date}</td>
                          <td className="px-2 py-1.5 max-w-[180px] truncate">
                            {r.description}
                            {r.duplicate && <AlertTriangle className="inline h-3 w-3 ml-1 text-warning" />}
                          </td>
                          <td className="px-2 py-1.5">
                            <select value={r.category}
                              onChange={(e) => setRows(rows.map((row, j) => j === realIdx ? { ...row, category: e.target.value, matched: true } : row))}
                              className="px-1.5 py-0.5 rounded bg-background border border-border text-xs">
                              {ALL_TX_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </td>
                          <td className={`px-2 py-1.5 text-right tabular ${r.type === "income" ? "text-positive" : "text-danger"}`}>
                            {r.type === "income" ? "+" : "−"}₹{r.amount.toLocaleString()}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <input type="checkbox" checked={r.include}
                              onChange={(e) => setRows(rows.map((row, j) => j === realIdx ? { ...row, include: e.target.checked } : row))} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setRows(null)}>Back</Button>
                <Button size="sm" onClick={doImport} className="gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> Import
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "positive" | "danger" | "warning" }) {
  const color = tone === "positive" ? "text-positive" : tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "";
  return (
    <div>
      <div className="text-[10px] uppercase text-muted-foreground tracking-wider">{label}</div>
      <div className={`tabular text-sm font-medium ${color}`}>{value}</div>
    </div>
  );
}

const num = (s: string | undefined): number => {
  if (!s) return 0;
  const n = Number(String(s).replace(/[^\d.-]/g, ""));
  return isFinite(n) ? n : 0;
};

function parseDate(s: string | undefined): string {
  if (!s) return "";
  const t = s.trim();
  // dd/mm/yyyy or dd-mm-yyyy
  const m = t.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    const dd = m[1].padStart(2, "0");
    const mm = m[2].padStart(2, "0");
    let yyyy = m[3];
    if (yyyy.length === 2) yyyy = (Number(yyyy) > 50 ? "19" : "20") + yyyy;
    return `${yyyy}-${mm}-${dd}`;
  }
  const d = new Date(t);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return "";
}

function mapRows(data: Record<string, string>[], existing: Transaction[]): ParsedRow[] {
  const findKey = (row: Record<string, string>, ...candidates: string[]): string | undefined => {
    const keys = Object.keys(row);
    for (const c of candidates) {
      const f = keys.find((k) => k.toLowerCase().trim() === c.toLowerCase());
      if (f) return f;
    }
    for (const c of candidates) {
      const f = keys.find((k) => k.toLowerCase().includes(c.toLowerCase()));
      if (f) return f;
    }
    return undefined;
  };

  const existingKey = new Set(existing.map((t) => `${t.date}|${Math.round(t.amount)}`));

  return data
    .map((row) => {
      const dateKey = findKey(row, "Date", "Txn Date", "Transaction Date", "Value Date", "Posting Date");
      const descKey = findKey(row, "Narration", "Description", "Details", "Particulars", "Remarks");
      const debKey = findKey(row, "Withdrawal Amt", "Withdrawal", "Debit", "Debit Amount", "DR");
      const credKey = findKey(row, "Deposit Amt", "Deposit", "Credit", "Credit Amount", "CR");

      const date = parseDate(dateKey ? row[dateKey] : "");
      const description = descKey ? (row[descKey] || "").trim() : "";
      if (!date || !description) return null;
      const debit = debKey ? num(row[debKey]) : 0;
      const credit = credKey ? num(row[credKey]) : 0;
      if (!debit && !credit) return null;
      const isCredit = credit > 0;
      const amount = Math.abs(isCredit ? credit : debit);
      const cat = categorize(description, amount, isCredit);
      const dupKey = `${date}|${Math.round(amount)}`;
      return {
        date,
        description,
        amount,
        type: cat.type,
        category: cat.category,
        matched: cat.matched,
        include: true,
        duplicate: existingKey.has(dupKey),
      } as ParsedRow;
    })
    .filter((r): r is ParsedRow => r !== null);
}
