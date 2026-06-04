import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { FinanceState } from "./finance-context";
import { computeHealthScore, sumAssets, sumLiabilities, assetsByCategory, ASSET_LABELS, accountBalance } from "./finance-context";
import { convert, formatMoney, type FxCache } from "./currency";

export function generateFinancialReport(state: FinanceState, fx: FxCache | null) {
  const base = state.baseCurrency || "INR";
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  let y = 48;

  const today = new Date().toLocaleDateString(undefined, {
    year: "numeric", month: "long", day: "numeric",
  });

  // Header
  doc.setFont("helvetica", "bold").setFontSize(22).setTextColor(20, 30, 60);
  doc.text("LifeVault Financial Snapshot", 40, y);
  y += 22;
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(120);
  doc.text(`Generated ${today} · Base currency ${base}`, 40, y);
  y += 24;

  // Health Score
  const score = computeHealthScore(state, fx);
  doc.setFontSize(14).setTextColor(20, 30, 60).setFont("helvetica", "bold");
  doc.text("Financial Health", 40, y); y += 6;
  autoTable(doc, {
    startY: y + 4,
    head: [["Metric", "Score"]],
    body: [
      ["Total", `${score.total} / 100`],
      ["Emergency Fund", `${Math.round(score.emergency)} / 30`],
      ["Term Insurance", `${Math.round(score.insurance)} / 20`],
      ["Health Insurance", `${Math.round(score.health)} / 20`],
      ["Savings Rate", `${Math.round(score.savings)} / 30`],
    ],
    theme: "grid",
    headStyles: { fillColor: [30, 60, 120] },
    styles: { fontSize: 10 },
    margin: { left: 40, right: 40 },
  });
  // @ts-expect-error autoTable adds lastAutoTable
  y = doc.lastAutoTable.finalY + 24;

  // Net Worth
  const assets = sumAssets(state, fx, base);
  const liabs = sumLiabilities(state, fx, base);
  const byCat = assetsByCategory(state, fx, base);
  doc.setFontSize(14).setFont("helvetica", "bold").setTextColor(20, 30, 60);
  doc.text("Net Worth", 40, y); y += 6;
  autoTable(doc, {
    startY: y + 4,
    head: [["", `Amount (${base})`]],
    body: [
      ["Total Assets", formatMoney(assets, base)],
      ["Total Liabilities", formatMoney(liabs, base)],
      ["Net Worth", formatMoney(assets - liabs, base)],
    ],
    theme: "striped",
    headStyles: { fillColor: [30, 60, 120] },
    styles: { fontSize: 10 },
    margin: { left: 40, right: 40 },
  });
  // @ts-expect-error
  y = doc.lastAutoTable.finalY + 18;

  // Asset Breakdown
  autoTable(doc, {
    startY: y,
    head: [["Asset Class", `Value (${base})`, "Share"]],
    body: (Object.keys(byCat) as Array<keyof typeof byCat>).map((k) => {
      const v = byCat[k];
      const pct = assets > 0 ? ((v / assets) * 100).toFixed(1) + "%" : "—";
      return [ASSET_LABELS[k], formatMoney(v, base), pct];
    }),
    theme: "grid",
    headStyles: { fillColor: [30, 60, 120] },
    styles: { fontSize: 10 },
    margin: { left: 40, right: 40 },
  });
  // @ts-expect-error
  y = doc.lastAutoTable.finalY + 24;

  if (y > 700) { doc.addPage(); y = 48; }

  // Accounts
  doc.setFontSize(14).setFont("helvetica", "bold").setTextColor(20, 30, 60);
  doc.text("Accounts", 40, y); y += 6;
  autoTable(doc, {
    startY: y + 4,
    head: [["Name", "Type", "Currency", "Balance", `~ ${base}`]],
    body: state.accounts.map((a) => {
      const bal = accountBalance(state, a.id);
      return [
        a.name + (a.last4 ? ` ····${a.last4}` : ""),
        a.type,
        a.currency,
        formatMoney(bal, a.currency),
        formatMoney(convert(bal, a.currency, base, fx), base),
      ];
    }),
    theme: "striped",
    headStyles: { fillColor: [30, 60, 120] },
    styles: { fontSize: 9 },
    margin: { left: 40, right: 40 },
  });
  // @ts-expect-error
  y = doc.lastAutoTable.finalY + 24;

  if (y > 700) { doc.addPage(); y = 48; }

  // Goals
  doc.setFontSize(14).setFont("helvetica", "bold").setTextColor(20, 30, 60);
  doc.text("Goals", 40, y); y += 6;
  autoTable(doc, {
    startY: y + 4,
    head: [["Goal", "Target Year", "Target", "Saved", "Progress"]],
    body: state.goals.map((g) => {
      const ccy = g.currency || base;
      const pct = g.currentCost > 0 ? Math.min(100, Math.round((g.currentSavings / g.currentCost) * 100)) : 0;
      return [
        g.name,
        String(g.targetYear),
        formatMoney(g.currentCost, ccy),
        formatMoney(g.currentSavings, ccy),
        `${pct}%`,
      ];
    }),
    theme: "striped",
    headStyles: { fillColor: [30, 60, 120] },
    styles: { fontSize: 9 },
    margin: { left: 40, right: 40 },
  });
  // @ts-expect-error
  y = doc.lastAutoTable.finalY + 24;

  if (y > 680) { doc.addPage(); y = 48; }

  // Regions
  if (state.regions.length > 0) {
    doc.setFontSize(14).setFont("helvetica", "bold").setTextColor(20, 30, 60);
    doc.text("Regions", 40, y); y += 6;
    autoTable(doc, {
      startY: y + 4,
      head: [["Region", "CCY", "Income/mo", "Expenses/mo", "Emergency", "Term", "Health"]],
      body: state.regions.map((r) => [
        `${r.flag ?? ""} ${r.name}`,
        r.currency,
        formatMoney(r.monthlyIncome, r.currency),
        formatMoney(r.monthlyExpenses, r.currency),
        formatMoney(r.emergencyFund, r.currency),
        formatMoney(r.termInsurance, r.currency),
        formatMoney(r.healthInsurance, r.currency),
      ]),
      theme: "grid",
      headStyles: { fillColor: [30, 60, 120] },
      styles: { fontSize: 9 },
      margin: { left: 40, right: 40 },
    });
    // @ts-expect-error
    y = doc.lastAutoTable.finalY + 24;
  }

  // Insurance (from vault)
  const insurance = state.vault["insurance"] ?? [];
  if (insurance.length > 0) {
    if (y > 680) { doc.addPage(); y = 48; }
    doc.setFontSize(14).setFont("helvetica", "bold").setTextColor(20, 30, 60);
    doc.text("Insurance Policies", 40, y); y += 6;
    autoTable(doc, {
      startY: y + 4,
      head: [["Policy", "Insurer", "Type", "Sum Insured", "Premium", "Next Due"]],
      body: insurance.map((p) => [
        p.fields.policy ?? p.title ?? "",
        p.fields.insurer ?? "",
        p.fields.type ?? "",
        p.fields.sumInsured ?? "",
        p.fields.premium ?? "",
        p.fields.due ?? "",
      ]),
      theme: "striped",
      headStyles: { fillColor: [30, 60, 120] },
      styles: { fontSize: 9 },
      margin: { left: 40, right: 40 },
    });
  }

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8).setTextColor(150);
    doc.text(`LifeVault · Page ${i} of ${pages}`, W / 2, doc.internal.pageSize.getHeight() - 20, { align: "center" });
  }

  doc.save(`LifeVault_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
}
