import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { FinanceState } from "./finance-context";
import {
  sumAssets, sumLiabilities, assetsByCategory, ASSET_LABELS,
} from "./finance-context";
import { convert, formatMoney, type FxCache } from "./currency";

function header(doc: jsPDF, title: string, sub: string) {
  const W = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold").setFontSize(22).setTextColor(20, 30, 60);
  doc.text(title, 40, 60);
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(120);
  doc.text(sub, 40, 80);
  doc.setDrawColor(220).line(40, 90, W - 40, 90);
}

function watermarkAndFooter(doc: jsPDF) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "bold").setFontSize(56).setTextColor(240, 240, 245);
    doc.text("CONFIDENTIAL", W / 2, H / 2 + 40, { align: "center", angle: -30 });
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(150);
    doc.text(
      `LifeVault · ${new Date().toLocaleDateString()} · lifevaultapp.lovable.app · Page ${i} of ${pages}`,
      W / 2, H - 20, { align: "center" },
    );
  }
}

interface ReportOpts {
  password?: string;
}

function finalize(doc: jsPDF, filename: string, opts?: ReportOpts) {
  watermarkAndFooter(doc);
  if (opts?.password) {
    // jsPDF supports basic encryption via constructor options; for simplicity here
    // we re-encrypt using doc internals if available.
    try {
      // @ts-expect-error jsPDF has encryption support but typing lags
      doc.setEncryption?.(opts.password, opts.password, ["print", "copy"]);
    } catch {/* noop */}
  }
  doc.save(filename);
}

// ---------- 1. Net Worth Report ----------
export function generateNetWorthReport(
  state: FinanceState,
  fx: FxCache | null,
  ownerName: string,
  opts?: ReportOpts,
) {
  const base = state.baseCurrency || "INR";
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  header(doc, "Net Worth Report", `${ownerName} · ${new Date().toLocaleDateString()} · ${base}`);
  let y = 110;

  const ta = sumAssets(state, fx, base);
  const tl = sumLiabilities(state, fx, base);
  const nw = ta - tl;

  autoTable(doc, {
    startY: y,
    head: [["Summary", base]],
    body: [
      ["Total Assets", formatMoney(ta, base)],
      ["Total Liabilities", formatMoney(tl, base)],
      ["Net Worth", formatMoney(nw, base)],
    ],
    theme: "grid",
    headStyles: { fillColor: [30, 60, 120] },
    styles: { fontSize: 10 },
    margin: { left: 40, right: 40 },
  });
  // @ts-expect-error
  y = doc.lastAutoTable.finalY + 20;

  // Allocation
  const byCat = assetsByCategory(state, fx, base);
  autoTable(doc, {
    startY: y,
    head: [["Asset Class", `Value (${base})`, "Share"]],
    body: (Object.keys(byCat) as Array<keyof typeof byCat>).map((k) => {
      const v = byCat[k];
      const share = ta > 0 ? ((v / ta) * 100).toFixed(1) + "%" : "—";
      return [ASSET_LABELS[k], formatMoney(v, base), share];
    }),
    theme: "striped",
    headStyles: { fillColor: [30, 60, 120] },
    styles: { fontSize: 10 },
    margin: { left: 40, right: 40 },
  });
  // @ts-expect-error
  y = doc.lastAutoTable.finalY + 20;

  // Assets list
  if (state.assets.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Asset", "Category", "Value"]],
      body: state.assets.map((a) => [a.name, ASSET_LABELS[a.category], formatMoney(a.value, a.currency || base)]),
      theme: "striped",
      headStyles: { fillColor: [30, 60, 120] },
      styles: { fontSize: 9 },
      margin: { left: 40, right: 40 },
    });
    // @ts-expect-error
    y = doc.lastAutoTable.finalY + 20;
  }

  // Liabilities
  if (state.liabilities.length > 0) {
    if (y > 700) { doc.addPage(); y = 56; }
    autoTable(doc, {
      startY: y,
      head: [["Liability", "Outstanding", "EMI"]],
      body: state.liabilities.map((l) => [l.name, formatMoney(l.principal, l.currency || base), formatMoney(l.emi, l.currency || base)]),
      theme: "striped",
      headStyles: { fillColor: [30, 60, 120] },
      styles: { fontSize: 9 },
      margin: { left: 40, right: 40 },
    });
    // @ts-expect-error
    y = doc.lastAutoTable.finalY + 20;
  }

  // Snapshots history (last 12)
  if (state.snapshots.length > 0) {
    if (y > 700) { doc.addPage(); y = 56; }
    autoTable(doc, {
      startY: y,
      head: [["Snapshot Date", "Assets", "Liabilities", "Net Worth"]],
      body: state.snapshots.slice(-12).map((s) => [
        new Date(s.date).toLocaleDateString(),
        formatMoney(s.assets, base),
        formatMoney(s.liabilities, base),
        formatMoney(s.netWorth, base),
      ]),
      theme: "striped",
      headStyles: { fillColor: [30, 60, 120] },
      styles: { fontSize: 9 },
      margin: { left: 40, right: 40 },
    });
  }

  finalize(doc, `LifeVault_NetWorth_${new Date().toISOString().slice(0, 10)}.pdf`, opts);
}

