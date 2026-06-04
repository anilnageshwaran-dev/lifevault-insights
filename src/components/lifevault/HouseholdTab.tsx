import * as React from "react";
import { Users, UserPlus, Copy, Trash2, LogOut as LogOutIcon, Crown, Loader2, RefreshCw, TrendingUp, Wallet, Target, ShieldCheck } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useFinance, buildSharedSummary } from "@/lib/finance-context";
import { formatMoney } from "@/lib/currency";
import {
  listHouseholds, createHousehold, renameHousehold, deleteHousehold,
  listMembers, listInvites, inviteMember, revokeInvite,
  removeMember, leaveHousehold,
} from "@/lib/households.functions";
import { upsertSharedSnapshot, listSharedSnapshots } from "@/lib/shared-snapshot.functions";


function getOrigin() {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

export function HouseholdTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const list = useServerFn(listHouseholds);
  const create = useServerFn(createHousehold);
  const rename = useServerFn(renameHousehold);
  const del = useServerFn(deleteHousehold);
  const leave = useServerFn(leaveHousehold);

  const { data, isLoading } = useQuery({
    queryKey: ["households"],
    queryFn: () => list(),
  });

  const [newName, setNewName] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const households = data?.households ?? [];
  React.useEffect(() => {
    if (!selectedId && households.length) setSelectedId(households[0].id);
  }, [households, selectedId]);

  const selected = households.find((h) => h.id === selectedId);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const r = await create({ data: { name: newName.trim() } });
      setNewName("");
      setSelectedId(r.household.id);
      qc.invalidateQueries({ queryKey: ["households"] });
      toast.success("Household created");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async (id: string, name: string) => {
    try {
      await rename({ data: { householdId: id, name } });
      qc.invalidateQueries({ queryKey: ["households"] });
      toast.success("Renamed");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this household? All shared data will be removed.")) return;
    try {
      await del({ data: { householdId: id } });
      setSelectedId(null);
      qc.invalidateQueries({ queryKey: ["households"] });
      toast.success("Deleted");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleLeave = async (id: string) => {
    if (!confirm("Leave this household?")) return;
    try {
      await leave({ data: { householdId: id } });
      setSelectedId(null);
      qc.invalidateQueries({ queryKey: ["households"] });
      toast.success("Left household");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-5">
      <div>
        <h3 className="font-display text-xl flex items-center gap-2">
          <Users className="h-5 w-5" /> Family & Sharing
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Share accounts, transactions, goals, and net-worth with family. Vault stays private to each person.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">Create a household</label>
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Sharma Family"
            className="flex-1 px-3 py-2 rounded-lg bg-background border border-border outline-none focus:border-primary text-sm"
          />
          <button
            onClick={handleCreate}
            disabled={busy || !newName.trim()}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : households.length === 0 ? (
        <p className="text-sm text-muted-foreground">No households yet. Create one above or accept an invite link.</p>
      ) : (
        <>
          <div className="flex gap-2 flex-wrap">
            {households.map((h) => (
              <button
                key={h.id}
                onClick={() => setSelectedId(h.id)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  selectedId === h.id
                    ? "bg-primary/15 border-primary/30 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {h.name}
                {h.role === "owner" && <Crown className="inline h-3 w-3 ml-1.5 text-amber-500" />}
              </button>
            ))}
          </div>

          {selected && (
            <HouseholdDetail
              key={selected.id}
              household={selected}
              currentUserId={user?.id ?? ""}
              onRename={(name) => handleRename(selected.id, name)}
              onDelete={() => handleDelete(selected.id)}
              onLeave={() => handleLeave(selected.id)}
            />
          )}
        </>
      )}
    </div>
  );
}

function HouseholdDetail({
  household,
  currentUserId,
  onRename,
  onDelete,
  onLeave,
}: {
  household: { id: string; name: string; owner_id: string; role: string };
  currentUserId: string;
  onRename: (name: string) => void;
  onDelete: () => void;
  onLeave: () => void;
}) {
  const qc = useQueryClient();
  const isOwner = household.role === "owner";
  const members = useServerFn(listMembers);
  const invites = useServerFn(listInvites);
  const invite = useServerFn(inviteMember);
  const revoke = useServerFn(revokeInvite);
  const remove = useServerFn(removeMember);

  const m = useQuery({
    queryKey: ["household-members", household.id],
    queryFn: () => members({ data: { householdId: household.id } }),
  });
  const i = useQuery({
    queryKey: ["household-invites", household.id],
    queryFn: () => invites({ data: { householdId: household.id } }),
    enabled: isOwner,
  });

  const [name, setName] = React.useState(household.name);
  React.useEffect(() => setName(household.name), [household.name]);

  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const handleInvite = async () => {
    if (!email.trim()) return;
    setBusy(true);
    try {
      await invite({ data: { householdId: household.id, email: email.trim() } });
      setEmail("");
      qc.invalidateQueries({ queryKey: ["household-invites", household.id] });
      toast.success("Invite created — copy the link to send");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async (token: string) => {
    const link = `${getOrigin()}/accept-invite?token=${token}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Invite link copied");
    } catch {
      prompt("Copy this link:", link);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await revoke({ data: { inviteId: id } });
      qc.invalidateQueries({ queryKey: ["household-invites", household.id] });
      toast.success("Invite revoked");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!confirm("Remove this member?")) return;
    try {
      await remove({ data: { householdId: household.id, userId } });
      qc.invalidateQueries({ queryKey: ["household-members", household.id] });
      toast.success("Member removed");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-5 pt-3 border-t border-border">
      {isOwner ? (
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Household name</label>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg bg-background border border-border outline-none focus:border-primary text-sm"
            />
            <button
              onClick={() => onRename(name)}
              disabled={!name.trim() || name === household.name}
              className="px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">
          You are a member of <span className="text-foreground font-medium">{household.name}</span>.
        </div>
      )}

      <FamilyOverview householdId={household.id} currentUserId={currentUserId} />

      <div className="space-y-2">

        <h4 className="text-sm font-medium">Members</h4>
        {m.isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <ul className="space-y-2">
            {(m.data?.members ?? []).map((mem) => (
              <li
                key={mem.user_id}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-medium">
                    {(mem.display_name ?? "?").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm truncate">
                      {mem.display_name ?? "Unnamed"}
                      {mem.user_id === currentUserId && (
                        <span className="text-muted-foreground"> (you)</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground capitalize">{mem.role}</div>
                  </div>
                </div>
                {isOwner && mem.user_id !== currentUserId && (
                  <button
                    onClick={() => handleRemove(mem.user_id)}
                    className="text-xs text-destructive hover:underline"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {isOwner && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Invite a family member
          </h4>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="family@example.com"
              className="flex-1 px-3 py-2 rounded-lg bg-background border border-border outline-none focus:border-primary text-sm"
            />
            <button
              onClick={handleInvite}
              disabled={busy || !email.trim()}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm disabled:opacity-50"
            >
              Create invite
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            We generate a link — share it with them. They'll sign up or sign in and join automatically.
          </p>

          {(i.data?.invites ?? []).length > 0 && (
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Pending invites</div>
              <ul className="space-y-2">
                {(i.data?.invites ?? []).map((inv) => (
                  <li
                    key={inv.id}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2 gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-sm truncate">{inv.email}</div>
                      <div className="text-xs text-muted-foreground">
                        Expires {new Date(inv.expires_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleCopy(inv.token)}
                        title="Copy link"
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleRevoke(inv.id)}
                        title="Revoke"
                        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-accent"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="pt-3 border-t border-border flex gap-2">
        {isOwner ? (
          <button
            onClick={onDelete}
            className="text-sm text-destructive flex items-center gap-1.5 hover:underline"
          >
            <Trash2 className="h-4 w-4" /> Delete household
          </button>
        ) : (
          <button
            onClick={onLeave}
            className="text-sm text-destructive flex items-center gap-1.5 hover:underline"
          >
            <LogOutIcon className="h-4 w-4" /> Leave household
          </button>
        )}
      </div>
    </div>
  );
}

function FamilyOverview({ householdId, currentUserId }: { householdId: string; currentUserId: string }) {
  const qc = useQueryClient();
  const { state, fx } = useFinance();
  const { user } = useAuth();
  const list = useServerFn(listSharedSnapshots);
  const upsert = useServerFn(upsertSharedSnapshot);
  const [pushing, setPushing] = React.useState(false);

  const snaps = useQuery({
    queryKey: ["shared-snapshots", householdId],
    queryFn: () => list({ data: { householdId } }),
  });

  const pushMine = React.useCallback(async () => {
    setPushing(true);
    try {
      const s = buildSharedSummary(state, fx);
      const displayName =
        (user?.user_metadata?.name as string | undefined) ||
        (user?.user_metadata?.full_name as string | undefined) ||
        user?.email ||
        "Me";
      await upsert({ data: { householdId, displayName, ...s } });
      qc.invalidateQueries({ queryKey: ["shared-snapshots", householdId] });
      toast.success("Your snapshot is shared with the household");
    } catch (e) {
      toast.error((e as Error).message || "Couldn't share snapshot");
    } finally {
      setPushing(false);
    }
  }, [householdId, state, fx, user, upsert, qc]);

  // Auto-push once per session per household so members always see fresh numbers.
  const pushedRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (pushedRef.current === householdId) return;
    pushedRef.current = householdId;
    void pushMine();
  }, [householdId, pushMine]);

  const rows = snaps.data?.snapshots ?? [];

  return (
    <div className="space-y-3 pt-3 border-t border-border">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4" /> Family Overview
        </h4>
        <button
          onClick={pushMine}
          disabled={pushing}
          className="text-xs flex items-center gap-1 px-2 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${pushing ? "animate-spin" : ""}`} /> {pushing ? "Sharing…" : "Share my numbers"}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Only high-level totals are shared — net worth, income, expenses, emergency fund, goal & account counts, health score. No accounts, transactions, or passwords leave your device.
      </p>

      {snaps.isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No family member has shared a snapshot yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const isMe = r.user_id === currentUserId;
            const ccy = r.base_currency || "INR";
            const updated = new Date(r.updated_at).toLocaleString();
            return (
              <div key={r.id} className="rounded-lg border border-border p-3 space-y-2 bg-background/40">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">
                    {r.display_name || "Member"} {isMe && <span className="text-xs text-muted-foreground">(you)</span>}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{ccy}</div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <Metric icon={Wallet} label="Net Worth" value={formatMoney(Number(r.net_worth), ccy)} />
                  <Metric icon={TrendingUp} label="Income/mo" value={formatMoney(Number(r.monthly_income), ccy)} />
                  <Metric icon={Wallet} label="Expenses/mo" value={formatMoney(Number(r.monthly_expenses), ccy)} />
                  <Metric icon={ShieldCheck} label="Emergency" value={formatMoney(Number(r.emergency_fund), ccy)} />
                  <Metric icon={Target} label="Goals" value={String(r.goal_count)} />
                  <Metric icon={Wallet} label="Accounts" value={String(r.account_count)} />
                  <Metric icon={ShieldCheck} label="Health Score" value={`${r.health_score}/100`} />
                  <Metric icon={RefreshCw} label="Updated" value={updated} small />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value, small }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; small?: boolean }) {
  return (
    <div className="rounded-md bg-white/[0.02] border border-white/5 px-2 py-1.5">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className={`${small ? "text-[11px]" : "text-sm"} font-medium truncate`}>{value}</div>
    </div>
  );
}

