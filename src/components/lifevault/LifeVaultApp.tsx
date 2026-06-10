import * as React from "react";
import {
  ShieldCheck, BarChart3, ArrowLeftRight, Target, Lock,
  Settings as SettingsIcon, ChevronLeft, ChevronRight, LayoutDashboard, HelpCircle,
} from "lucide-react";
import { useFinance } from "@/lib/finance-context";
import { useLock } from "@/lib/lock-context";
import { useAuth } from "@/lib/auth-context";
import { HomeView } from "./HomeView";
import { EssentialsView } from "./EssentialsView";
import { NetWorthView } from "./NetWorthView";
import { CashFlowView, QuickAddFab } from "./CashFlowView";
import { GoalsView } from "./GoalsView";
import { VaultView } from "./VaultView";
import { SettingsView } from "./SettingsView";
import { InstallBanner } from "./InstallBanner";
import { LifeVaultIcon } from "./LifeVaultIcon";
import { ProfileDrawer } from "./ProfileDrawer";
import { RemindersBanner } from "./RemindersBanner";
// FeedbackButton merged into QuickAddFab
import { HelpAndTour } from "./HelpAndTour";
import { SipDueSheet } from "./SipDueSheet";
import { useServerFn } from "@tanstack/react-start";
import { listRecentAcceptances } from "@/lib/family.functions";
import { toast } from "sonner";

type TabId = "home" | "essentials" | "networth" | "cashflow" | "goals" | "vault" | "settings";

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "home", label: "Home", icon: LayoutDashboard },
  { id: "essentials", label: "Essentials", icon: ShieldCheck },
  { id: "networth", label: "Net Worth", icon: BarChart3 },
  { id: "cashflow", label: "Cash Flow", icon: ArrowLeftRight },
  { id: "goals", label: "Goals", icon: Target },
  { id: "vault", label: "Vault", icon: Lock },
];

const COLLAPSE_KEY = "lifevault_sidebar_collapsed";

