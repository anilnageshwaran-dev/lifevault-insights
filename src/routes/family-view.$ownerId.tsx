import * as React from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  Loader2, ArrowLeft, Eye, ShieldAlert, TrendingUp, ArrowLeftRight,
  Target, Wallet, AlertCircle,
} from "lucide-react";
import { getFamilyView } from "@/lib/family.functions";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

export const Route = createFileRoute("/family-view/$ownerId")({
  parseParams: (p) => z.object({ ownerId: z.string().uuid() }).parse(p),
  head: () => ({
    meta: [
      { title: "Family View — LifeVault" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <AuthProvider>
      <FamilyViewPage />
      <Toaster richColors theme="system" position="top-right" />
    </AuthProvider>
  ),
});

type Snapshot = {
  display_name: string | null;
  base_currency: string;
  net_worth: number;
  total_assets: number;
  total_liabilities: number;
  monthly_income: number;
  monthly_expenses: number;
  emergency_fund: number;
  goal_count: number;
  account_count: number;
  health_score: number;
  updated_at: string;
} | null;

interface ViewData {
  role: "viewer" | "emergency";
  allowed_sections: string[];
  granted_at: string;
  ownerName: string | null;
  ownerAvatar: string | null;
  snapshot: Snapshot;
}

function FamilyViewPage() {
  const { ownerId } = Route.useParams();
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const fetchView = useServerFn(getFamilyView);
  const [data, setData] = React.useState<ViewData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (authLoading) return;
    if (!session) {
      toast.error("Sign in to view");
      navigate({ to: "/" });
      return;
    }
    fetchView({ data: { ownerId } })
      .then((r) => setData(r as ViewData))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [authLoading, session, ownerId, fetchView, navigate]);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full rounded-2xl border border-border bg-card p-6 text-center space-y-3">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
          <h1 className="font-display text-xl">Access denied</h1>
          <p className="text-sm text-muted-foreground">{error ?? "You don't have access to this dashboard."}</p>
          <Link to="/" className="inline-block px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm">Return home</Link>
        </div>
      </div>
    );
  }

  const ownerLabel = data.ownerName ?? "Family member";
  const isEmergency = data.role === "emergency";

  return (
    <div className="min-h-screen bg-background">
      {/* Distinct banner */}
      <div
        className={`sticky top-0 z-30 border-b ${
          isEmergency
            ? "bg-rose-500/10 border-rose-500/30"
            : "bg-amber-500/10 border-amber-500/30"
        } backdrop-blur-md`}
      >
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            {isEmergency ? (
              <ShieldAlert className="h-5 w-5 text-rose-400 shrink-0" />
            ) : (
              <Eye className="h-5 w-5 text-amber-400 shrink-0" />
            )}
            <div className="min-w-0">
              <div className="font-medium text-sm truncate">
                {isEmergency ? "Emergency Access" : "Viewing"} — {ownerLabel}'s LifeVault
              </div>
              <div className="text-xs text-muted-foreground">
                Read-only · {isEmergency ? "Emergency Only" : "Viewer"}
              </div>
            </div>
          </div>
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 shrink-0">
            <ArrowLeft className="h-3.5 w-3.5" /> Return to my account
          </Link>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6 md:py-8 space-y-5">
        {!data.snapshot ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {ownerLabel} hasn't shared a snapshot yet. Ask them to share their dashboard from
              <span className="font-medium text-foreground"> Settings → Family</span>.
            </p>
          </div>
        ) : isEmergency ? (
          <EmergencyView snapshot={data.snapshot} ownerName={ownerLabel} />
        ) : (
          <ViewerSections snapshot={data.snapshot} allowed={data.allowed_sections} ownerName={ownerLabel} />
        )}
      </main>
    </div>
  );
}

function fmt(currency: string, n: number) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency", currency: currency || "USD", maximumFractionDigits: 0,
    }).format(Number(n));
  } catch {
    return `${currency} ${Number(n).toLocaleString()}`;
  }
}

function ViewerSections({
  snapshot, allowed, ownerName,
}: { snapshot: NonNullable<Snapshot>; allowed: string[]; ownerName: string }) {
  const updated = new Date(snapshot.updated_at);
  return (
    <>
      <p className="text-xs text-muted-foreground">
        Snapshot from {updated.toLocaleDateString()} · {ownerName}
      </p>

      {allowed.includes("networth") && (
        <Card title="Net Worth" icon={TrendingUp}>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Net worth" value={fmt(snapshot.base_currency, snapshot.net_worth)} highlight />
            <Stat label="Assets" value={fmt(snapshot.base_currency, snapshot.total_assets)} />
            <Stat label="Liabilities" value={fmt(snapshot.base_currency, snapshot.total_liabilities)} />
          </div>
          <p className="text-xs text-muted-foreground mt-3">{snapshot.account_count} accounts tracked.</p>
        </Card>
      )}

      {allowed.includes("cashflow") && (
        <Card title="Cash Flow" icon={ArrowLeftRight}>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Monthly income" value={fmt(snapshot.base_currency, snapshot.monthly_income)} />
            <Stat label="Monthly expenses" value={fmt(snapshot.base_currency, snapshot.monthly_expenses)} />
          </div>
          <div className="mt-3 text-sm">
            Net: <span className="font-medium">{fmt(snapshot.base_currency, snapshot.monthly_income - snapshot.monthly_expenses)}</span> / mo
          </div>
        </Card>
      )}

      {allowed.includes("essentials") && (
        <Card title="Essentials" icon={Wallet}>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Emergency fund" value={fmt(snapshot.base_currency, snapshot.emergency_fund)} />
            <Stat label="Health score" value={`${snapshot.health_score}/100`} />
          </div>
        </Card>
      )}

      {allowed.includes("goals") && (
        <Card title="Goals" icon={Target}>
          <p className="text-sm">
            <span className="font-medium">{snapshot.goal_count}</span> active goal{snapshot.goal_count === 1 ? "" : "s"}.
          </p>
        </Card>
      )}

      {allowed.length === 0 && (
        <p className="text-sm text-muted-foreground">No sections have been shared with you.</p>
      )}
    </>
  );
}

function EmergencyView({ snapshot, ownerName }: { snapshot: NonNullable<Snapshot>; ownerName: string }) {
  return (
    <>
      <Card title="In Case of Emergency" icon={ShieldAlert}>
        <p className="text-sm text-muted-foreground">
          You have emergency access to {ownerName}'s LifeVault. Below is a high-level summary —
          full vault contents (passwords, documents) remain encrypted and inaccessible by design.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
          <Stat label="Net worth" value={fmt(snapshot.base_currency, snapshot.net_worth)} highlight />
          <Stat label="Emergency fund" value={fmt(snapshot.base_currency, snapshot.emergency_fund)} />
          <Stat label="Accounts" value={String(snapshot.account_count)} />
        </div>
      </Card>
    </>
  );
}

function Card({
  title, icon: Icon, children,
}: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 font-display ${highlight ? "text-2xl" : "text-lg"}`}>{value}</div>
    </div>
  );
}
