import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Loader2, Users, CheckCircle2, AlertCircle, Eye, ShieldAlert } from "lucide-react";
import { getInviteByToken, acceptInvite } from "@/lib/households.functions";
import { getFamilyInviteByToken, acceptFamilyInvite } from "@/lib/family.functions";
import { useAuth, AuthProvider } from "@/lib/auth-context";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/accept-invite")({
  validateSearch: (s) => z.object({ token: z.string().optional() }).parse(s),
  head: () => ({
    meta: [
      { title: "Accept Invite — LifeVault" },
      { name: "description", content: "Accept your invite to view a LifeVault dashboard or join a household." },
      { property: "og:title", content: "Accept Invite — LifeVault" },
      { property: "og:description", content: "Accept your invite to view a LifeVault dashboard or join a household." },
      { property: "og:url", content: "https://lifevaultapp.lovable.app/accept-invite" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://lifevaultapp.lovable.app/accept-invite" }],
  }),
  component: () => (
    <AuthProvider>
      <AcceptInvitePage />
      <Toaster richColors theme="system" position="top-right" />
    </AuthProvider>
  ),
});

type FamilyInfo = {
  kind: "family";
  ownerName: string | null;
  role: "viewer" | "emergency";
  personalMessage: string | null;
  status: "valid" | "used" | "revoked" | "expired" | "invalid";
};
type HouseholdInfo = {
  kind: "household";
  householdName: string | null;
  status: "valid" | "used" | "expired" | "invalid";
};
type Info =
  | { kind: "loading" }
  | { kind: "invalid" }
  | FamilyInfo
  | HouseholdInfo;

