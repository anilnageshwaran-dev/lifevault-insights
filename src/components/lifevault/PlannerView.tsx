import * as React from "react";
import { ChevronDown, ShieldCheck, BarChart3, Target } from "lucide-react";
import { EssentialsView } from "./EssentialsView";
import { NetWorthView } from "./NetWorthView";
import { GoalsView } from "./GoalsView";

type SectionId = "essentials" | "networth" | "goals";

const SECTIONS: { id: SectionId; label: string; icon: React.ComponentType<{ className?: string }>; render: () => React.ReactNode }[] = [
  { id: "networth", label: "Net Worth", icon: BarChart3, render: () => <NetWorthView /> },
  { id: "essentials", label: "Essentials", icon: ShieldCheck, render: () => <EssentialsView /> },
  { id: "goals", label: "Goals", icon: Target, render: () => <GoalsView /> },
];

const STORAGE_KEY = "lifevault_planner_open";

export function PlannerView() {
  const [open, setOpen] = React.useState<SectionId | null>("networth");

  React.useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === "essentials" || v === "networth" || v === "goals" || v === "") {
        setOpen(v === "" ? null : (v as SectionId));
      }
    } catch {}
  }, []);

  const toggle = (id: SectionId) => {
    setOpen((cur) => {
      const next = cur === id ? null : id;
      try { localStorage.setItem(STORAGE_KEY, next ?? ""); } catch {}
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {SECTIONS.map((s) => {
        const Icon = s.icon;
        const isOpen = open === s.id;
        return (
          <section
            key={s.id}
            className="rounded-2xl border border-border bg-card overflow-hidden"
          >
            <button
              onClick={() => toggle(s.id)}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-foreground" />
                </div>
                <div className="text-left">
                  <div className="font-display text-lg leading-none">{s.label}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {isOpen ? "Tap to collapse" : "Tap to expand"}
                  </div>
                </div>
              </div>
              <ChevronDown
                className={`h-5 w-5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
            </button>
            {isOpen && (
              <div className="border-t border-border px-1 sm:px-2 py-3">
                {s.render()}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
