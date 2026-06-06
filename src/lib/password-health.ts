// Lightweight password health scoring used by the Vault.
// All evaluation runs locally on already-decrypted data.

import type { VaultRecord } from "@/lib/finance-context";

export type Severity = "weak" | "fair" | "strong";

export interface PasswordIssue {
  recordId: string;
  site: string;
  username: string;
  issues: string[]; // human-readable
  score: number;    // 0..100
  severity: Severity;
}

export interface PasswordHealthSummary {
  total: number;
  avgScore: number;          // 0..100
  weak: number;
  fair: number;
  strong: number;
  reused: number;            // count of passwords that appear in >1 record
  missing2FA: number;
  issues: PasswordIssue[];   // sorted lowest score first
}

export function scorePassword(pwd: string): number {
  if (!pwd) return 0;
  let score = 0;
  const len = pwd.length;
  // length is the dominant factor
  score += Math.min(40, len * 3);
  if (/[a-z]/.test(pwd)) score += 10;
  if (/[A-Z]/.test(pwd)) score += 12;
  if (/[0-9]/.test(pwd)) score += 12;
  if (/[^A-Za-z0-9]/.test(pwd)) score += 16;
  // repetition penalty
  const unique = new Set(pwd).size;
  if (unique / len < 0.5) score -= 15;
  // common patterns
  if (/^[0-9]+$/.test(pwd)) score -= 20;
  if (/^(?:password|qwerty|letmein|admin|welcome|iloveyou|123456)/i.test(pwd)) score -= 40;
  return Math.max(0, Math.min(100, score));
}

export function severityFor(score: number): Severity {
  if (score < 45) return "weak";
  if (score < 75) return "fair";
  return "strong";
}

export function evaluatePasswords(records: VaultRecord[] = []): PasswordHealthSummary {
  const counts = new Map<string, number>();
  for (const r of records) {
    const p = (r.fields?.password ?? "").trim();
    if (p) counts.set(p, (counts.get(p) ?? 0) + 1);
  }

  const issues: PasswordIssue[] = [];
  let total = 0;
  let scoreSum = 0;
  let weak = 0, fair = 0, strong = 0, reused = 0, missing2FA = 0;

  for (const r of records) {
    const pwd = (r.fields?.password ?? "").trim();
    const site = r.title || r.fields?.site || "(untitled)";
    const username = r.fields?.username || "";
    if (!pwd) continue;
    total += 1;

    const list: string[] = [];
    const score = scorePassword(pwd);
    scoreSum += score;
    if (pwd.length < 12) list.push("Less than 12 characters");
    if (!/[A-Z]/.test(pwd)) list.push("No uppercase letter");
    if (!/[0-9]/.test(pwd)) list.push("No digits");
    if (!/[^A-Za-z0-9]/.test(pwd)) list.push("No symbols");
    if ((counts.get(pwd) ?? 0) > 1) { list.push("Reused on other accounts"); reused += 1; }
    if (!(r.fields?.tfa ?? "").trim()) { list.push("No 2FA recorded"); missing2FA += 1; }

    const sev = severityFor(score);
    if (sev === "weak") weak += 1;
    else if (sev === "fair") fair += 1;
    else strong += 1;

    issues.push({
      recordId: r.id,
      site,
      username,
      issues: list,
      score,
      severity: sev,
    });
  }

  issues.sort((a, b) => a.score - b.score);

  return {
    total,
    avgScore: total ? Math.round(scoreSum / total) : 0,
    weak, fair, strong, reused, missing2FA,
    issues,
  };
}