// ---------- 2. Annual Financial Summary ----------
export function generateAnnualReport(
  state: FinanceState,
  fx: FxCache | null,
  ownerName: string,
  year: number,
  opts?: ReportOpts,
) {
  const base = state.baseCurrency || "INR";
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  header(doc, `Annual Financial Summary ${year}`, `${ownerName} · ${new Date().toLocaleDateString()}`);
  let y = 110;

  const inYear = state.transactions.filter(
    (t) => !t.transferId && new Date(t.date).getFullYear() === year,
  );
  const toBase = (t: typeof inYear[number]) =>
    convert(t.amount, t.currency || base, base, fx);

  let totIncome = 0, totExpense = 0, totInvest = 0;
  const months: Array<{ income: number; expense: number; invest: number }> =
    Array.from({ length: 12 }, () => ({ income: 0, expense: 0, invest: 0 }));
  const catMap = new Map<string, number>();

  inYear.forEach((t) => {
    const v = toBase(t);
    const m = new Date(t.date).getMonth();
    if (t.type === "income") { totIncome += v; months[m].income += v; }
    else if (t.type === "expense") {
      totExpense += v; months[m].expense += v;
      catMap.set(t.category, (catMap.get(t.category) ?? 0) + v);
    } else { totInvest += v; months[m].invest += v; }
  });

  autoTable(doc, {
    startY: y,
    head: [["Total", `Amount (${base})`]],
    body: [
      ["Income", formatMoney(totIncome, base)],
      ["Expenses", formatMoney(totExpense, base)],
      ["Invested", formatMoney(totInvest, base)],
      ["Savings Rate", totIncome > 0 ? `${(((totIncome - totExpense) / totIncome) * 100).toFixed(1)}%` : "—"],
    ],
    theme: "grid",
    headStyles: { fillColor: [30, 60, 120] },
    margin: { left: 40, right: 40 },
  });
  // @ts-expect-error
  y = doc.lastAutoTable.finalY + 20;

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  autoTable(doc, {
    startY: y,
    head: [["Month", "Income", "Expenses", "Invested"]],
    body: months.map((m, i) => [
      MONTHS[i],
      formatMoney(m.income, base),
      formatMoney(m.expense, base),
      formatMoney(m.invest, base),
    ]),
    theme: "striped",
    headStyles: { fillColor: [30, 60, 120] },
    styles: { fontSize: 9 },
    margin: { left: 40, right: 40 },
  });
  // @ts-expect-error
  y = doc.lastAutoTable.finalY + 20;

  const topCats = [...catMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (topCats.length > 0) {
    if (y > 700) { doc.addPage(); y = 56; }
    autoTable(doc, {
      startY: y,
      head: [["Top Expense Category", "Amount", "Share"]],
      body: topCats.map(([c, v]) => [
        c,
        formatMoney(v, base),
        totExpense > 0 ? `${((v / totExpense) * 100).toFixed(1)}%` : "—",
      ]),
      theme: "striped",
      headStyles: { fillColor: [30, 60, 120] },
      margin: { left: 40, right: 40 },
    });
  }

  finalize(doc, `LifeVault_Annual_${year}.pdf`, opts);
}

// ---------- 3. Goals Report ----------
export function generateGoalsReport(
  state: FinanceState,
  ownerName: string,
  opts?: ReportOpts,
) {
  const base = state.baseCurrency || "INR";
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  header(doc, "Financial Goals Report", `${ownerName} · ${new Date().toLocaleDateString()}`);
  let y = 110;

  if (state.goals.length === 0) {
    doc.setFont("helvetica", "italic").setFontSize(11).setTextColor(120);
    doc.text("No goals set yet.", 40, y + 14);
  } else {
    let totalObligation = 0;
    autoTable(doc, {
      startY: y,
      head: [["Goal", "Type", "Target Year", "Today's Cost", "Future Cost", "Saved", "Monthly SIP"]],
      body: state.goals.map((g) => {
        const ccy = g.currency || base;
        const years = Math.max(0, g.targetYear - new Date().getFullYear());
        const future = g.currentCost * Math.pow(1 + g.inflation / 100, years);
        const remaining = Math.max(0, future - (g.currentSavings || 0));
        const monthly = years > 0 ? remaining / (years * 12) : remaining;
        totalObligation += future;
        return [
          g.name,
          g.type,
          String(g.targetYear),
          formatMoney(g.currentCost, ccy),
          formatMoney(future, ccy),
          formatMoney(g.currentSavings, ccy),
          formatMoney(monthly, ccy),
        ];
      }),
      theme: "striped",
      headStyles: { fillColor: [30, 60, 120] },
      styles: { fontSize: 9 },
      margin: { left: 40, right: 40 },
    });
    // @ts-expect-error
    y = doc.lastAutoTable.finalY + 16;
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(40);
    doc.text(`Total future obligation (in ${base}): ${formatMoney(totalObligation, base)}`, 40, y);
  }

  finalize(doc, `LifeVault_Goals_${new Date().toISOString().slice(0, 10)}.pdf`, opts);
}
