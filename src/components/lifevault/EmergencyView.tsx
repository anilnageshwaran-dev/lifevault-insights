import * as React from "react";
import { ArrowLeft, AlertCircle, Lock, FileDown, Save } from "lucide-react";
import { useFinance, accountBalance } from "@/lib/finance-context";
import { useLock } from "@/lib/lock-context";
import { useAuth } from "@/lib/auth-context";
import { PinKeypad } from "./PinKeypad";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/finance-utils";
import { formatMoney } from "@/lib/currency";
import { toast } from "sonner";
import { generateEmergencyReport } from "@/lib/emergency-pdf";

const mask = (s?: string, last = 4) => {
  if (!s) return "—";
  const t = String(s).replace(/\s+/g, "");
  return t.length <= last ? "•".repeat(t.length) : "••••" + t.slice(-last);
};

interface Props {
  onBack: () => void;
}

export function EmergencyView({ onBack }: Props) {
  const { unlock } = useLock();
  const [verified, setVerified] = React.useState(false);
  const [pin, setPin] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (pin.length !== 4) return;
    void (async () => {
      const ok = await unlock(pin);
      if (ok) {
        setVerified(true);
        setPin("");
      } else {
        setErr("Incorrect PIN");
        setPin("");
      }
    })();
  }, [pin, unlock]);

  if (!verified) {
    return (
      <div className="space-y-6 max-w-md mx-auto">
        <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Back to Vault
        </button>
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-center">
          <Lock className="h-8 w-8 text-rose-400 mx-auto" />
          <h2 className="font-display text-2xl mt-3">Confirm your PIN</h2>
          <p className="text-sm text-muted-foreground mt-2">
            The Emergency page contains sensitive personal information. Please re-verify your PIN.
          </p>
          <div className="mt-6">
            <PinKeypad value={pin} onChange={(v) => { setErr(null); setPin(v); }} />
          </div>
          {err && <p className="text-sm text-danger mt-3">{err}</p>}
        </div>
      </div>
    );
  }

  return <EmergencyContent onBack={onBack} />;
}

