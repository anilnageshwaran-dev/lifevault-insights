import * as React from "react";
import {
  Search,
  Plus,
  ArrowLeft,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  Pencil,
  Save,
  Lock,
  AlertTriangle,
  AlertCircle,
  ChevronRight,
  X,
} from "lucide-react";
import { useFinance, type VaultRecord } from "@/lib/finance-context";
import { uid } from "@/lib/finance-utils";
import { toast } from "sonner";
import { EmptyState } from "./primitives";
import { computeExpiryAlerts, isDismissed, dismissAlert, type ExpiryAlert } from "@/lib/vault-expiry";
import { evaluatePasswords, type PasswordHealthSummary } from "@/lib/password-health";
import { ShieldCheck, ShieldAlert, ChevronDown } from "lucide-react";
import { EmergencyView } from "./EmergencyView";

interface Field {
  key: string;
  label: string;
  secret?: boolean;
  multiline?: boolean;
  type?: "text" | "number" | "date";
  options?: string[];
}
interface Category {
  id: string;
  name: string;
  emoji: string;
  titleField: string;
  subtitleField?: string;
  fields: Field[];
}

const CATS: Category[] = [

  {
    id: "passwords", name: "Passwords", emoji: "🔑", titleField: "site", subtitleField: "username",
    fields: [
      { key: "site", label: "Site / App Name" }, { key: "category", label: "Category" },
      { key: "username", label: "Username / Email" },
      { key: "password", label: "Password", secret: true },
      { key: "tfa", label: "2FA Method" }, { key: "recovery", label: "Recovery Email" },
      { key: "notes", label: "Notes", multiline: true },
    ],
  },
  {
    id: "insurance", name: "Insurance", emoji: "🛡️", titleField: "policy", subtitleField: "insurer",
    fields: [
      { key: "type", label: "Type (Term / Health / Vehicle / Other)" },
      { key: "policy", label: "Policy Name / Number" },
      { key: "insurer", label: "Insurer" },
      { key: "sumInsured", label: "Sum Insured ₹" },
      { key: "premium", label: "Premium ₹" },
      { key: "frequency", label: "Premium Frequency (Monthly / Yearly)" },
      { key: "due", label: "Next Renewal Date" },
      { key: "members", label: "Covered Members (one per line — Name | Relation | Sum Insured)", multiline: true },
      { key: "nominee", label: "Nominee" },
      { key: "agent", label: "Agent / Contact" },
      { key: "website", label: "Login Website" },
      { key: "username", label: "Login Username" },
      { key: "password", label: "Login Password", secret: true },
      { key: "notes", label: "Notes", multiline: true },
    ],
  },
  {
    id: "documents", name: "Documents", emoji: "📄", titleField: "type", subtitleField: "name",
    fields: [
      { key: "type", label: "Document Type" }, { key: "number", label: "Document Number", secret: true },
      { key: "name", label: "Full Name on Document" }, { key: "issued", label: "Date of Issue" },
      { key: "expiry", label: "Expiry Date" }, { key: "location", label: "Physical Location Note" },
      { key: "notes", label: "Notes", multiline: true },
    ],
  },
  {
    id: "assets", name: "Assets", emoji: "🏢", titleField: "description", subtitleField: "type",
    fields: [
      { key: "type", label: "Asset Type" }, { key: "description", label: "Description" },
      { key: "location", label: "Location / Reg Number" }, { key: "value", label: "Estimated Value ₹" },
      { key: "purchaseDate", label: "Purchase Date" }, { key: "price", label: "Purchase Price ₹" },
      { key: "loan", label: "Linked Loan" }, { key: "notes", label: "Notes", multiline: true },
    ],
  },
  {
    id: "contacts", name: "Contacts", emoji: "👤", titleField: "name", subtitleField: "role",
    fields: [
      { key: "role", label: "Relationship", options: ["Spouse", "Father", "Mother", "Son", "Daughter", "Brother", "Sister", "Grandparent", "Friend", "Doctor", "Lawyer", "Accountant", "Financial Advisor", "Insurance Agent", "Employer", "Landlord", "Neighbour", "Emergency Contact", "Other"] },
      { key: "name", label: "Full Name" },
      { key: "phone", label: "Phone" }, { key: "email", label: "Email" },
      { key: "org", label: "Organisation / Firm" }, { key: "notes", label: "Notes", multiline: true },
    ],
  },
  {
    id: "subscriptions", name: "Subscriptions", emoji: "📱", titleField: "service", subtitleField: "plan",
    fields: [
      { key: "service", label: "Service Name" }, { key: "plan", label: "Plan / Tier" },
      { key: "amount", label: "Amount ₹" }, { key: "freq", label: "Billing Frequency" },
      { key: "due", label: "Next Due" }, { key: "payment", label: "Payment Method" },
      { key: "username", label: "Login Username" },
      { key: "password", label: "Login Password", secret: true },
      { key: "notes", label: "Notes", multiline: true },
    ],
  },
  {
    id: "family", name: "Parents & Family", emoji: "👨‍👩‍👧‍👦", titleField: "name", subtitleField: "relation",
    fields: [
      { key: "name", label: "Full Name" },
      { key: "relation", label: "Relationship", options: ["Father", "Mother", "Spouse", "Son", "Daughter", "Brother", "Sister", "Grandfather", "Grandmother", "Father-in-law", "Mother-in-law", "Other"] },
      { key: "dob", label: "Date of Birth" },
      { key: "phone", label: "Phone" },
      { key: "address", label: "Address", multiline: true },
      { key: "bloodGroup", label: "Blood Group" },
      { key: "idType", label: "Government ID Type" },
      { key: "idNumber", label: "Government ID Number", secret: true },
      { key: "healthPolicy", label: "Health Insurance Policy Number" },
      { key: "healthInsurer", label: "Health Insurer" },
      { key: "healthSumInsured", label: "Health Sum Insured" },
      { key: "healthRenewal", label: "Health Renewal Date" },
      { key: "lifePolicy", label: "Life Insurance Policy Number" },
      { key: "lifeInsurer", label: "Life Insurer" },
      { key: "lifeSumInsured", label: "Life Sum Insured" },
      { key: "lifeNominee", label: "Life Nominee" },
      { key: "doctor", label: "Primary Doctor / Hospital" },
      { key: "conditions", label: "Medical Conditions / Allergies", multiline: true },
      { key: "medications", label: "Current Medications", multiline: true },
      { key: "emergencyContact", label: "Emergency Contact (Name · Phone)" },
      { key: "pensionFund", label: "Pension / Provident Fund Details" },
      { key: "willLocation", label: "Will / Nominee Documents Location" },
      { key: "notes", label: "Notes", multiline: true },
    ],
  },
  {
    id: "nominees", name: "Nominees", emoji: "👨\u200d👩\u200d👧", titleField: "asset", subtitleField: "name",
    fields: [
      { key: "asset", label: "Asset / Account Name" }, { key: "name", label: "Nominee Full Name" },
      { key: "relation", label: "Relationship" }, { key: "share", label: "Share %" },
      { key: "phone", label: "Phone" }, { key: "aadhaar", label: "Aadhaar", secret: true },
      { key: "notes", label: "Notes", multiline: true },
    ],
  },
  {
    id: "notes", name: "Notes", emoji: "📝", titleField: "title",
    fields: [
      { key: "title", label: "Title" }, { key: "body", label: "Body", multiline: true },
      { key: "tags", label: "Tags (comma separated)" },
    ],
  },
  {
    id: "vehicles", name: "Vehicles", emoji: "🚗", titleField: "model", subtitleField: "make",
    fields: [
      { key: "make", label: "Make" }, { key: "model", label: "Model" }, { key: "year", label: "Year" },
      { key: "reg", label: "Registration Number", secret: true },
      { key: "chassis", label: "Chassis Number", secret: true },
      { key: "engine", label: "Engine Number", secret: true },
      { key: "insurance", label: "Insurance Policy Number" },
      { key: "insExpiry", label: "Insurance Expiry" }, { key: "pucExpiry", label: "PUC Expiry" },
      { key: "rcLoc", label: "RC Document Location" }, { key: "notes", label: "Notes", multiline: true },
    ],
  },
  {
    id: "business", name: "Business", emoji: "💼", titleField: "name", subtitleField: "type",
    fields: [
      { key: "name", label: "Business Name" }, { key: "type", label: "Business Type" },
      { key: "regNo", label: "Registration Number" },
      { key: "gstin", label: "GSTIN", secret: true }, { key: "pan", label: "PAN", secret: true },
      { key: "bank", label: "Primary Bank Account Nickname" },
      { key: "username", label: "Login Username" },
      { key: "password", label: "Login Password", secret: true },
      { key: "notes", label: "Notes", multiline: true },
    ],
  },
  {
    id: "education", name: "Education", emoji: "🎓", titleField: "degree", subtitleField: "institution",
    fields: [
      { key: "institution", label: "Institution" }, { key: "degree", label: "Degree / Certificate" },
      { key: "year", label: "Year of Completion" }, { key: "roll", label: "Register / Roll Number" },
      { key: "certLoc", label: "Certificate Location" }, { key: "notes", label: "Notes", multiline: true },
    ],
  },
  {
    id: "medical", name: "Medical", emoji: "🏥", titleField: "type", subtitleField: "doctor",
    fields: [
      { key: "type", label: "Record Type" }, { key: "hospital", label: "Hospital / Clinic" },
      { key: "doctor", label: "Doctor Name" }, { key: "date", label: "Date" },
      { key: "diagnosis", label: "Diagnosis / Description", multiline: true },
      { key: "notes", label: "Notes", multiline: true },
    ],
  },
  {
    id: "travel", name: "Travel Documents", emoji: "✈️", titleField: "type", subtitleField: "country",
    fields: [
      { key: "type", label: "Document Type" }, { key: "country", label: "Country" },
      { key: "number", label: "Document Number", secret: true },
      { key: "issued", label: "Issue Date" }, { key: "expiry", label: "Expiry Date" },
      { key: "authority", label: "Issuing Authority" }, { key: "notes", label: "Notes", multiline: true },
    ],
  },
];

