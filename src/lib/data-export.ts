import * as XLSX from "xlsx";
import JSZip from "jszip";
import { convert, type FxCache } from "./currency";
import type { FinanceState } from "./finance-context";
import { accountBalance } from "./finance-context";

type Row = Record<string, string | number | undefined | null>;

interface Sheet {
  name: string;
  rows: Row[];
}

const round = (n: number) => Math.round(n || 0);
const today = () => new Date().toISOString().slice(0, 10);

function buildSheets(state: FinanceState, fx: FxCache | null): Sheet[] {
  const base = state.baseCurrency || "INR";
  const accById = Object.fromEntries(state.accounts.map((a) => [a.id, a]));
  const toBase = (amt: number, ccy?: string) =>
    round(convert(amt || 0, ccy || base, base, fx));

  // Summary
  const totalAssets = state.assets.reduce(
    (s, a) => s + convert(a.value || 0, a.currency || base, base, fx),
    0,
  );
  const totalLiab = state.liabilities.reduce(
    (s, l) => s + convert(l.principal || 0, l.currency || base, base, fx),
    0,
  );
  const totalAccounts = state.accounts.reduce(
    (s, a) => s + convert(accountBalance(state, a.id), a.currency, base, fx),
    0,
  );
  const summary: Row[] = [
    { Metric: "Generated on", Value: new Date().toLocaleString() },
    { Metric: "Base currency", Value: base },
    { Metric: "Accounts", Value: state.accounts.length },
    { Metric: "Investments", Value: state.assets.filter((a) => a.category === "investment").length },
    { Metric: "Other assets", Value: state.assets.filter((a) => a.category !== "investment").length },
    { Metric: "Liabilities", Value: state.liabilities.length },
    { Metric: "Transactions", Value: state.transactions.length },
    { Metric: "Bills", Value: state.bills.length },
    { Metric: "Goals", Value: state.goals.length },
    { Metric: `Total account balance (${base})`, Value: round(totalAccounts) },
    { Metric: `Total assets (${base})`, Value: round(totalAssets) },
    { Metric: `Total liabilities (${base})`, Value: round(totalLiab) },
    { Metric: `Net worth (${base})`, Value: round(totalAssets - totalLiab) },
  ];

  // Accounts
  const accounts: Row[] = state.accounts.map((a) => {
    const bal = accountBalance(state, a.id);
    return {
      Name: a.name,
      Type: a.type,
      Subtype: a.accountSubtype || "",
      Bank: a.bank || "",
      Last4: a.last4 || "",
      "Opening Balance": round(a.openingBalance),
      "Current Balance": round(bal),
      Currency: a.currency,
      [`Balance in ${base}`]: toBase(bal, a.currency),
      "As Of": a.asOf,
      "Emergency Fund": a.emergencyFund ? "Yes" : "",
      "Credit Limit": a.creditLimit || "",
      "Interest Rate": a.interestRate || "",
      "Maturity Date": a.maturityDate || "",
    };
  });

  // Investments (category = investment)
  const investments: Row[] = state.assets
    .filter((a) => a.category === "investment")
    .map((a) => ({
      Name: a.name,
      Subtype: a.subtype || "",
      Ticker: a.ticker || "",
      Units: a.units ?? "",
      "Avg Price": a.avgPrice ?? "",
      "Current Price": a.currentPrice ?? "",
      "Current Value": round(a.value),
      Invested: round(a.invested || 0),
      "Gain/Loss": round((a.value || 0) - (a.invested || 0)),
      Currency: a.currency || base,
      [`Value in ${base}`]: toBase(a.value, a.currency),
      "SIP Active": a.sipEnabled ? "Yes" : "",
      "SIP Amount": a.sipAmount || "",
      "SIP Date": a.sipDate || "",
      "Maturity Date": a.maturityDate || "",
      Notes: a.notes || "",
    }));

  // Transactions
  const transactions: Row[] = state.transactions.map((t) => {
    const acc = t.accountId ? accById[t.accountId] : undefined;
    const ccy = t.currency || acc?.currency || base;
    return {
      Date: t.date,
      Account: acc?.name || "",
      Type: t.type,
      Category: t.category,
      Description: t.description,
      Amount: round(t.amount),
      Currency: ccy,
      [`Amount in ${base}`]: toBase(t.amount, ccy),
      Transfer: t.transferId ? "Yes" : "",
    };
  });

  // Bills
  const bills: Row[] = state.bills.map((b) => {
    const acc = b.accountId ? accById[b.accountId] : undefined;
    const ccy = b.currency || acc?.currency || base;
    return {
      Name: b.name,
      Category: b.category,
      Amount: round(b.amount),
      Currency: ccy,
      [`Amount in ${base}`]: toBase(b.amount, ccy),
      Frequency: b.frequency,
      "Next Due": b.nextDue,
      Account: acc?.name || "",
      Autopay: b.autopay ? "Yes" : "",
      "Payments Logged": b.history?.length || 0,
      Notes: b.notes || "",
    };
  });

  // Goals
  const goals: Row[] = state.goals.map((g) => {
    const years = Math.max(0, g.targetYear - new Date().getFullYear());
    const future = g.currentCost * Math.pow(1 + g.inflation / 100, years);
    const sip = years > 0 ? Math.max(0, (future - g.currentSavings) / (years * 12)) : 0;
    return {
      Name: g.name,
      Type: g.type,
      "Current Cost": round(g.currentCost),
      "Future Cost": round(future),
      "Inflation %": g.inflation,
      "Target Year": g.targetYear,
      "Years Left": years,
      "Current Savings": round(g.currentSavings),
      "Monthly SIP Required": round(sip),
      Currency: g.currency || base,
    };
  });

  // Assets (non-investment)
  const assets: Row[] = state.assets
    .filter((a) => a.category !== "investment")
    .map((a) => ({
      Name: a.name,
      Category: a.category,
      Subtype: a.subtype || "",
      Value: round(a.value),
      Currency: a.currency || base,
      [`Value in ${base}`]: toBase(a.value, a.currency),
      Invested: round(a.invested || 0),
      Notes: a.notes || "",
    }));

  // Liabilities
  const liabilities: Row[] = state.liabilities.map((l) => ({
    Name: l.name,
    Category: l.category,
    "Outstanding Principal": round(l.principal),
    "Original Principal": round(l.originalPrincipal || 0),
    "Interest Rate %": l.rate,
    EMI: round(l.emi),
    Currency: l.currency || base,
    [`Outstanding in ${base}`]: toBase(l.principal, l.currency),
    "Start Date": l.startDate || "",
    "Due Date": l.dueDate || "",
    Notes: l.notes || "",
  }));

  // Net Worth History
  const netWorthHistory: Row[] = (state.snapshots || []).map((s) => ({
    Date: s.date,
    Assets: round(s.assets),
    Liabilities: round(s.liabilities),
    "Net Worth": round(s.netWorth),
    Cash: round(s.assetBreakdown?.cash || 0),
    Investment: round(s.assetBreakdown?.investment || 0),
    Gold: round(s.assetBreakdown?.gold || 0),
    "Real Estate": round(s.assetBreakdown?.realestate || 0),
    Crypto: round(s.assetBreakdown?.crypto || 0),
  }));

  // Vault Summary (masked)
  const mask = (v: string) => {
    if (!v) return "";
    const s = String(v);
    if (s.length <= 4) return "•".repeat(s.length);
    return "•".repeat(Math.max(4, s.length - 4)) + s.slice(-4);
  };
  const vaultRows: Row[] = [];
  Object.entries(state.vault || {}).forEach(([category, items]) => {
    (items || []).forEach((rec) => {
      vaultRows.push({
        Category: category,
        Title: rec.title,
        Subtitle: rec.subtitle || "",
        Fields: Object.keys(rec.fields || {}).join(", "),
        "Sample (masked)": Object.values(rec.fields || {})
          .slice(0, 1)
          .map((v) => mask(String(v)))
          .join(""),
        Updated: rec.updatedAt ? new Date(rec.updatedAt).toLocaleDateString() : "",
      });
    });
  });

  // SIP History
  const sipHistory: Row[] = [];
  state.assets.forEach((a) => {
    (a.sipHistory || []).forEach((h) => {
      sipHistory.push({
        Date: h.date,
        Investment: a.name,
        Subtype: a.subtype || "",
        Amount: round(h.amount),
        Units: h.units ?? "",
        Price: h.price ?? "",
        Currency: a.currency || base,
        [`Amount in ${base}`]: toBase(h.amount, a.currency),
      });
    });
  });

  return [
    { name: "Summary", rows: summary },
    { name: "Accounts", rows: accounts },
    { name: "Investments", rows: investments },
    { name: "Transactions", rows: transactions },
    { name: "Bills", rows: bills },
    { name: "Goals", rows: goals },
    { name: "Assets", rows: assets },
    { name: "Liabilities", rows: liabilities },
    { name: "Net Worth History", rows: netWorthHistory },
    { name: "Vault Summary", rows: vaultRows },
    { name: "SIP History", rows: sipHistory },
  ];
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportXlsx(state: FinanceState, fx: FxCache | null) {
  const sheets = buildSheets(state, fx);
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.json_to_sheet(s.rows.length ? s.rows : [{ "(no data)": "" }]);
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  download(
    new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `lifevault_${today()}.xlsx`,
  );
}

function rowsToCsv(rows: Row[]): string {
  if (!rows.length) return "";
  const headers = Array.from(
    rows.reduce<Set<string>>((s, r) => {
      Object.keys(r).forEach((k) => s.add(k));
      return s;
    }, new Set()),
  );
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) lines.push(headers.map((h) => esc(r[h])).join(","));
  return lines.join("\n");
}

export async function exportCsvZip(state: FinanceState, fx: FxCache | null) {
  const sheets = buildSheets(state, fx);
  const zip = new JSZip();
  for (const s of sheets) {
    const fname = s.name.toLowerCase().replace(/\s+/g, "_") + ".csv";
    zip.file(fname, rowsToCsv(s.rows));
  }
  const blob = await zip.generateAsync({ type: "blob" });
  download(blob, `lifevault_csvs_${today()}.zip`);
}