function AcceptInvitePage() {
  const { token } = Route.useSearch();
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const lookupHousehold = useServerFn(getInviteByToken);
  const lookupFamily = useServerFn(getFamilyInviteByToken);
  const acceptHousehold = useServerFn(acceptInvite);
  const acceptFamily = useServerFn(acceptFamilyInvite);

  const [info, setInfo] = React.useState<Info>({ kind: "loading" });
  const [accepting, setAccepting] = React.useState(false);

  React.useEffect(() => {
    if (token) {
      try { localStorage.setItem("lifevault_pending_invite", token); } catch {}
    }
  }, [token]);

  React.useEffect(() => {
    if (!token) { setInfo({ kind: "invalid" }); return; }
    if (!session) { setInfo({ kind: "loading" }); return; }

    (async () => {
      // Family tokens are UUIDs; household tokens are 48-hex.
      if (UUID_RE.test(token)) {
        try {
          const r = await lookupFamily({ data: { token } });
          if (!r.invite) return setInfo({ kind: "invalid" });
          const ageMs = Date.now() - new Date(r.invite.invited_at).getTime();
          const expired = ageMs > 7 * 24 * 60 * 60 * 1000;
          let status: FamilyInfo["status"] = "valid";
          if (r.invite.status === "revoked") status = "revoked";
          else if (r.invite.status === "active") status = "used";
          else if (expired) status = "expired";
          setInfo({
            kind: "family",
            ownerName: r.ownerName,
            role: r.invite.role,
            personalMessage: r.invite.personal_message,
            status,
          });
          return;
        } catch {
          // fall through to household
        }
      }
      try {
        const r = await lookupHousehold({ data: { token } });
        if (!r.invite) return setInfo({ kind: "invalid" });
        let status: HouseholdInfo["status"] = "valid";
        if (r.invite.accepted_at) status = "used";
        else if (new Date(r.invite.expires_at) < new Date()) status = "expired";
        setInfo({ kind: "household", householdName: r.householdName, status });
      } catch {
        setInfo({ kind: "invalid" });
      }
    })();
  }, [token, session, lookupHousehold, lookupFamily]);

  const handleAccept = async () => {
    if (!token) return;
    setAccepting(true);
    try {
      if (info.kind === "family") {
        const r = await acceptFamily({ data: { token } });
        try { localStorage.removeItem("lifevault_pending_invite"); } catch {}
        toast.success("Access granted");
        navigate({ to: "/family-view/$ownerId", params: { ownerId: r.ownerId } });
      } else if (info.kind === "household") {
        await acceptHousehold({ data: { token } });
        try { localStorage.removeItem("lifevault_pending_invite"); } catch {}
        toast.success("Joined household");
        navigate({ to: "/" });
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAccepting(false);
    }
  };

  const isFamily = info.kind === "family";
  const Icon = isFamily ? Eye : Users;
  const headline = isFamily ? "Family viewer invite" : "Household invite";
  const sub = isFamily
    ? "Read-only access to a family member's LifeVault"
    : "Join a family on LifeVault";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-xl">{headline}</h1>
            <p className="text-sm text-muted-foreground">{sub}</p>
          </div>
        </div>

        {info.kind === "loading" || loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : info.kind === "invalid" ? (
          <Notice icon="error" text="This invite link is invalid." />
        ) : info.kind === "family" ? (
          info.status === "revoked" ? (
            <Notice icon="error" text="This invite has been revoked." />
          ) : info.status === "expired" ? (
            <Notice icon="error" text="This invite has expired. Ask the sender for a new one." />
          ) : info.status === "used" ? (
            <Notice icon="ok" text="This invite has already been accepted." />
          ) : (
            <>
              <div className="rounded-lg bg-muted/40 p-4 text-sm space-y-2">
                <div>
                  <span className="font-medium text-foreground">{info.ownerName ?? "Someone"}</span> invited you to view their LifeVault.
                </div>
                <div className="flex items-center gap-2">
                  {info.role === "viewer" ? (
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">Viewer</span>
                  ) : (
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">Emergency Only</span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {info.role === "viewer" ? "Read-only financial overview" : "Emergency info only"}
                  </span>
                </div>
                {info.personalMessage && (
                  <blockquote className="mt-2 border-l-2 border-primary/40 pl-3 text-sm italic text-muted-foreground">
                    "{info.personalMessage}"
                  </blockquote>
                )}
              </div>
              <AcceptCta session={session} accepting={accepting} onAccept={handleAccept} onSignIn={() => navigate({ to: "/" })} />
            </>
          )
        ) : info.kind === "household" ? (
          info.status === "invalid" ? (
            <Notice icon="error" text="This invite link is invalid." />
          ) : info.status === "expired" ? (
            <Notice icon="error" text="This invite has expired. Ask the owner to send a new one." />
          ) : info.status === "used" ? (
            <Notice icon="ok" text="This invite has already been used." />
          ) : (
            <>
              <div className="rounded-lg bg-muted/40 p-4 text-sm">
                You've been invited to join <span className="font-medium text-foreground">{info.householdName ?? "a household"}</span>.
              </div>
              <AcceptCta session={session} accepting={accepting} onAccept={handleAccept} onSignIn={() => navigate({ to: "/" })} />
            </>
          )
        ) : null}
      </div>
    </div>
  );
}

function Notice({ icon, text }: { icon: "error" | "ok"; text: string }) {
  const Ico = icon === "error" ? AlertCircle : CheckCircle2;
  return (
    <div className="flex items-start gap-2 text-sm">
      <Ico className={`h-5 w-5 shrink-0 mt-0.5 ${icon === "error" ? "text-destructive" : "text-muted-foreground"}`} />
      <div>{text}</div>
    </div>
  );
}

function AcceptCta({
  session, accepting, onAccept, onSignIn,
}: { session: unknown; accepting: boolean; onAccept: () => void; onSignIn: () => void }) {
  if (!session) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground flex items-start gap-2">
          <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
          Sign in or create an account first — we'll bring you right back here.
        </p>
        <button onClick={onSignIn} className="w-full px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
          Sign in / Sign up
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={onAccept}
      disabled={accepting}
      className="w-full px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
    >
      {accepting ? "Accepting…" : "Accept invitation"}
    </button>
  );
}