export function LifeVaultApp() {
  const [tab, setTab] = React.useState<TabId>("home");
  const [animKey, setAnimKey] = React.useState(0);
  const [collapsed, setCollapsed] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const { syncStatus } = useFinance();
  const { lock } = useLock();
  const { user } = useAuth();
  const [showHelp, setShowHelp] = React.useState(false);
  const [showTour, setShowTour] = React.useState(false);

  const checkAcceptances = useServerFn(listRecentAcceptances);

  React.useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    try {
      if (localStorage.getItem("lifevault_tour_completed") !== "true") {
        setShowTour(true);
      }
    } catch {}
  }, []);

  // Family-access notifications: surface invites accepted since last seen.
  React.useEffect(() => {
    if (!user) return;
    const key = `lifevault_family_accept_seen_${user.id}`;
    const sinceIso = (() => {
      try { return localStorage.getItem(key) || undefined; } catch { return undefined; }
    })();
    checkAcceptances({ data: sinceIso ? { sinceIso } : {} })
      .then((r) => {
        if (!r.acceptances || r.acceptances.length === 0) return;
        for (const a of r.acceptances.slice(0, 3)) {
          toast.success(
            `${a.invitee_name} accepted your invitation and can now view your dashboard`,
            { duration: 10000, description: a.role === "emergency" ? "Emergency Only access" : "Viewer access" },
          );
        }
        try { localStorage.setItem(key, new Date().toISOString()); } catch {}
      })
      .catch(() => {});
  }, [user, checkAcceptances]);
  const toggleCollapse = () => {
    const v = !collapsed;
    setCollapsed(v);
    localStorage.setItem(COLLAPSE_KEY, v ? "1" : "0");
  };

  const setTabAnimated = (t: TabId) => {
    setTab(t);
    setAnimKey((k) => k + 1);
  };

  const activeLabel =
    tab === "settings" ? "Settings" : TABS.find((t) => t.id === tab)!.label;


  return (
    <div className="min-h-dvh flex bg-background overflow-x-hidden">
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex flex-col shrink-0 border-r border-border bg-sidebar p-3 sticky top-0 h-screen transition-all ${
          collapsed ? "w-16" : "w-60 lg:w-64"
        }`}
      >
        <button
          onClick={() => setProfileOpen(true)}
          className={`flex items-center gap-2 px-2 py-2 mb-6 rounded-xl hover:bg-accent transition-colors text-left ${collapsed ? "justify-center" : ""}`}
          title="Open profile"
          aria-label="Open profile"
        >
          <UserAvatar user={user} size={36} />
          {!collapsed && (
            <div className="flex items-center gap-2 min-w-0">
              <LifeVaultIcon className="h-6 w-6" />
              <div className="min-w-0">
                <div className="font-display text-lg leading-none truncate">LifeVault</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
                  Personal Finance
                </div>
              </div>
            </div>
          )}
        </button>

        <nav className="flex-1 space-y-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTabAnimated(t.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                  active
                    ? "bg-primary/15 text-foreground border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                } ${collapsed ? "justify-center" : ""}`}
                title={collapsed ? t.label : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{t.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className={`pt-3 border-t border-border ${collapsed ? "flex flex-col items-center gap-1" : "flex items-center gap-1"}`}>
          <button
            onClick={() => setTabAnimated("settings")}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              tab === "settings"
                ? "bg-primary/15 text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            } ${collapsed ? "justify-center" : "flex-1"}`}
            title={collapsed ? "Settings" : undefined}
          >
            <SettingsIcon className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Settings</span>}
          </button>
          <button
            onClick={toggleCollapse}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-20 bg-background/85 backdrop-blur-md border-b border-border px-3 py-2.5 flex items-center justify-between">
          <button
            onClick={() => setProfileOpen(true)}
            className="flex items-center gap-2 rounded-lg hover:bg-accent p-1 -m-1 transition-colors text-left"
            aria-label="Open profile"
          >
            <UserAvatar user={user} size={32} />
            <LifeVaultIcon className="h-6 w-6" />
            <div>
              <div className="font-display text-base leading-none">LifeVault</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{activeLabel}</div>
            </div>
          </button>
          <div className="flex items-center gap-1">
            <SyncDot status={syncStatus} compact />
            <button
              onClick={() => setShowHelp(true)}
              className="p-2 rounded-lg text-muted-foreground hover:bg-accent"
              aria-label="Help"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
            <button onClick={lock} className="p-2 rounded-lg text-muted-foreground hover:bg-accent" aria-label="Lock">
              <Lock className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Desktop heading */}
        <div className="hidden md:flex items-end justify-between px-8 pt-8 pb-2 gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">LifeVault</div>
            <h1 className="font-display text-4xl mt-1">{activeLabel}</h1>
          </div>
          <div className="flex items-center gap-2">
            <SyncDot status={syncStatus} />
            <button
              onClick={() => setShowHelp(true)}
              className="p-2.5 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              aria-label="Help"
              title="Help"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
            <button
              onClick={lock}
              className="p-2.5 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              aria-label="Lock vault"
              title="Lock vault"
            >
              <Lock className="h-4 w-4" />
            </button>
          </div>
        </div>

        <RemindersBanner />

        <div
          key={animKey}
          className="px-3 sm:px-4 md:px-8 py-4 md:py-5 pb-28 md:pb-12 animate-[fadeUp_200ms_ease-out]"
        >
          {tab === "home" && <HomeView onNavigate={(t) => setTabAnimated(t)} />}
          {tab === "essentials" && <EssentialsView />}
          {tab === "networth" && <NetWorthView />}
          {tab === "cashflow" && <CashFlowView />}
          {tab === "goals" && <GoalsView />}
          {tab === "vault" && <VaultView />}
          {tab === "settings" && <SettingsView />}
        </div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 border-t border-border bg-background/95 backdrop-blur-md">
        <div className="grid grid-cols-6">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTabAnimated(t.id)}
                className={`flex flex-col items-center gap-1 py-2.5 transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px]">{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {tab !== "settings" && <QuickAddFab />}

      <ProfileDrawer
        open={profileOpen}
        onOpenChange={setProfileOpen}
        onOpenSettings={() => setTabAnimated("settings")}
        onNavigate={(t) => setTabAnimated(t)}
      />


      <InstallBanner />

      <HelpAndTour
        showHelp={showHelp}
        showTour={showTour}
        onCloseHelp={() => setShowHelp(false)}
        onCloseTour={() => {
          setShowTour(false);
          try { localStorage.setItem("lifevault_tour_completed", "true"); } catch {}
        }}
      />

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function UserAvatar({ user, size = 32 }: { user: ReturnType<typeof useAuth>["user"]; size?: number }) {
  const name =
    (user?.user_metadata?.name as string | undefined) ||
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email ||
    "?";
  const avatar = user?.user_metadata?.avatar_url as string | undefined;
  const initials = name.split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  const style = { width: size, height: size };
  if (avatar) {
    return (
      <img
        src={avatar}
        alt={name}
        style={style}
        className="rounded-full object-cover border border-border shrink-0"
      />
    );
  }
  return (
    <div
      style={style}
      className="rounded-full bg-primary/15 text-foreground flex items-center justify-center font-display text-sm shrink-0"
    >
      {initials}
    </div>
  );
}

function SyncDot({
  status,
  compact,
}: {
  status: "idle" | "saving" | "synced" | "cached" | "error";
  compact?: boolean;
}) {
  const map = {
    synced: { color: "bg-positive", label: "Synced" },
    saving: { color: "bg-warning animate-pulse", label: "Saving…" },
    cached: { color: "bg-danger", label: "Cached" },
    error: { color: "bg-danger", label: "Offline" },
    idle: { color: "bg-foreground/30", label: "Ready" },
  } as const;
  const m = map[status];
  return (
    <div className="flex items-center gap-2 px-2 py-1.5">
      <span className={`h-2 w-2 rounded-full ${m.color}`} />
      {!compact && <span className="text-xs text-muted-foreground">{m.label}</span>}
    </div>
  );
}
