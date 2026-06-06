import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { FinanceState } from "./finance-context";
import { sumAssets, sumLiabilities, accountBalance } from "./finance-context";
import { convert, formatMoney, type FxCache } from "./currency";
import { formatINR } from "./finance-utils";

const mask = (s: string | undefined, last = 4): string => {
  if (!s) return "—";
  const t = String(s).replace(/\s+/g, "");
  if (t.length <= last) return "•".repeat(t.length);
  return "••••" + t.slice(-last);
};

export function generateEmergencyReport(
  state: FinanceState,
  fx: FxCache | null,
  ownerName: string,
  personalNote: string,
) {
  const base = state.baseCurrency || "INR";
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  let y = 56;

  // Header
  doc.setFont("helvetica", "bold").setFontSize(22).setTextColor(170, 30, 50);
  doc.text("In Case of Emergency", 40, y);
  y += 22;
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(120);
  doc.text(`Prepared by ${ownerName} · ${new Date().toLocaleDateString()}`, 40, y);
  y += 14;
  doc.setFontSize(9).setTextColor(160);
  doc.text("Confidential — contains sensitive personal information. Keep secure.", 40, y);
  y += 22;

  const heading = (label: string) => {
    if (y > 740) { doc.addPage(); y = 56; }
    doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(20, 30, 60);
    doc.text(label, 40, y);
    y += 4;
  };

  const finishTable = () => {
    // @ts-expect-error autoTable mutates doc
    y = (doc.lastAutoTable?.finalY ?? y) + 20;
  };

  // 1. KEY CONTACTS
  const contacts = state.vault["contacts"] ?? [];
  heading("1. Key Contacts");
  if (contacts.length === 0) {
    doc.setFont("helvetica", "italic").setFontSize(10).setTextColor(140);
    doc.text("No contacts saved.", 40, y + 14); y += 26;
  } else {
    autoTable(doc, {
      startY: y + 4,
      head: [["Role", "Name", "Phone", "Email", "Organisation"]],
      body: contacts.map((c) => [
        c.fields.role ?? "—",
        c.fields.name ?? "—",
        c.fields.phone ?? "—",
        c.fields.email ?? "—",
        c.fields.org ?? "—",
      ]),
      theme: "striped",
      headStyles: { fillColor: [30, 60, 120] },
      styles: { fontSize: 9 },
      margin: { left: 40, right: 40 },
    });
    finishTable();
  }

  // 2. BANK ACCOUNTS (from accounts, masked)
  heading(`2. Bank Accounts (${state.accounts.filter((a) => a.type === "bank").length})`);
  const banks = state.accounts.filter((a) => a.type === "bank");
  if (banks.length === 0) {
    doc.setFont("helvetica", "italic").setFontSize(10).setTextColor(140);
    doc.text("No bank accounts saved.", 40, y + 14); y += 26;
  } else {
    autoTable(doc, {
      startY: y + 4,
      head: [["Bank", "Type", "Acct (masked)", "Balance", "Net banking"]],
      body: banks.map((a) => [
        a.bank ?? a.name,
        a.accountSubtype ?? "—",
        a.last4 ? `····${a.last4}` : "—",
        formatMoney(accountBalance(state, a.id), a.currency),
        a.loginUrl ? "Credentials stored in vault" : "—",
      ]),
      theme: "striped",
      headStyles: { fillColor: [30, 60, 120] },
      styles: { fontSize: 9 },
      margin: { left: 40, right: 40 },
    });
    finishTable();
  }

  // 3. INSURANCE
  const insurance = state.vault["insurance"] ?? [];
  const totalSI = insurance.reduce((s, p) => s + (Number(p.fields.sumInsured) || 0), 0);
  heading(`3. Insurance Policies — Total Sum Assured ${formatINR(totalSI)}`);
  if (insurance.length === 0) {
    doc.setFont("helvetica", "italic").setFontSize(10).setTextColor(140);
    doc.text("No policies saved.", 40, y + 14); y += 26;
  } else {
    autoTable(doc, {
      startY: y + 4,
      head: [["Type", "Insurer", "Policy", "Sum Assured", "Nominee", "Agent", "Due"]],
      body: insurance.map((p) => [
        p.fields.type ?? "—",
        p.fields.insurer ?? "—",
        p.fields.policy ?? "—",
        p.fields.sumInsured ?? "—",
        p.fields.nominee ?? "—",
        p.fields.agent ?? "—",
        p.fields.due ?? "—",
      ]),
      theme: "striped",
      headStyles: { fillColor: [30, 60, 120] },
      styles: { fontSize: 9 },
      margin: { left: 40, right: 40 },
    });
    finishTable();
  }

  // 4. INVESTMENTS
  const totalInv = state.assets.reduce(
    (s, a) => s + convert(a.value || 0, a.currency || base, base, fx), 0,
  );
  heading(`4. Investments — Total ${formatMoney(totalInv, base)}`);
  if (state.assets.length === 0) {
    doc.setFont("helvetica", "italic").setFontSize(10).setTextColor(140);
    doc.text("No investments saved.", 40, y + 14); y += 26;
  } else {
    autoTable(doc, {
      startY: y + 4,
      head: [["Name", "Type", "Value", "Currency"]],
      body: state.assets.map((a) => [
        a.name,
        a.subtype ?? a.category,
        formatMoney(a.value, a.currency || base),
        a.currency || base,
      ]),
      theme: "striped",
      headStyles: { fillColor: [30, 60, 120] },
      styles: { fontSize: 9 },
      margin: { left: 40, right: 40 },
    });
    finishTable();
  }

  // 5. LIABILITIES
  const totalLiab = sumLiabilities(state, fx, base);
  heading(`5. Loans & Liabilities — Total ${formatMoney(totalLiab, base)}`);
  if (state.liabilities.length === 0) {
    doc.setFont("helvetica", "italic").setFontSize(10).setTextColor(140);
    doc.text("No liabilities saved.", 40, y + 14); y += 26;
  } else {
    autoTable(doc, {
      startY: y + 4,
      head: [["Lender", "Type", "Outstanding", "EMI"]],
      body: state.liabilities.map((l) => [
        l.name,
        l.category,
        formatMoney(l.principal, l.currency || base),
        formatMoney(l.emi, l.currency || base),
      ]),
      theme: "striped",
      headStyles: { fillColor: [30, 60, 120] },
      styles: { fontSize: 9 },
      margin: { left: 40, right: 40 },
    });
    finishTable();
  }

  // 6. DOCUMENTS
  const docs = state.vault["documents"] ?? [];
  heading(`6. Important Documents (${docs.length})`);
  if (docs.length > 0) {
    autoTable(doc, {
      startY: y + 4,
      head: [["Type", "Number (masked)", "Expiry", "Location"]],
      body: docs.map((d) => [
        d.fields.type ?? "—",
        mask(d.fields.number),
        d.fields.expiry ?? "—",
        d.fields.location ?? "—",
      ]),
      theme: "striped",
      headStyles: { fillColor: [30, 60, 120] },
      styles: { fontSize: 9 },
      margin: { left: 40, right: 40 },
    });
    finishTable();
  } else {
    doc.setFont("helvetica", "italic").setFontSize(10).setTextColor(140);
    doc.text("No documents saved.", 40, y + 14); y += 26;
  }

  // 7. ASSETS
  const physAssets = state.vault["assets"] ?? [];
  heading(`7. Physical Assets (${physAssets.length})`);
  if (physAssets.length > 0) {
    autoTable(doc, {
      startY: y + 4,
      head: [["Type", "Description", "Value", "Location"]],
      body: physAssets.map((a) => [
        a.fields.type ?? "—",
        a.fields.description ?? "—",
        a.fields.value ?? "—",
        a.fields.location ?? "—",
      ]),
      theme: "striped",
      headStyles: { fillColor: [30, 60, 120] },
      styles: { fontSize: 9 },
      margin: { left: 40, right: 40 },
    });
    finishTable();
  } else {
    doc.setFont("helvetica", "italic").setFontSize(10).setTextColor(140);
    doc.text("No physical assets saved.", 40, y + 14); y += 26;
  }

  // 8. NOMINEES
  const nominees = state.vault["nominees"] ?? [];
  heading(`8. Nominees (${nominees.length})`);
  if (nominees.length > 0) {
    autoTable(doc, {
      startY: y + 4,
      head: [["Asset / Account", "Nominee", "Relationship", "Share %", "Phone"]],
      body: nominees.map((n) => [
        n.fields.asset ?? "—",
        n.fields.name ?? "—",
        n.fields.relation ?? "—",
        n.fields.share ?? "—",
        n.fields.phone ?? "—",
      ]),
      theme: "striped",
      headStyles: { fillColor: [30, 60, 120] },
      styles: { fontSize: 9 },
      margin: { left: 40, right: 40 },
    });
    finishTable();
  } else {
    doc.setFont("helvetica", "italic").setFontSize(10).setTextColor(140);
    doc.text("No nominees saved.", 40, y + 14); y += 26;
  }

  // 9. DIGITAL ASSETS — counts only
  const pwCount = (state.vault["passwords"] ?? []).length;
  const subs = state.vault["subscriptions"] ?? [];
  heading("9. Digital Assets");
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(60);
  doc.text(`${pwCount} saved password${pwCount === 1 ? "" : "s"} stored in LifeVault vault. Access requires PIN.`, 40, y + 14);
  y += 28;
  if (subs.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Subscription", "Plan", "Amount", "Frequency"]],
      body: subs.map((s) => [
        s.fields.service ?? "—",
        s.fields.plan ?? "—",
        s.fields.amount ?? "—",
        s.fields.freq ?? "—",
      ]),
      theme: "striped",
      headStyles: { fillColor: [30, 60, 120] },
      styles: { fontSize: 9 },
      margin: { left: 40, right: 40 },
    });
    finishTable();
  }

  // 10. PERSONAL NOTE
  if (personalNote.trim()) {
    heading("10. Message to Family");
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(40);
    const lines = doc.splitTextToSize(personalNote, W - 80);
    if (y + lines.length * 14 > 770) { doc.addPage(); y = 56; }
    doc.text(lines, 40, y + 16);
  }

  // Summary header
  const totalA = sumAssets(state, fx, base);
  doc.setPage(1);
  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(80);
  doc.text(`Net Worth: ${formatMoney(totalA - totalLiab, base)}  ·  Assets: ${formatMoney(totalA, base)}  ·  Liabilities: ${formatMoney(totalLiab, base)}`, 40, 38);

  // Footer + watermark on every page
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    // Watermark
    doc.setFont("helvetica", "bold").setFontSize(60).setTextColor(245, 230, 230);
    doc.text("CONFIDENTIAL", W / 2, 420, { align: "center", angle: -30 });
    // Footer
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(150);
    doc.text(`LifeVault · Generated ${new Date().toLocaleDateString()} · Page ${i} of ${pages}`,
      W / 2, doc.internal.pageSize.getHeight() - 20, { align: "center" });
  }

  doc.save(`LifeVault_Emergency_${new Date().toISOString().slice(0, 10)}.pdf`);
}
