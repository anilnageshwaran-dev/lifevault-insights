import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { Users, Plus, Trash2, Copy, X, Check } from "lucide-react";
import { toast } from "sonner";
import {
  listFamily,
  createFamilyInvite,
  revokeFamilyInvite,
  removeFamilyMember,
} from "@/lib/family.functions";

type Role = "viewer" | "emergency";
type Section = "essentials" | "networth" | "cashflow" | "goals";

const ALL_SECTIONS: { id: Section; label: string }[] = [
  { id: "essentials", label: "Essentials" },
  { id: "networth", label: "Net Worth" },
  { id: "cashflow", label: "Cash Flow" },
  { id: "goals", label: "Goals" },
];

interface Member {
  id: string;
  member_id: string;
  role: Role;
  allowed_sections: string[];
  granted_at: string;
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
}
interface Pending {
  id: string;
  invitee_email: string;
  invitee_name: string;
  role: Role;
  token: string;
  personal_message: string | null;
  invited_at: string;
}

export function FamilyTab() {
  const fetchList = useServerFn(listFamily);
  const [members, setMembers] = React.useState<Member[]>([]);
  const [pending, setPending] = React.useState<Pending[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showInvite, setShowInvite] = React.useState(false);
  const [confirmRemove, setConfirmRemove] = React.useState<Member | null>(null);
  const [confirmRevoke, setConfirmRevoke] = React.useState<Pending | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      const r = await fetchList();
      setMembers(r.members as Member[]);
      setPending(r.pending as Pending[]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [fetchList]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-display text-2xl">Family Access</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Invite family members to view your financial dashboard (read-only).
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-card p-4 md:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Current members</h3>
          <button
            onClick={() => setShowInvite(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Invite Member
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : members.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 flex items-center gap-2">
            <Users className="h-4 w-4" /> No family members yet.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {members.map((m) => {
              const name = m.display_name || m.email || "Family member";
              const initial = (name[0] || "?").toUpperCase();
              return (
                <li key={m.id} className="flex items-center gap-3 py-3">
                  <div className="h-9 w-9 rounded-full bg-primary/15 text-foreground flex items-center justify-center font-display text-sm shrink-0">
                    {initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{name}</div>
                    {m.email && <div className="text-xs text-muted-foreground truncate">{m.email}</div>}
                  </div>
                  <RoleBadge role={m.role} />
                  <button
                    onClick={() => setConfirmRemove(m)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    aria-label="Remove member"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 md:p-5 space-y-3">
        <h3 className="font-medium">Pending invites</h3>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending invites.</p>
        ) : (
          <ul className="divide-y divide-border">
            {pending.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{p.invitee_name}</div>
                  <div className="text-xs text-muted-foreground truncate">{p.invitee_email}</div>
                </div>
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-warning/15 text-warning border border-warning/30">
                  Pending
                </span>
                <CopyLinkButton token={p.token} />
                <button
                  onClick={() => setConfirmRevoke(p)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  aria-label="Revoke invite"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onCreated={() => { setShowInvite(false); void refresh(); }}
        />
      )}

      {confirmRemove && (
        <ConfirmDialog
          title="Remove family member?"
          body={`${confirmRemove.display_name || confirmRemove.email} will lose access to your dashboard immediately.`}
          destructive
          onCancel={() => setConfirmRemove(null)}
          onConfirm={async () => {
            const m = confirmRemove;
            setConfirmRemove(null);
            try {
              await removeFamilyMember({ data: { accessId: m.id } });
              toast.success("Member removed");
              await refresh();
            } catch (e) { toast.error((e as Error).message); }
          }}
        />
      )}

      {confirmRevoke && (
        <ConfirmDialog
          title="Revoke invite?"
          body={`The invite link sent to ${confirmRevoke.invitee_email} will stop working.`}
          destructive
          onCancel={() => setConfirmRevoke(null)}
          onConfirm={async () => {
            const p = confirmRevoke;
            setConfirmRevoke(null);
            try {
              await revokeFamilyInvite({ data: { inviteId: p.id } });
              toast.success("Invite revoked");
              await refresh();
            } catch (e) { toast.error((e as Error).message); }
          }}
        />
      )}
    </div>
  );
}

function RoleBadge({ role }: { role: Role }) {
  if (role === "viewer") {
    return (
      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
        Viewer
      </span>
    );
  }
  return (
    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">
      Emergency Only
    </span>
  );
}

function CopyLinkButton({ token }: { token: string }) {
  const [copied, setCopied] = React.useState(false);
  const link = `${typeof window !== "undefined" ? window.location.origin : ""}/accept-invite?token=${token}`;
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(link);
          setCopied(true);
          toast.success("Invite link copied");
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Copy failed — long-press the link to copy manually");
        }
      }}
      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs hover:bg-accent"
      title={link}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-positive" /> : <Copy className="h-3.5 w-3.5" />}
      <span>{copied ? "Copied" : "Copy link"}</span>
    </button>
  );
}

function InviteModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const createFn = useServerFn(createFamilyInvite);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<Role>("viewer");
  const [sections, setSections] = React.useState<Section[]>([...ALL_SECTIONS.map((s) => s.id)]);
  const [msg, setMsg] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [createdLink, setCreatedLink] = React.useState<string | null>(null);

  const toggle = (id: Section) =>
    setSections((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setSubmitting(true);
    try {
      const r = await createFn({
        data: {
          invitee_name: name.trim(),
          invitee_email: email.trim(),
          role,
          allowed_sections: sections,
          personal_message: msg.trim() || null,
        },
      });
      const link = `${window.location.origin}/accept-invite?token=${r.invite.token}`;
      try {
        await navigator.clipboard.writeText(link);
        toast.success(`Invite link for ${r.invite.invitee_email} copied to clipboard`);
      } catch {
        toast.success(`Invite created for ${r.invite.invitee_email}`);
      }
      setCreatedLink(link);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-card border border-border p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 mb-4">
          <h3 className="font-display text-xl">Invite family member</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {createdLink ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Share this link with them — it's been copied to your clipboard. They'll sign in with the email you provided.
            </p>
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs break-all font-mono">
              {createdLink}
            </div>
            <button
              onClick={onCreated}
              className="w-full px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <Field label="Full Name *">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                required
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm"
              />
            </Field>
            <Field label="Email Address *">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={255}
                required
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm"
              />
            </Field>

            <fieldset className="space-y-2">
              <legend className="text-xs uppercase tracking-wider text-muted-foreground">Role *</legend>
              <RoleOption
                checked={role === "viewer"}
                onChange={() => setRole("viewer")}
                title="Viewer"
                desc="Can see Essentials, Net Worth, Cash Flow, and Goals (read-only)"
              />
              <RoleOption
                checked={role === "emergency"}
                onChange={() => setRole("emergency")}
                title="Emergency Only"
                desc="Can only see the Emergency page in the Vault section"
              />
            </fieldset>

            {role === "viewer" && (
              <fieldset className="space-y-2">
                <legend className="text-xs uppercase tracking-wider text-muted-foreground">Sections</legend>
                {ALL_SECTIONS.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={sections.includes(s.id)}
                      onChange={() => toggle(s.id)}
                      className="rounded"
                    />
                    {s.label}
                  </label>
                ))}
                <p className="text-xs text-muted-foreground italic">Vault is always hidden and cannot be enabled.</p>
              </fieldset>
            )}

            <Field label={`Personal message (optional, ${msg.length}/200)`}>
              <textarea
                value={msg}
                onChange={(e) => setMsg(e.target.value.slice(0, 200))}
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm resize-none"
                placeholder="Hi mom, here's access to my LifeVault…"
              />
            </Field>

            <button
              type="submit"
              disabled={submitting}
              className="w-full px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
            >
              {submitting ? "Creating…" : "Create invite & copy link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function RoleOption({
  checked, onChange, title, desc,
}: { checked: boolean; onChange: () => void; title: string; desc: string }) {
  return (
    <label
      className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
        checked ? "border-primary/60 bg-primary/5" : "border-border hover:bg-accent"
      }`}
    >
      <input type="radio" checked={checked} onChange={onChange} className="mt-1" />
      <div className="min-w-0">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </label>
  );
}

function ConfirmDialog({
  title, body, destructive, onCancel, onConfirm,
}: {
  title: string; body: string; destructive?: boolean;
  onCancel: () => void; onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-card border border-border p-6 space-y-4">
        <h3 className="font-display text-lg">{title}</h3>
        <p className="text-sm text-muted-foreground">{body}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-2 rounded-lg text-sm hover:bg-accent">Cancel</button>
          <button
            onClick={onConfirm}
            className={`px-3 py-2 rounded-lg text-sm font-medium ${
              destructive
                ? "bg-destructive text-destructive-foreground hover:opacity-90"
                : "bg-primary text-primary-foreground hover:opacity-90"
            }`}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
