import * as React from "react";
import { useFinance, type Goal } from "@/lib/finance-context";
import { formatINR, pct, uid, clamp } from "@/lib/finance-utils";
import {
  GlassCard,
  MoneyInput,
  NumberInput,
  FieldLabel,
  SectionTitle,
  EmptyState,
} from "./primitives";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Home,
  Car,
  GraduationCap,
  Heart,
  Palmtree,
  Plane,
  ShieldCheck,
  Sparkles,
  Target,
  Plus,
  Trash2,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";

const GOAL_TYPES = [
  "Home Purchase",
  "Vehicle",
  "Higher Education",
  "Wedding",
  "Retirement",
  "Travel",
  "Emergency Fund",
  "Custom",
] as const;

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  "Home Purchase": Home,
  Vehicle: Car,
  "Higher Education": GraduationCap,
  Wedding: Heart,
  Retirement: Palmtree,
  Travel: Plane,
  "Emergency Fund": ShieldCheck,
  Custom: Sparkles,
};

function computeGoal(g: Goal) {
  const years = Math.max(0, g.targetYear - new Date().getFullYear());
  const futureTarget = g.currentCost * Math.pow(1 + g.inflation / 100, years);
  const progress = futureTarget > 0 ? (g.currentSavings / futureTarget) * 100 : 0;
  const monthlyNeeded = years > 0 ? (futureTarget - g.currentSavings) / (years * 12) : futureTarget;
  return { years, futureTarget, progress, monthlyNeeded: Math.max(0, monthlyNeeded) };
}

