import * as React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { useLock } from "@/lib/lock-context";
import { useFinance } from "@/lib/finance-context";
import { formatMoney } from "@/lib/currency";
import {
  Settings as SettingsIcon,
  Sun,
  Moon,
  LogOut,
  RefreshCw,
  CalendarClock,
  ShieldCheck,
  Globe,
  Sparkles,
  Plus,
  Wallet,
  Receipt,
  Clock,
  Lock,
  KeyRound,
  Landmark,
  CreditCard,
  FileText,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Target,
} from "lucide-react";
import { LifeVaultIcon } from "./LifeVaultIcon";
import { CurrencySelect } from "./CurrencySelect";
import { WhatsNewDialog } from "./WhatsNewDialog";
import { APP_VERSION } from "@/lib/changelog";
import { computeExpiryAlerts } from "@/lib/vault-expiry";
import { toast } from "sonner";

type NavTarget = "essentials" | "networth" | "cashflow" | "goals" | "vault" | "settings";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenSettings: () => void;
  onNavigate?: (target: NavTarget) => void;
}

export function ProfileDrawer({ open, onOpenChange, onOpenSettings, onNavigate }: Props) {
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

  const base = state.baseCurrency || "INR";

  // ---------- Today's agenda ----------
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const tomorrowEnd = new Date(todayStart.getTime() + 2 * 86400000 - 1);

  type Agenda = { icon: React.ReactNode; text: string; tone: "danger" | "warning" | "neutral" };
  const agenda: Agenda[] = [];

  for (const b of state.bills || []) {
    const d = new Date(b.nextDue);
    if (isNaN(d.getTime())) continue;
    if (d < todayStart) {
      agenda.push({
        icon: <AlertCircle className="h-3.5 w-3.5" />,
        text: `${b.name} overdue — ${formatMoney(b.amount, b.currency || base)}`,
        tone: "danger",
      });
    } else if (d <= tomorrowEnd) {
      const label = d.toDateString() === todayStart.toDateString() ? "due today" : "due tomorrow";
      agenda.push({
        icon: <Receipt className="h-3.5 w-3.5" />,
        text: `${b.name} ${label} — ${formatMoney(b.amount, b.currency || base)}`,
        tone: d.toDateString() === todayStart.toDateString() ? "danger" : "warning",
      });
    }
  }

  // Goals behind pace
  for (const g of state.goals || []) {
    const yrs = Math.max(0, g.targetYear - today.getFullYear());
    const months = Math.max(1, yrs * 12);
    const future = g.currentCost * Math.pow(1 + g.inflation / 100, yrs);
    const remaining = Math.max(0, future - (g.currentSavings || 0));
    const needed = remaining / months;
    if (needed > 0 && g.currentSavings < future * 0.1 && yrs <= 5) {
      agenda.push({
        icon: <Target className="h-3.5 w-3.5" />,
        text: `${g.name} goal needs ${formatMoney(needed, base)}/mo`,
        tone: "warning",
      });
    }
  }

  // Document expiries
  const expiries = computeExpiryAlerts(state.vault ?? {});
  for (const e of expiries.slice(0, 2)) {
    const title = e.record.title || e.fieldLabel || e.categoryName;
    agenda.push({
      icon: <FileText className="h-3.5 w-3.5" />,
      text: `${title} expires in ${e.daysLeft} days`,
      tone: e.daysLeft <= 30 ? "danger" : "warning",
    });
  }

  // Budget warnings
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthTx = state.transactions.filter((t) => new Date(t.date) >= monthStart && !t.transferId);
  for (const [cat, budget] of Object.entries(state.budgets || {})) {
    if (!budget || budget <= 0) continue;
    const spent = monthTx
      .filter((t) => t.type === "expense" && t.category === cat)
      .reduce((s, t) => s + t.amount, 0);
    const pct = spent / budget;
    if (pct >= 0.9) {
      agenda.push({
        icon: <AlertTriangle className="h-3.5 w-3.5" />,
        text: `${cat} budget ${Math.round(pct * 100)}% used`,
        tone: pct >= 1 ? "danger" : "warning",
      });
    }
  }

  const visibleAgenda = agenda.slice(0, 4);

  // ---------- Recent activity ----------
  const recent = [...state.transactions]
    .filter((t) => !t.transferId)
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))
    .slice(0, 3);

  // ---------- Vault chip counts ----------
  const vaultChips: { id: string; label: string; icon: React.ReactNode }[] = [
    { id: "passwords", label: "Passwords", icon: <KeyRound className="h-3.5 w-3.5" /> },
    { id: "__emergency", label: "Emergency", icon: <AlertCircle className="h-3.5 w-3.5" /> },
  ];

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

  const go = (target: NavTarget) => {
    onOpenChange(false);
    onNavigate?.(target);
  };

  const goVault = (categoryId: string) => {
    try {
      if (categoryId === "__emergency") {
        sessionStorage.setItem("lifevault_vault_open_emergency", "1");
      } else {
        sessionStorage.setItem("lifevault_vault_initial_category", categoryId);
      }
    } catch {}
    go("vault");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="p-0 flex flex-col w-full sm:w-[280px] sm:max-w-[280px] duration-250"
      >
        <SheetHeader className="p-4 pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <LifeVaultIcon className="h-9 w-9" />
            <SheetTitle className="font-display text-base">LifeVault</SheetTitle>
          </div>
        </SheetHeader>

        <div className="p-4 flex-1 overflow-y-auto space-y-5">
          {/* Profile header */}
          <div className="flex items-center gap-3">
            {avatar ? (
              <img src={avatar} alt={name} className="h-12 w-12 rounded-full object-cover border border-border" />
            ) : (
              <div className="h-12 w-12 rounded-full bg-primary/15 text-foreground flex items-center justify-center font-display text-base">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <div className="font-display text-sm truncate">{name}</div>
              {user?.email && (
                <div className="text-[11px] text-muted-foreground truncate">{user.email}</div>
              )}
            </div>
          </div>

          {/* Today's agenda */}
          <Section icon={CalendarClock} title="Today's agenda">
            {visibleAgenda.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-positive" />
                <span>All clear! Nothing urgent today.</span>
              </div>
            ) : (
              <ul className="space-y-1.5">
                {visibleAgenda.map((a, i) => (
                  <li
                    key={i}
                    className={`flex items-center gap-2 text-xs ${
                      a.tone === "danger" ? "text-danger" : a.tone === "warning" ? "text-warning" : "text-foreground"
                    }`}
                  >
                    <span className="shrink-0">{a.icon}</span>
                    <span className="truncate">{a.text}</span>
                  </li>
                ))}
                {agenda.length > visibleAgenda.length && (
                  <li className="text-[11px] text-muted-foreground">
                    + {agenda.length - visibleAgenda.length} more
                  </li>
                )}
              </ul>
            )}
          </Section>

          {/* Quick Add */}
          <Section icon={Plus} title="Quick add">
            <div className="grid grid-cols-3 gap-1.5">
              <QuickBtn label="Transaction" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => go("cashflow")} />
              <QuickBtn label="Asset" icon={<Wallet className="h-3.5 w-3.5" />} onClick={() => go("networth")} />
              <QuickBtn
                label="Bill"
                icon={<Receipt className="h-3.5 w-3.5" />}
                onClick={() => {
                  try {
                    sessionStorage.setItem("lifevault_cashflow_initial_subtab", "bills");
                  } catch {}
                  go("cashflow");
                }}
              />
            </div>
          </Section>

          {/* Recent activity */}
          <Section icon={Clock} title="Recent">
            {recent.length === 0 ? (
              <p className="text-xs text-muted-foreground">No recent activity</p>
            ) : (
              <ul className="space-y-1.5">
                {recent.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 text-xs">
                    <span className="h-6 w-6 rounded-md bg-accent flex items-center justify-center text-[10px]">
                      {t.type === "income" ? "↑" : t.type === "expense" ? "↓" : "↔"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{t.description || t.category}</div>
                      <div className="text-[10px] text-muted-foreground">{relativeTime(new Date(t.date))}</div>
                    </div>
                    <span
                      className={`tabular-nums shrink-0 ${
                        t.type === "income" ? "text-positive" : t.type === "expense" ? "text-danger" : "text-foreground"
                      }`}
                    >
                      {formatMoney(t.amount, t.currency || base)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Vault quick access */}
          <Section icon={Lock} title="Vault">
            <div className="grid grid-cols-2 gap-1.5">
              {vaultChips.map((c) => (
                <button
                  key={c.id}
                  onClick={() => goVault(c.id)}
                  className="flex items-center gap-1.5 px-2.5 py-2 rounded-md border border-border text-xs hover:bg-accent transition-colors"
                >
                  {c.icon}
                  <span className="truncate">{c.label}</span>
                </button>
              ))}
            </div>
          </Section>

          {/* Sync status */}
          <Section icon={RefreshCw} title="Backup & sync">
            <div className="flex items-center gap-2 text-xs">
              <span className={`h-2 w-2 rounded-full ${syncDot}`} />
              <span className="text-muted-foreground flex-1 truncate">{syncLabel}</span>
              <button
                onClick={handleSync}
                disabled={syncing || syncStatus === "saving"}
                className="text-[11px] px-2 py-1 rounded-md border border-border hover:bg-accent disabled:opacity-50"
              >
                Sync now
              </button>
            </div>
          </Section>

          {/* Currency */}
          <Section icon={Globe} title="Currency">
            <CurrencySelect
              value={base}
              onChange={(c) => {
                update("baseCurrency", c);
                toast.success(`Base set to ${c}`);
              }}
            />
          </Section>

          {/* Security */}
          <Section icon={ShieldCheck} title="Security">
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => {
                  onOpenChange(false);
                  onOpenSettings();
                }}
                className="px-2.5 py-2 rounded-md border border-border text-xs hover:bg-accent text-left"
              >
                Change PIN
              </button>
              <button
                onClick={() => {
                  onOpenChange(false);
                  lock();
                }}
                className="px-2.5 py-2 rounded-md border border-border text-xs hover:bg-accent text-left"
              >
                Lock now
              </button>
            </div>
          </Section>

          <button
            onClick={() => setWhatsNewOpen(true)}
            className="w-full flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors py-1.5"
          >
            <Sparkles className="h-3 w-3" />
            What's new · v{APP_VERSION}
          </button>
        </div>

        <WhatsNewDialog open={whatsNewOpen} onOpenChange={setWhatsNewOpen} />

        <div className="border-t border-border p-2.5 grid grid-cols-2 gap-1.5">
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-md border border-border text-xs hover:bg-accent transition-colors"
          >
            {resolved === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            {resolved === "dark" ? "Light" : "Dark"}
          </button>
          <button
            onClick={() => {
              onOpenChange(false);
              onOpenSettings();
            }}
            className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-md border border-border text-xs hover:bg-accent transition-colors"
          >
            <SettingsIcon className="h-3.5 w-3.5" /> Settings
          </button>
          <button
            onClick={() => {
              onOpenChange(false);
              void signOut();
            }}
            className="col-span-2 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
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
      <h4 className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
        <Icon className="h-3 w-3" />
        {title}
      </h4>
      {children}
    </section>
  );
}

function QuickBtn({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 px-1 py-2 rounded-md border border-border text-[11px] hover:bg-accent transition-colors"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

function relativeTime(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const days = Math.floor(s / 86400);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}