export function VaultView() {
  const { state } = useFinance();
  const [openCat, setOpenCat] = React.useState<Category | null>(null);
  const [openRecord, setOpenRecord] = React.useState<VaultRecord | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [emergencyOpen, setEmergencyOpen] = React.useState(false);

  React.useEffect(() => {
    try {
      if (sessionStorage.getItem("lifevault_vault_open_emergency") === "1") {
        sessionStorage.removeItem("lifevault_vault_open_emergency");
        setEmergencyOpen(true);
        return;
      }
      const initial = sessionStorage.getItem("lifevault_vault_initial_category");
      if (initial) {
        sessionStorage.removeItem("lifevault_vault_initial_category");
        const c = CATS.find((x) => x.id === initial);
        if (c) setOpenCat(c);
      }
    } catch {}
  }, []);

  if (emergencyOpen) {
    return <EmergencyView onBack={() => setEmergencyOpen(false)} />;
  }

  if (openCat && (openRecord || creating)) {
    return (
      <RecordEditor
        category={openCat}
        record={openRecord}
        onBack={() => { setOpenRecord(null); setCreating(false); }}
      />
    );
  }
  if (openCat) {
    return (
      <RecordList
        category={openCat}
        records={state.vault[openCat.id] ?? []}
        onBack={() => setOpenCat(null)}
        onOpen={(r) => setOpenRecord(r)}
        onCreate={() => setCreating(true)}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Emergency CTA */}
      <button
        onClick={() => setEmergencyOpen(true)}
        className="w-full text-left rounded-2xl border-2 border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/15 transition-colors p-4 flex items-center gap-3"
      >
        <div className="h-10 w-10 rounded-xl bg-rose-500/20 flex items-center justify-center shrink-0">
          <AlertCircle className="h-5 w-5 text-rose-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-foreground">🆘 In Case of Emergency</div>
          <div className="text-xs text-muted-foreground">Everything your family needs in one place — PIN required</div>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
      </button>

      <ExpiryAttentionCard vault={state.vault ?? {}} onOpenCategory={(catId) => {
        const c = CATS.find((x) => x.id === catId);
        if (c) setOpenCat(c);
      }} />
      <div className="rounded-2xl border border-border bg-card p-4 flex items-start gap-3">
        <Lock className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <p className="text-sm text-muted-foreground">
          🔒 All vault records are encrypted with your PIN using AES-256-GCM
          encryption. Your encrypted data is stored securely in the cloud. Only
          your PIN can decrypt it — we cannot read your data.
        </p>
      </div>
      <PasswordHealthCard
        records={state.vault?.passwords ?? []}
        onOpen={() => {
          const c = CATS.find((x) => x.id === "passwords");
          if (c) setOpenCat(c);
        }}
      />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {CATS.map((c) => {
          const count = state.vault[c.id]?.length ?? 0;
          return (
            <button
              key={c.id}
              onClick={() => setOpenCat(c)}
              className="rounded-2xl border border-border bg-card hover:bg-accent p-4 text-left transition-all hover:scale-[1.01]"
            >
              <div className="text-3xl mb-2">{c.emoji}</div>
              <div className="font-medium text-foreground">{c.name}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {count} record{count === 1 ? "" : "s"}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RecordList({
  category,
  records,
  onBack,
  onOpen,
  onCreate,
}: {
  category: Category;
  records: VaultRecord[];
  onBack: () => void;
  onOpen: (r: VaultRecord) => void;
  onCreate: () => void;
}) {
  const [q, setQ] = React.useState("");
  const filtered = records.filter(
    (r) =>
      !q ||
      r.title.toLowerCase().includes(q.toLowerCase()) ||
      r.subtitle?.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-accent">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="text-2xl">{category.emoji}</div>
        <h2 className="font-display text-2xl flex-1 min-w-0 truncate">{category.name}</h2>
        <button
          onClick={onCreate}
          aria-label={`Add ${category.name} record`}
          className="h-10 w-10 rounded-full bg-accent text-accent-foreground border border-border flex items-center justify-center hover:bg-accent/80 transition-colors shrink-0"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
      {category.id === "investments" && (
        <div className="rounded-xl border border-border bg-card/50 p-3 text-xs text-muted-foreground">
          Store login credentials and folio details here. Track <strong>value &amp; allocation</strong> under
          <strong> Net Worth → Assets</strong>.
        </div>
      )}
      {category.id === "insurance" && (
        <div className="rounded-xl border border-border bg-card/50 p-3 text-xs text-muted-foreground">
          Keep policy numbers, premiums, and nominee info here. Renewal reminders live under
          <strong> Essentials</strong>.
        </div>
      )}


      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search"
          className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-card border border-border outline-none focus:border-primary"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Lock}
          title={records.length === 0 ? "No records yet" : "No matches"}
          description={
            records.length === 0
              ? "Securely store your sensitive information in this category."
              : "Try a different search."
          }
          cta={
            records.length === 0 && (
              <button
                onClick={onCreate}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm"
              >
                Add first record
              </button>
            )
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <button
              key={r.id}
              onClick={() => onOpen(r)}
              className="w-full text-left rounded-xl border border-border bg-card hover:bg-accent p-4 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-medium text-foreground truncate">
                    {r.title || "(untitled)"}
                  </div>
                  {r.subtitle && (
                    <div className="text-xs text-muted-foreground truncate">{r.subtitle}</div>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground shrink-0 ml-3">
                  {new Date(r.updatedAt).toLocaleDateString()}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

    </div>
  );
}

function RecordEditor({
  category,
  record,
  onBack,
}: {
  category: Category;
  record: VaultRecord | null;
  onBack: () => void;
}) {
  const { state, update } = useFinance();
  const isNew = !record;
  const [editing, setEditing] = React.useState(isNew);
  const [fields, setFields] = React.useState<Record<string, string>>(record?.fields ?? {});
  const [revealed, setRevealed] = React.useState<Record<string, boolean>>({});

  const save = () => {
    const title = fields[category.titleField] ?? "";
    const subtitle = category.subtitleField ? fields[category.subtitleField] : undefined;
    const rec: VaultRecord = {
      id: record?.id ?? uid(),
      title,
      subtitle,
      fields,
      updatedAt: Date.now(),
    };
    const list = state.vault[category.id] ?? [];
    const next = record
      ? list.map((x) => (x.id === record.id ? rec : x))
      : [...list, rec];
    update("vault", { ...state.vault, [category.id]: next });
    toast.success("Saved");
    setEditing(false);
    if (isNew) onBack();
  };

  const del = () => {
    if (!record) return;
    if (!confirm("Delete this record? This cannot be undone.")) return;
    const list = (state.vault[category.id] ?? []).filter((x) => x.id !== record.id);
    update("vault", { ...state.vault, [category.id]: list });
    toast.success("Deleted");
    onBack();
  };

  const copy = async (val: string) => {
    try {
      await navigator.clipboard.writeText(val);
      toast.success("Copied — clears in 30s");
      setTimeout(() => {
        navigator.clipboard.writeText("").catch(() => {});
      }, 30_000);
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-accent">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="font-display text-xl truncate">
            {isNew ? `New ${category.name.replace(/s$/, "")}` : (fields[category.titleField] || "(untitled)")}
          </h2>
        </div>
        <div className="flex gap-2 shrink-0">
          {!editing && !isNew && (
            <>
              <button onClick={() => setEditing(true)} className="p-2 rounded-lg hover:bg-accent" aria-label="Edit">
                <Pencil className="h-4 w-4" />
              </button>
              <button onClick={del} className="p-2 rounded-lg hover:bg-accent text-danger" aria-label="Delete">
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
          {editing && (
            <button
              onClick={save}
              className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm flex items-center gap-1.5"
            >
              <Save className="h-3.5 w-3.5" /> Save
            </button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        {category.fields.map((f) => {
          const val = fields[f.key] ?? "";
          const isRevealed = revealed[f.key];
          if (editing) {
            return (
              <div key={f.key}>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">
                  {f.label}
                </label>
                {f.multiline ? (
                  <textarea
                    value={val}
                    onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })}
                    rows={3}
                    className="mt-1 w-full px-3 py-2 rounded-lg bg-background border border-border outline-none focus:border-primary"
                  />
                ) : f.options ? (
                  <select
                    value={val}
                    onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })}
                    className="mt-1 w-full px-3 py-2 rounded-lg bg-background border border-border outline-none focus:border-primary"
                  >
                    <option value="">Select…</option>
                    {f.options.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={f.secret && !isRevealed ? "password" : "text"}
                    value={val}
                    onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })}
                    className="mt-1 w-full px-3 py-2 rounded-lg bg-background border border-border outline-none focus:border-primary"
                  />
                )}
              </div>
            );
          }
          return (
            <div key={f.key} className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {f.label}
                </div>
                <div className="text-sm text-foreground mt-0.5 break-words">
                  {!val ? (
                    <span className="text-muted-foreground/60">—</span>
                  ) : f.secret && !isRevealed ? (
                    "●●●●●●●●"
                  ) : (
                    val
                  )}
                </div>
              </div>
              {val && f.secret && (
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => setRevealed({ ...revealed, [f.key]: !isRevealed })}
                    className="p-1.5 rounded hover:bg-accent text-muted-foreground"
                    aria-label="Toggle reveal"
                  >
                    {isRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => copy(val)}
                    className="p-1.5 rounded hover:bg-accent text-muted-foreground"
                    aria-label="Copy"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {record && !editing && (
        <div className="text-xs text-muted-foreground">
          Last modified: {new Date(record.updatedAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}

function ExpiryAttentionCard({
  vault,
  onOpenCategory,
}: {
  vault: Record<string, VaultRecord[]>;
  onOpenCategory: (catId: string) => void;
}) {
  const [tick, setTick] = React.useState(0);
  const alerts = React.useMemo(
    () => computeExpiryAlerts(vault).filter((a) => !isDismissed(a)),
    [vault, tick],
  );
  if (alerts.length === 0) return null;
  return (
    <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-4 w-4 text-warning" />
        <h3 className="font-display text-lg">Documents Needing Attention</h3>
      </div>
      <div className="space-y-2">
        {alerts.slice(0, 8).map((a, idx) => {
          const chip =
            a.severity === "critical" ? "text-danger bg-danger/10 border-danger/20"
            : a.severity === "warning" ? "text-warning bg-warning/10 border-warning/20"
            : "text-primary bg-primary/10 border-primary/20";
          const days = a.daysLeft;
          return (
            <div key={`${a.categoryId}:${a.record.id}:${a.field}:${idx}`} className="flex items-center gap-3 rounded-lg bg-background/60 p-2.5">
              <div className="text-lg shrink-0">{a.emoji}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{a.record.title || a.categoryName}</div>
                <div className="text-[11px] text-muted-foreground">
                  {a.fieldLabel} · {a.date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                </div>
              </div>
              <span className={`shrink-0 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-md border tabular ${chip}`}>
                {days < 0 ? `${Math.abs(days)}d ago` : days === 0 ? "Today" : `${days}d`}
              </span>
              <button
                onClick={() => onOpenCategory(a.categoryId)}
                className="text-xs text-primary hover:underline shrink-0"
              >
                View
              </button>
              <button
                onClick={() => { dismissAlert(a); setTick((n) => n + 1); }}
                className="text-muted-foreground hover:text-foreground shrink-0"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PasswordHealthCard({
  records,
  onOpen,
}: {
  records: VaultRecord[];
  onOpen: () => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const summary: PasswordHealthSummary = React.useMemo(
    () => evaluatePasswords(records),
    [records],
  );
  if (summary.total === 0) return null;

  const score = summary.avgScore;
  const ringColor =
    score >= 75 ? "var(--color-positive)" :
    score >= 45 ? "var(--color-warning)" :
    "var(--color-danger)";
  const label =
    score >= 75 ? "Strong" : score >= 45 ? "Fair" : "Needs work";

  // SVG circular gauge
  const R = 32;
  const C = 2 * Math.PI * R;
  const dash = (score / 100) * C;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-4">
        <div className="relative h-20 w-20 shrink-0">
          <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
            <circle cx="40" cy="40" r={R} stroke="var(--border)" strokeWidth="7" fill="none" />
            <circle
              cx="40" cy="40" r={R}
              stroke={ringColor}
              strokeWidth="7"
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${dash} ${C}`}
              style={{ transition: "stroke-dasharray .6s ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-display text-xl tabular">{score}</span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {score >= 75 ? (
              <ShieldCheck className="h-4 w-4 text-positive" />
            ) : (
              <ShieldAlert className="h-4 w-4 text-warning" />
            )}
            <h3 className="font-display text-lg">Password Health · {label}</h3>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {summary.total} password{summary.total === 1 ? "" : "s"} ·{" "}
            <span className="text-danger">{summary.weak} weak</span> ·{" "}
            <span className="text-warning">{summary.fair} fair</span> ·{" "}
            <span className="text-positive">{summary.strong} strong</span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {summary.reused} reused · {summary.missing2FA} without 2FA
          </div>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="p-2 rounded-lg hover:bg-accent shrink-0"
          aria-label="Toggle issues"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2">
          {summary.issues.filter((i) => i.severity !== "strong").slice(0, 8).map((i) => {
            const chip =
              i.severity === "weak" ? "text-danger bg-danger/10 border-danger/20"
              : "text-warning bg-warning/10 border-warning/20";
            return (
              <div key={i.recordId} className="rounded-lg border border-border bg-background/40 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm truncate">{i.site}</div>
                    {i.username && (
                      <div className="text-[11px] text-muted-foreground truncate">{i.username}</div>
                    )}
                  </div>
                  <span className={`shrink-0 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-md border tabular ${chip}`}>
                    {i.score}
                  </span>
                </div>
                {i.issues.length > 0 && (
                  <ul className="mt-1.5 text-[11px] text-muted-foreground list-disc list-inside space-y-0.5">
                    {i.issues.slice(0, 3).map((x, idx) => <li key={idx}>{x}</li>)}
                  </ul>
                )}
              </div>
            );
          })}
          {summary.issues.filter((i) => i.severity !== "strong").length === 0 && (
            <div className="text-xs text-muted-foreground">All passwords look strong — nice work.</div>
          )}
          <button
            onClick={onOpen}
            className="mt-1 text-xs text-primary hover:underline"
          >
            Open Passwords vault →
          </button>
        </div>
      )}
    </div>
  );
}