export function GoalsView() {
  const { state, setState } = useFinance();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Goal | null>(null);

  const blank: Goal = {
    id: "",
    name: "",
    type: "Home Purchase",
    currentCost: 0,
    targetYear: new Date().getFullYear() + 5,
    inflation: 6,
    linked: "",
    currentSavings: 0,
  };

  const [form, setForm] = React.useState<Goal>(blank);

  const startNew = () => {
    setEditing(null);
    setForm(blank);
    setOpen(true);
  };
  const startEdit = (g: Goal) => {
    setEditing(g);
    setForm(g);
    setOpen(true);
  };
  const save = () => {
    if (!form.name || !form.currentCost) {
      toast.error("Name and current cost required");
      return;
    }
    if (editing) {
      setState((s) => ({
        ...s,
        goals: s.goals.map((g) => (g.id === editing.id ? form : g)),
      }));
      toast.success("Goal updated");
    } else {
      setState((s) => ({
        ...s,
        goals: [...s.goals, { ...form, id: uid() }],
      }));
      toast.success("Goal added");
    }
    setOpen(false);
  };

  // Summary
  const summary = state.goals.reduce(
    (acc, g) => {
      const c = computeGoal(g);
      acc.future += c.futureTarget;
      acc.monthly += c.monthlyNeeded;
      acc.savings += g.currentSavings;
      return acc;
    },
    { future: 0, monthly: 0, savings: 0 },
  );
  const overallPct = summary.future > 0 ? (summary.savings / summary.future) * 100 : 0;
  const earliest = state.goals.length
    ? Math.min(...state.goals.map((g) => g.targetYear))
    : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <GlassCard className="lg:col-span-2">
          <SectionTitle
            title="Your Goals"
            subtitle="Future-priced and tracked monthly"
            right={
              <Button onClick={startNew} className="gap-1">
                <Plus className="h-4 w-4" /> Add New Goal
              </Button>
            }
          />
          {state.goals.length === 0 ? (
            <EmptyState
              icon={Target}
              title="No goals yet"
              description="Add your first life goal and we'll inflation-adjust it for you."
              cta={
                <Button onClick={startNew} className="gap-1">
                  <Plus className="h-4 w-4" /> Add Your First Goal
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {state.goals.map((g) => {
                const c = computeGoal(g);
                const Icon = TYPE_ICON[g.type] || Sparkles;
                return (
                  <div
                    key={g.id}
                    className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="rounded-xl bg-primary/15 p-2 shrink-0">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-display text-lg truncate">{g.name}</div>
                          <div className="text-[11px] text-muted-foreground">{g.type}</div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          className="p-1.5 rounded-md hover:bg-white/5 text-muted-foreground"
                          onClick={() => startEdit(g)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="p-1.5 rounded-md hover:bg-white/5 text-muted-foreground hover:text-rose-400"
                          onClick={() =>
                            setState((s) => ({
                              ...s,
                              goals: s.goals.filter((x) => x.id !== g.id),
                            }))
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="text-muted-foreground">Today's cost</div>
                        <div className="tabular text-sm">{formatINR(g.currentCost)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">In {c.years}y (inflation)</div>
                        <div
                          className="tabular text-sm"
                          style={{ color: "var(--color-warning)" }}
                        >
                          {formatINR(c.futureTarget)}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                        <span>Progress</span>
                        <span className="tabular">{pct(c.progress, 1)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700 ease-out"
                          style={{
                            width: `${clamp(c.progress)}%`,
                            backgroundColor: "var(--color-positive)",
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex items-end justify-between pt-1">
                      <div>
                        <div className="text-[11px] text-muted-foreground">Monthly SIP needed</div>
                        <div
                          className="font-display text-2xl tabular"
                          style={{ color: "var(--color-positive)" }}
                        >
                          {formatINR(c.monthlyNeeded)}
                        </div>
                      </div>
                      <div className="rounded-full bg-white/5 text-[11px] px-2 py-1 text-muted-foreground">
                        {c.years > 0 ? `${c.years}y left` : "Due now"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>

        <GlassCard>
          <SectionTitle title="Goals Summary" subtitle="The big picture" />
          <div className="flex items-center justify-center my-4">
            <RingProgress value={overallPct} />
          </div>
          <div className="space-y-3">
            <Row label="Future obligations" value={formatINR(summary.future)} />
            <Row
              label="Total monthly SIP"
              value={formatINR(summary.monthly)}
              color="var(--color-positive)"
            />
            <Row
              label="Currently saved"
              value={formatINR(summary.savings)}
            />
            <Row
              label="Earliest deadline"
              value={earliest ? String(earliest) : "—"}
            />
          </div>
        </GlassCard>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {editing ? "Edit Goal" : "New Goal"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel>Goal Name</FieldLabel>
                <input
                  className="underline-input"
                  placeholder="Buy a home"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <FieldLabel>Goal Type</FieldLabel>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm({ ...form, type: v })}
                >
                  <SelectTrigger className="bg-white/[0.04] border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GOAL_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <FieldLabel>Current Cost (₹)</FieldLabel>
                <MoneyInput
                  value={form.currentCost}
                  onChange={(n) => setForm({ ...form, currentCost: n })}
                />
              </div>
              <div>
                <FieldLabel>Target Year</FieldLabel>
                <NumberInput
                  value={form.targetYear}
                  onChange={(n) => setForm({ ...form, targetYear: n })}
                  min={new Date().getFullYear() + 1}
                />
              </div>
              <div>
                <FieldLabel>Inflation %</FieldLabel>
                <NumberInput
                  value={form.inflation}
                  onChange={(n) => setForm({ ...form, inflation: n })}
                />
              </div>
              <div>
                <FieldLabel>Current Savings (₹)</FieldLabel>
                <MoneyInput
                  value={form.currentSavings}
                  onChange={(n) => setForm({ ...form, currentSavings: n })}
                />
              </div>
              <div className="col-span-2">
                <FieldLabel>Linked Asset / SIP (optional)</FieldLabel>
                <input
                  className="underline-input"
                  placeholder="e.g. Parag Parikh Flexi Cap"
                  value={form.linked || ""}
                  onChange={(e) => setForm({ ...form, linked: e.target.value })}
                />
              </div>
            </div>
            <Button className="w-full" onClick={save}>
              {editing ? "Update Goal" : "Create Goal"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular font-display text-base" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

function RingProgress({ value }: { value: number }) {
  const size = 160;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - clamp(value) / 100);
  return (
    <div className="relative">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--color-positive)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 900ms ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-display text-3xl tabular">{Math.round(value)}%</div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Overall
        </div>
      </div>
    </div>
  );
}
