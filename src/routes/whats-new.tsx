import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, ArrowLeft } from "lucide-react";

interface ChangelogItem {
  type: "NEW" | "IMPROVED" | "FIXED";
  text: string;
}
interface ChangelogSection {
  title: string;
  date: string;
  defaultOpen: boolean;
  items: ChangelogItem[];
}

const SECTIONS: ChangelogSection[] = [
  {
    title: "Phase 1 & 2 Features",
    date: "June 2026",
    defaultOpen: true,
    items: [
      { type: "NEW", text: "Home Dashboard with net worth overview, quick stats, and getting started checklist" },
      { type: "NEW", text: "Recurring Bills tracker with calendar view and auto-transaction creation" },
      { type: "NEW", text: "Document expiry alerts across all vault categories with 30/90/180 day warnings" },
      { type: "NEW", text: "In-app feedback system" },
      { type: "NEW", text: "Spending analytics with category breakdown, month-over-month comparison, and unusual spend detection" },
      { type: "NEW", text: "Loan Payoff Planner with amortization schedule and prepay vs invest comparison" },
      { type: "NEW", text: "Password health score with weak and duplicate password detection" },
      { type: "IMPROVED", text: "Font updated to Playfair Display and Plus Jakarta Sans for premium feel" },
      { type: "IMPROVED", text: "Sync indicator now accurately reflects cloud upload status" },
    ],
  },
  {
    title: "Initial Launch",
    date: "May 2026",
    defaultOpen: false,
    items: [
      { type: "NEW", text: "LifeVault launched with 5 core views" },
      { type: "NEW", text: "Zero-knowledge AES-256-GCM encryption" },
      { type: "NEW", text: "Google OAuth with cloud storage" },
      { type: "NEW", text: "17 vault categories" },
      { type: "NEW", text: "PWA installable on mobile" },
      { type: "NEW", text: "Light/dark theme" },
    ],
  },
];

export const Route = createFileRoute("/whats-new")({
  head: () => ({
    meta: [
      { title: "What's New — LifeVault" },
      { name: "description", content: "Latest features and improvements in LifeVault." },
    ],
  }),
  component: WhatsNewPage,
});

function Badge({ type }: { type: ChangelogItem["type"] }) {
  const map = {
    NEW: "bg-primary/15 text-primary border-primary/30",
    IMPROVED: "bg-positive/15 text-positive border-positive/30",
    FIXED: "bg-warning/15 text-warning border-warning/30",
  } as const;
  return (
    <span className={`inline-block text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${map[type]}`}>
      {type}
    </span>
  );
}

function WhatsNewPage() {
  return (
    <div className="min-h-dvh bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 md:py-12">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-5 w-5 text-primary" />
          <h1 className="font-display text-3xl md:text-4xl">What's New in LifeVault</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-8">
          The latest features and improvements
        </p>

        <div className="space-y-4">
          {SECTIONS.map((s) => (
            <details key={s.title} open={s.defaultOpen} className="rounded-xl border border-border bg-card overflow-hidden">
              <summary className="cursor-pointer list-none px-4 md:px-5 py-3 md:py-4 flex items-center justify-between hover:bg-accent/40">
                <div>
                  <div className="font-display text-lg">{s.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{s.date}</div>
                </div>
                <div className="text-xs text-muted-foreground">{s.items.length} updates</div>
              </summary>
              <ul className="px-4 md:px-5 pb-4 space-y-2">
                {s.items.map((it, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Badge type={it.type} />
                    <span className="flex-1 text-foreground/90 leading-relaxed">{it.text}</span>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