function EmergencyContent({ onBack }: Props) {
  const { state, setState, fx } = useFinance();
  const { user } = useAuth();
  const base = state.baseCurrency || "INR";
  const [note, setNote] = React.useState<string>(state.emergencyNote ?? "");
  const [savingNote, setSavingNote] = React.useState(false);

  const saveNote = () => {
    setSavingNote(true);
    setState((s) => ({ ...s, emergencyNote: note }));
    setTimeout(() => { setSavingNote(false); toast.success("Note saved"); }, 200);
  };

  const ownerName =
    (user?.user_metadata?.name as string | undefined) ||
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email || "Account holder";

  const contacts = state.vault["contacts"] ?? [];
  const banks = state.accounts.filter((a) => a.type === "bank");
  const insurance = state.vault["insurance"] ?? [];
  const docs = state.vault["documents"] ?? [];
  const physAssets = state.vault["assets"] ?? [];
  const nominees = state.vault["nominees"] ?? [];
  const passwords = state.vault["passwords"] ?? [];
  const subs = state.vault["subscriptions"] ?? [];

  const totalSI = insurance.reduce((s, p) => s + (Number(p.fields.sumInsured) || 0), 0);

  const exportPdf = () => {
    try {
      generateEmergencyReport(state, fx, ownerName, note);
      toast.success("PDF exported");
    } catch (e) {
      toast.error((e as Error).message || "PDF export failed");
    }
  };

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" /> Back to Vault
      </button>

      {/* Header */}
      <div className="rounded-2xl p-6 text-white shadow-lg"
        style={{ background: "linear-gradient(135deg, #be123c 0%, #881337 100%)" }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-4">
            <AlertCircle className="h-10 w-10 mt-1 shrink-0" />
            <div>
              <h1 className="font-display text-3xl">In Case of Emergency</h1>
              <p className="text-sm text-white/80 mt-1">Everything your family needs to know.</p>
              <p className="text-xs text-white/60 mt-2">
                Last viewed: {new Date().toLocaleString()}
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={exportPdf}
            className="gap-2 bg-white/10 border-white/30 text-white hover:bg-white/20 shrink-0">
            <FileDown className="h-4 w-4" /> Export PDF
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-foreground flex items-start gap-2">
        <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
        <p>
          This page contains sensitive information. Do not share screenshots.
          Use Export PDF only for secure physical storage.
        </p>
      </div>

      {/* 1. Contacts */}
      <Section title="1. Key Contacts" count={contacts.length} emptyHint="Add contacts in Vault → Contacts">
        {contacts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {contacts.map((c) => (
              <div key={c.id} className="rounded-lg border border-border bg-background/40 p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium">{c.fields.name || "—"}</div>
                  {c.fields.role && (
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-md border border-primary/30 text-primary bg-primary/10">
                      {c.fields.role}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                  {c.fields.phone && <div><a href={`tel:${c.fields.phone}`} className="hover:underline">{c.fields.phone}</a></div>}
                  {c.fields.email && <div><a href={`mailto:${c.fields.email}`} className="hover:underline">{c.fields.email}</a></div>}
                  {c.fields.org && <div>{c.fields.org}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* 2. Banks */}
      <Section title="2. Bank Accounts" count={banks.length} emptyHint="Add bank accounts in Cash Flow → Accounts">
        {banks.length > 0 && (
          <div className="space-y-2">
            {banks.map((a) => (
              <div key={a.id} className="rounded-lg border border-border bg-background/40 p-3 text-sm">
                <div className="flex justify-between items-baseline gap-2">
                  <div className="font-medium">{a.bank ?? a.name}</div>
                  <div className="tabular">{formatMoney(accountBalance(state, a.id), a.currency)}</div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {a.accountSubtype ?? "Bank"} · ····{a.last4 ?? "----"}
                  {a.loginUrl ? " · Net banking credentials stored in vault" : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* 3. Insurance */}
      <Section title="3. Insurance Policies"
        subtitle={`Total Sum Assured: ${formatINR(totalSI)}`}
        count={insurance.length}
        emptyHint="Add policies in Vault → Insurance">
        {insurance.length > 0 && (
          <div className="space-y-2">
            {insurance.map((p) => (
              <div key={p.id} className="rounded-lg border border-border bg-background/40 p-3 text-sm">
                <div className="flex justify-between gap-2">
                  <div>
                    <div className="font-medium">{p.fields.policy ?? p.title}</div>
                    <div className="text-xs text-muted-foreground">{p.fields.insurer} · {p.fields.type}</div>
                  </div>
                  <div className="text-right">
                    <div className="tabular">{p.fields.sumInsured ?? "—"}</div>
                    <div className="text-[11px] text-muted-foreground">due {p.fields.due ?? "—"}</div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Nominee: {p.fields.nominee ?? "—"} · Agent: {p.fields.agent ?? "—"}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* 4. Investments */}
      <Section title="4. Investments" count={state.assets.length} emptyHint="Add investments in Net Worth → Assets">
        {state.assets.length > 0 && (
          <div className="space-y-2">
            {state.assets.map((a) => (
              <div key={a.id} className="rounded-lg border border-border bg-background/40 p-3 text-sm flex justify-between gap-2">
                <div>
                  <div className="font-medium">{a.name}</div>
                  <div className="text-xs text-muted-foreground">{a.subtype ?? a.category}</div>
                </div>
                <div className="tabular">{formatMoney(a.value, a.currency || base)}</div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* 5. Liabilities */}
      <Section title="5. Loans & Liabilities" count={state.liabilities.length} emptyHint="Add loans in Net Worth → Liabilities">
        {state.liabilities.length > 0 && (
          <div className="space-y-2">
            {state.liabilities.map((l) => (
              <div key={l.id} className="rounded-lg border border-border bg-background/40 p-3 text-sm flex justify-between gap-2">
                <div>
                  <div className="font-medium">{l.name}</div>
                  <div className="text-xs text-muted-foreground">EMI {formatMoney(l.emi, l.currency || base)} · {l.rate}%</div>
                </div>
                <div className="tabular text-danger">{formatMoney(l.principal, l.currency || base)}</div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* 6. Documents */}
      <Section title="6. Important Documents" count={docs.length} emptyHint="Add in Vault → Documents">
        {docs.length > 0 && (
          <div className="space-y-2">
            {docs.map((d) => (
              <div key={d.id} className="rounded-lg border border-border bg-background/40 p-3 text-sm">
                <div className="font-medium">{d.fields.type ?? "—"}</div>
                <div className="text-xs text-muted-foreground">
                  #{mask(d.fields.number)} · expires {d.fields.expiry ?? "—"} · at {d.fields.location ?? "—"}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* 7. Physical Assets */}
      <Section title="7. Physical Assets" count={physAssets.length} emptyHint="Add in Vault → Assets">
        {physAssets.length > 0 && (
          <div className="space-y-2">
            {physAssets.map((a) => (
              <div key={a.id} className="rounded-lg border border-border bg-background/40 p-3 text-sm">
                <div className="font-medium">{a.fields.description ?? a.fields.type}</div>
                <div className="text-xs text-muted-foreground">
                  {a.fields.type} · {a.fields.value ?? "—"} · {a.fields.location ?? "—"}
                  {a.fields.loan ? ` · Loan: ${a.fields.loan}` : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* 8. Nominees */}
      <Section title="8. Nominees Summary" count={nominees.length} emptyHint="Add in Vault → Nominees">
        {nominees.length > 0 && (
          <div className="space-y-2">
            {nominees.map((n) => (
              <div key={n.id} className="rounded-lg border border-border bg-background/40 p-3 text-sm">
                <div className="font-medium">{n.fields.asset ?? "—"}</div>
                <div className="text-xs text-muted-foreground">
                  {n.fields.name} ({n.fields.relation}) · {n.fields.share}% · {n.fields.phone ?? "—"}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* 9. Digital Assets */}
      <Section title="9. Digital Assets">
        <div className="rounded-lg border border-border bg-background/40 p-3 text-sm space-y-2">
          <div>{passwords.length} saved password{passwords.length === 1 ? "" : "s"} stored in LifeVault vault.</div>
          <div className="text-xs text-muted-foreground">Access requires PIN: ••••</div>
          {subs.length > 0 && (
            <div className="pt-2 border-t border-border">
              <div className="text-xs font-medium mb-1">Active subscriptions</div>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {subs.map((s) => (
                  <li key={s.id}>{s.fields.service ?? "—"} — {s.fields.amount ?? "—"} {s.fields.freq ? `/${s.fields.freq}` : ""}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Section>

      {/* 10. Note */}
      <Section title="10. Message to my family">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 1000))}
          rows={6}
          maxLength={1000}
          placeholder="Add any important instructions, wishes, or information for your family here…"
          className="w-full px-3 py-2 rounded-lg bg-background border border-border outline-none focus:border-primary text-sm"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-[11px] text-muted-foreground tabular">{note.length} / 1000</span>
          <Button size="sm" onClick={saveNote} disabled={savingNote} className="gap-1.5">
            <Save className="h-3.5 w-3.5" /> {savingNote ? "Saving…" : "Save note"}
          </Button>
        </div>
      </Section>
    </div>
  );
}

function Section({
  title, subtitle, count, emptyHint, children,
}: {
  title: string; subtitle?: string; count?: number; emptyHint?: string;
  children?: React.ReactNode;
}) {
  const empty = count === 0;
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <h3 className="font-display text-lg">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {typeof count === "number" && (
          <span className="text-[11px] text-muted-foreground tabular">{count} item{count === 1 ? "" : "s"}</span>
        )}
      </div>
      {empty ? (
        <p className="text-xs text-muted-foreground italic">{emptyHint ?? "Nothing to show."}</p>
      ) : (
        children
      )}
    </div>
  );
}
