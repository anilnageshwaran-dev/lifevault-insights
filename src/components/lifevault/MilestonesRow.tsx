import * as React from "react";
import { Trophy, Lock } from "lucide-react";
import { MILESTONES, type MilestoneAchieved } from "@/lib/milestones";
import { formatINR } from "@/lib/finance-utils";

interface Props { achieved: MilestoneAchieved[]; netWorth: number; }

export function MilestonesRow({ achieved, netWorth }: Props) {
  const achievedSet = new Set(achieved.map((m) => m.amount));

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="h-4 w-4 text-amber-400" />
        <h3 className="font-display text-lg">Milestones Achieved</h3>
      </div>
      {achieved.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          Take your first snapshot to start tracking milestones.
        </p>
      ) : null}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {MILESTONES.map((m) => {
          const got = achievedSet.has(m.amount);
          const hit = achieved.find((a) => a.amount === m.amount);
          const isNext = !got && netWorth < m.amount && MILESTONES.find((x) => !achievedSet.has(x.amount))?.amount === m.amount;
          return (
            <div key={m.amount}
              className={`shrink-0 w-32 rounded-xl p-3 text-center border ${
                got ? "border-emerald-500/40 bg-emerald-500/10"
                : isNext ? "border-primary/40 bg-primary/10"
                : "border-border bg-background/40 opacity-60"
              }`}>
              <div className="text-3xl mb-1">{got ? m.emoji : "🔒"}</div>
              <div className="text-xs font-medium truncate">{m.label}</div>
              <div className="text-[10px] text-muted-foreground tabular mt-0.5">
                {got && hit ? new Date(hit.date).toLocaleDateString() : formatINR(m.amount)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
