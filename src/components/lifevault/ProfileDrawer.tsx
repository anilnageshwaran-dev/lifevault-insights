import * as React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { useLock } from "@/lib/lock-context";
import { useFinance, sumAssets, sumLiabilities } from "@/lib/finance-context";
import { formatCompact, formatMoney } from "@/lib/currency";
import {
  Settings as SettingsIcon,
  Sun,
  Moon,
  LogOut,
  RefreshCw,
  Wallet,
  CalendarClock,
  ShieldCheck,
  Globe,
  Sparkles,
} from "lucide-react";
import { LifeVaultIcon } from "./LifeVaultIcon";
import { CurrencySelect } from "./CurrencySelect";
import { WhatsNewDialog } from "./WhatsNewDialog";
import { APP_VERSION } from "@/lib/changelog";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenSettings: () => void;
}

export function ProfileDrawer({ open, onOpenChange, onOpenSettings }: Props) {
  const { user, signOut } = useAuth();
  const { resolved, setMode } = useTheme();
  const { lock } = useLock();
  const { state, update, fx, syncStatus, lastSyncedAt, syncNow } = useFinance();
  const [syncing, setSyncing] = React.useState(false);
  const [whatsNewOpen, setWhatsNewOpen] = React.useState(false);

  const name =
    (user?.user_metadata?.name as string | undefined) ||
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email ||
    "Signed in";
  const avatar = user?.user_metadata?.avatar_url as string | undefined;
  const initials = (name || "?")
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const hour = new Date().getHours();
  const partOfDay =
    hour < 5 ? "night" : hour < 12 ? "morning" : hour < 17 ? "afternoon" : hour < 21 ? "evening" : "night";
  const firstName = (name || "").split(/[\s@]/)[0];

  const base = state.baseCurrency || "INR";
  const assets = sumAssets(state, fx, base);
  const liabilities = sumLiabilities(state, fx, base);
  const netWorth = assets - liabilities;
  const monthlyIncome = state.regions.reduce((s, r) => s + (r.monthlyIncome || 0), 0);
  const monthlyExpenses = state.regions.reduce((s, r) => s + (r.monthlyExpenses || 0), 0);
  const savingsRate =
    monthlyIncome > 0 ? Math.round(((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100) : 0;

  const today = new Date();
  const in7 = new Date();
  in7.setDate(today.getDate() + 7);
  const dueBills = (state.bills || [])
    .filter((b) => {
      const d = new Date(b.nextDue);
      return d >= new Date(today.toDateString()) && d <= in7;
    })
    .sort((a, b) => +new Date(a.nextDue) - +new Date(b.nextDue));
  const overdueBills = (state.bills || []).filter((b) => new Date(b.nextDue) < new Date(today.toDateString()));
  const goalsNearTarget = (state.goals || []).filter(
    (g) => g.currentCost > 0 && g.currentSavings / g.currentCost >= 0.8,
  ).length;

  const toggleTheme = () => setMode(resolved === "dark" ? "light" : "dark");

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncNow();
      toast.success("Synced");
    } catch {
      toast.error("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const syncLabel =
    syncStatus === "saving" || syncing
      ? "Syncing…"
      : syncStatus === "error"
        ? "Offline"
        : syncStatus === "synced"
          ? lastSyncedAt
            ? `Synced ${timeAgo(lastSyncedAt)}`
            : "Synced"
          : "Ready";
  const syncDot =
    syncStatus === "saving" || syncing
      ? "bg-warning animate-pulse"
      : syncStatus === "error"
        ? "bg-danger"
        : syncStatus === "synced"
          ? "bg-positive"
          : "bg-foreground/30";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="p-0 flex flex-col w-[88vw] max-w-sm">
        <SheetHeader className="p-5 pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <LifeVaultIcon className="h-10 w-10" />
            <SheetTitle className="font-display text-lg">LifeVault</SheetTitle>
          </div>
        </SheetHeader>

        <div className="p-5 flex-1 overflow-y-auto space-y-6">
          {/* Profile header */}
          <div className="flex items-center gap-3">
            {avatar ? (
              <img src={avatar} alt={name} className="h-16 w-16 rounded-full object-cover border border-border" />
            ) : (
              <div className="h-16 w-16 rounded-full bg-primary/15 text-foreground flex items-center justify-center font-display text-xl">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Good {partOfDay},</div>
              <div className="font-display text-lg truncate">{firstName || "there"} 👋</div>
              {user?.email && (
                <div className="text-[11px] text-muted-foreground truncate">{user.email}</div>
              )}
            </div>
          </div>

          {/* Quick stats */}
          <Section icon={Wallet} title="Quick stats">
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Net worth" value={formatCompact(netWorth, base)} tone={netWorth >= 0 ? "pos" : "neg"} />
              <Stat label="Savings rate" value={`${savingsRate}%`} tone={savingsRate >= 20 ? "pos" : savingsRate >= 0 ? "neutral" : "neg"} />
              <Stat label="Assets" value={formatCompact(assets, base)} />
              <Stat label="Liabilities" value={formatCompact(liabilities, base)} />
            </div>
          </Section>

          {/* Today's agenda */}
          <Section icon={CalendarClock} title="Today's agenda">
            {overdueBills.length === 0 && dueBills.length === 0 && goalsNearTarget === 0 ? (
              <p className="text-xs text-muted-foreground">Nothing urgent. Enjoy your {partOfDay}.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {overdueBills.length > 0 && (
                  <li className="flex justify-between text-danger">
                    <span>Overdue bills</span>
                    <span className="font-medium">{overdueBills.length}</span>
                  </li>
                )}
                {dueBills.slice(0, 3).map((b) => (
                  <li key={b.id} className="flex justify-between gap-2">
                    <span className="truncate text-muted-foreground">{b.name}</span>
                    <span className="tabular-nums">
                      {formatMoney(b.amount, b.currency || base)} ·{" "}
                      {new Date(b.nextDue).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                    </span>
                  </li>
                ))}
                {dueBills.length > 3 && (
                  <li className="text-xs text-muted-foreground">+ {dueBills.length - 3} more this week</li>
                )}
                {goalsNearTarget > 0 && (
                  <li className="flex justify-between text-positive">
                    <span>Goals near target</span>
                    <span className="font-medium">{goalsNearTarget}</span>
                  </li>
                )}
              </ul>
            )}
          </Section>

          {/* Sync status */}
          <Section icon={RefreshCw} title="Backup & sync">
            <div className="flex items-center gap-2 text-sm">
              <span className={`h-2 w-2 rounded-full ${syncDot}`} />
              <span className="text-muted-foreground flex-1">{syncLabel}</span>
              <button
                onClick={handleSync}
                disabled={syncing || syncStatus === "saving"}
                className="text-xs px-2.5 py-1 rounded-md border border-border hover:bg-accent disabled:opacity-50"
              >
                Sync now
              </button>
            </div>
          </Section>

          {/* Currency & locale */}
          <Section icon={Globe} title="Currency">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <CurrencySelect
                  value={base}
                  onChange={(c) => {
                    update("baseCurrency", c);
                    toast.success(`Base set to ${c}`);
                  }}
                />
              </div>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Totals across regions convert to this currency.
            </p>
          </Section>

          {/* Security */}
          <Section icon={ShieldCheck} title="Security">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  onOpenChange(false);
                  onOpenSettings();
                }}
                className="px-3 py-2 rounded-lg border border-border text-xs hover:bg-accent text-left"
              >
                Change PIN
              </button>
              <button
                onClick={() => {
                  onOpenChange(false);
                  lock();
                }}
                className="px-3 py-2 rounded-lg border border-border text-xs hover:bg-accent text-left"
              >
                Lock now
              </button>
            </div>
          </Section>

          <button
            onClick={() => setWhatsNewOpen(true)}
            className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            <Sparkles className="h-3.5 w-3.5" />
            What's new · v{APP_VERSION}
          </button>
        </div>

        <WhatsNewDialog open={whatsNewOpen} onOpenChange={setWhatsNewOpen} />

        <div className="border-t border-border p-3 grid grid-cols-2 gap-2">
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-border text-sm hover:bg-accent transition-colors"
          >
            {resolved === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {resolved === "dark" ? "Light" : "Dark"}
          </button>
          <button
            onClick={() => {
              onOpenChange(false);
              onOpenSettings();
            }}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-border text-sm hover:bg-accent transition-colors"
          >
            <SettingsIcon className="h-4 w-4" /> Settings
          </button>
          <button
            onClick={() => {
              onOpenChange(false);
              void signOut();
            }}
            className="col-span-2 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h4 className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </h4>
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg" | "neutral";
}) {
  const toneClass =
    tone === "pos" ? "text-positive" : tone === "neg" ? "text-danger" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-white/[0.02] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-display text-lg tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}
