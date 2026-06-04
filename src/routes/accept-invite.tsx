import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Loader2, Users, CheckCircle2, AlertCircle } from "lucide-react";
import { getInviteByToken, acceptInvite } from "@/lib/households.functions";
import { useAuth } from "@/lib/auth-context";
import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

export const Route = createFileRoute("/accept-invite")({
  validateSearch: (s) => z.object({ token: z.string().optional() }).parse(s),
  head: () => ({ meta: [{ title: "Accept Invite — LifeVault" }] }),
  component: () => (
    <AuthProvider>
      <AcceptInvitePage />
      <Toaster richColors theme="system" position="top-right" />
    </AuthProvider>
  ),
});

function AcceptInvitePage() {
  const { token } = Route.useSearch();
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const lookup = useServerFn(getInviteByToken);
  const accept = useServerFn(acceptInvite);

  const [info, setInfo] = React.useState<{
    householdName: string | null;
    email: string | null;
    status: "loading" | "valid" | "invalid" | "expired" | "used";
  }>({ householdName: null, email: null, status: "loading" });
  const [accepting, setAccepting] = React.useState(false);

  React.useEffect(() => {
    if (!token) {
      setInfo({ householdName: null, email: null, status: "invalid" });
      return;
    }
    lookup({ data: { token } })
      .then((r) => {
        if (!r.invite) return setInfo({ householdName: null, email: null, status: "invalid" });
        if (r.invite.accepted_at)
          return setInfo({ householdName: r.householdName, email: r.invite.email, status: "used" });
        if (new Date(r.invite.expires_at) < new Date())
          return setInfo({ householdName: r.householdName, email: r.invite.email, status: "expired" });
        setInfo({ householdName: r.householdName, email: r.invite.email, status: "valid" });
      })
      .catch(() => setInfo({ householdName: null, email: null, status: "invalid" }));
  }, [token, lookup]);

  React.useEffect(() => {
    if (token) {
      try {
        localStorage.setItem("lifevault_pending_invite", token);
      } catch {}
    }
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    setAccepting(true);
    try {
      await accept({ data: { token } });
      try {
        localStorage.removeItem("lifevault_pending_invite");
      } catch {}
      toast.success("Joined household");
      navigate({ to: "/" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-xl">Household invite</h1>
            <p className="text-sm text-muted-foreground">Join a family on LifeVault</p>
          </div>
        </div>

        {info.status === "loading" || loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : info.status === "invalid" ? (
          <div className="flex items-start gap-2 text-sm">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>This invite link is invalid.</div>
          </div>
        ) : info.status === "expired" ? (
          <div className="flex items-start gap-2 text-sm">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>This invite has expired. Ask the owner to send a new one.</div>
          </div>
        ) : info.status === "used" ? (
          <div className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div>This invite has already been used.</div>
          </div>
        ) : (
          <>
            <div className="rounded-lg bg-muted/40 p-4 text-sm space-y-1">
              <div>
                You've been invited to join{" "}
                <span className="font-medium text-foreground">{info.householdName ?? "a household"}</span>.
              </div>
              {info.email && (
                <div className="text-xs text-muted-foreground">Invite sent to {info.email}</div>
              )}
            </div>

            {!session ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Sign in or create an account first — we'll bring you right back here.
                </p>
                <button
                  onClick={() => navigate({ to: "/" })}
                  className="w-full px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
                >
                  Sign in / Sign up
                </button>
              </div>
            ) : (
              <button
                onClick={handleAccept}
                disabled={accepting}
                className="w-full px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
              >
                {accepting ? "Joining…" : "Accept & join"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
