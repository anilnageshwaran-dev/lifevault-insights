import * as React from "react";
import { Bell, X, CalendarClock, AlertCircle, Plus } from "lucide-react";
import { useFinance } from "@/lib/finance-context";
import { useAuth } from "@/lib/auth-context";

type Reminder = {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "info" | "warn" | "danger";
  title: string;
  detail?: string;
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => {
  const ms = new Date(a).getTime() - new Date(b).getTime();
  return Math.round(ms / 86400000);
};

const INACTIVITY_DAYS = 3;
const BILL_WINDOW_DAYS = 7;

export function RemindersBanner() {
  const { state } = useFinance();
  const { user } = useAuth();
  const dismissKey = React.useMemo(
    () => `lifevault_reminders_dismissed_${user?.id ?? "anon"}_${todayISO()}`,
    [user?.id],
  );
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    try {
      setDismissed(localStorage.getItem(dismissKey) === "1");
    } catch {
      setDismissed(false);
    }
  }, [dismissKey]);

  const reminders = React.useMemo<Reminder[]>(() => {
    const out: Reminder[] = [];
    const today = todayISO();

    // 1) Overdue + upcoming bills
    const bills = state.bills ?? [];
    const overdue = bills.filter((b) => b.nextDue && b.nextDue < today);
    const upcoming = bills.filter((b) => {
      if (!b.nextDue || b.nextDue < today) return false;
      const d = daysBetween(b.nextDue, today);
      return d >= 0 && d <= BILL_WINDOW_DAYS;
    });

    if (overdue.length > 0) {
      const first = overdue[0];
      out.push({
        id: "bills-overdue",
        icon: AlertCircle,
        tone: "danger",
        title:
          overdue.length === 1
            ? `${first.name} is overdue`
            : `${overdue.length} bills are overdue`,
        detail:
          overdue.length === 1
            ? `Due ${first.nextDue}`
            : `Including ${first.name} (${first.nextDue})`,
      });
    }
    if (upcoming.length > 0) {
      const first = upcoming.sort((a, b) => a.nextDue.localeCompare(b.nextDue))[0];
      const days = daysBetween(first.nextDue, today);
      out.push({
        id: "bills-upcoming",
        icon: CalendarClock,
        tone: "warn",
        title:
          upcoming.length === 1
            ? `${first.name} due ${days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`}`
            : `${upcoming.length} bills due in the next ${BILL_WINDOW_DAYS} days`,
        detail:
          upcoming.length > 1
            ? `Next: ${first.name} on ${first.nextDue}`
            : undefined,
      });
    }

    // 2) Daily log reminder
    const txs = state.transactions ?? [];
    const loggedToday = txs.some((t) => t.date === today);
    if (!loggedToday) {
      out.push({
        id: "log-today",
        icon: Plus,
        tone: "info",
        title: "Log today's income or expenses",
        detail: "A quick add keeps your cash flow accurate.",
      });
    }

    // 3) Inactivity
    if (txs.length > 0) {
      const last = txs.reduce((m, t) => (t.date > m ? t.date : m), txs[0].date);
      const gap = daysBetween(today, last);
      if (gap >= INACTIVITY_DAYS) {
        out.push({
          id: "inactivity",
          icon: Bell,
          tone: "warn",
          title: `No activity for ${gap} days`,
          detail: "Catch up on any missed transactions.",
        });
      }
    }

    return out;
  }, [state.bills, state.transactions]);

  const dismiss = () => {
    try {
      localStorage.setItem(dismissKey, "1");
    } catch {}
    setDismissed(true);
  };

  if (dismissed || reminders.length === 0) return null;

  const top = reminders[0];
  const rest = reminders.length - 1;

  const toneClass =
    top.tone === "danger"
      ? "border-destructive/40 bg-destructive/10 text-destructive-foreground"
      : top.tone === "warn"
      ? "border-amber-500/40 bg-amber-500/10"
      : "border-primary/30 bg-primary/5";

  const Icon = top.icon;
  return (
    <div className="px-3 sm:px-4 md:px-8 pt-3">
      <div
        className={`flex items-start gap-3 rounded-xl border p-3 ${toneClass}`}
        role="status"
      >
        <Icon className="h-5 w-5 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium leading-tight">{top.title}</div>
          {top.detail && (
            <div className="text-xs text-muted-foreground mt-0.5">{top.detail}</div>
          )}
          {rest > 0 && (
            <div className="text-xs text-muted-foreground mt-1">
              +{rest} more reminder{rest === 1 ? "" : "s"}
            </div>
          )}
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss reminders for today"
          className="p-1 rounded-md hover:bg-background/40 text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
