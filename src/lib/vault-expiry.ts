import type { VaultRecord } from "./finance-context";

export type ExpirySeverity = "critical" | "warning" | "upcoming";

export interface ExpiryAlert {
  categoryId: string;
  categoryName: string;
  emoji: string;
  record: VaultRecord;
  field: string;
  fieldLabel: string;
  date: Date;
  daysLeft: number;
  severity: ExpirySeverity;
}

interface FieldMap {
  id: string;
  name: string;
  emoji: string;
  fields: { key: string; label: string; format?: "mmYY" }[];
}

// Vault categories and their date-bearing fields. Mirrors VaultView CATS.
const EXPIRY_MAP: FieldMap[] = [
  { id: "documents", name: "Documents", emoji: "📄", fields: [{ key: "expiry", label: "Expiry" }] },
  { id: "cards", name: "Cards", emoji: "💳", fields: [{ key: "expiry", label: "Expiry", format: "mmYY" }] },
  { id: "insurance", name: "Insurance", emoji: "🛡️", fields: [{ key: "due", label: "Next Renewal" }] },
  { id: "investments", name: "Investments", emoji: "📈", fields: [{ key: "maturity", label: "Maturity" }] },
  { id: "subscriptions", name: "Subscriptions", emoji: "🔁", fields: [{ key: "due", label: "Next Due" }, { key: "nextDue", label: "Next Due" }] },
  { id: "vehicles", name: "Vehicles", emoji: "🚗", fields: [
    { key: "insuranceExpiry", label: "Insurance Expiry" },
    { key: "pucExpiry", label: "PUC Expiry" },
  ] },
  { id: "travel", name: "Travel Documents", emoji: "✈️", fields: [{ key: "expiry", label: "Expiry" }] },
  { id: "loans", name: "Loans", emoji: "💰", fields: [{ key: "due", label: "Due" }, { key: "dueDate", label: "Due Date" }] },
];

function parseDate(raw: string | undefined, format?: "mmYY"): Date | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (format === "mmYY") {
    const m = s.match(/^(\d{1,2})\s*[/\-]\s*(\d{2,4})$/);
    if (!m) return null;
    const mm = Number(m[1]);
    let yy = Number(m[2]);
    if (yy < 100) yy += 2000;
    if (!mm || mm < 1 || mm > 12) return null;
    // Card expires at end of month
    return new Date(yy, mm, 0, 23, 59, 59);
  }
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d;
}

function severityFor(daysLeft: number): ExpirySeverity | null {
  if (daysLeft < 30) return "critical";
  if (daysLeft <= 90) return "warning";
  if (daysLeft <= 180) return "upcoming";
  return null;
}

export function computeExpiryAlerts(
  vault: Record<string, VaultRecord[]>,
  now: Date = new Date(),
): ExpiryAlert[] {
  const alerts: ExpiryAlert[] = [];
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  for (const cat of EXPIRY_MAP) {
    const records = vault[cat.id] ?? [];
    for (const rec of records) {
      for (const f of cat.fields) {
        const date = parseDate(rec.fields?.[f.key], f.format);
        if (!date) continue;
        const daysLeft = Math.floor((date.getTime() - today) / 86_400_000);
        const sev = severityFor(daysLeft);
        if (!sev) continue;
        alerts.push({
          categoryId: cat.id,
          categoryName: cat.name,
          emoji: cat.emoji,
          record: rec,
          field: f.key,
          fieldLabel: f.label,
          date,
          daysLeft,
          severity: sev,
        });
      }
    }
  }
  alerts.sort((a, b) => a.daysLeft - b.daysLeft);
  return alerts;
}

const DISMISS_KEY = "lifevault_expiry_dismiss";

function getDismissMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    const now = Date.now();
    const fresh: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "number" && now - v < 7 * 86_400_000) fresh[k] = v;
    }
    return fresh;
  } catch {
    return {};
  }
}

export function isDismissed(alert: ExpiryAlert): boolean {
  const id = `${alert.categoryId}:${alert.record.id}:${alert.field}`;
  return id in getDismissMap();
}

export function dismissAlert(alert: ExpiryAlert): void {
  try {
    const map = getDismissMap();
    map[`${alert.categoryId}:${alert.record.id}:${alert.field}`] = Date.now();
    localStorage.setItem(DISMISS_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}
