import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SnapshotSchema = z.object({
  householdId: z.string().uuid(),
  displayName: z.string().max(120).optional(),
  baseCurrency: z.string().min(2).max(8),
  netWorth: z.number().finite(),
  totalAssets: z.number().finite(),
  totalLiabilities: z.number().finite(),
  monthlyIncome: z.number().finite(),
  monthlyExpenses: z.number().finite(),
  emergencyFund: z.number().finite(),
  goalCount: z.number().int().nonnegative(),
  accountCount: z.number().int().nonnegative(),
  healthScore: z.number().int().min(0).max(100),
});

export const upsertSharedSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof SnapshotSchema>) => SnapshotSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const row = {
      household_id: data.householdId,
      user_id: userId,
      display_name: data.displayName ?? null,
      base_currency: data.baseCurrency,
      net_worth: data.netWorth,
      total_assets: data.totalAssets,
      total_liabilities: data.totalLiabilities,
      monthly_income: data.monthlyIncome,
      monthly_expenses: data.monthlyExpenses,
      emergency_fund: data.emergencyFund,
      goal_count: data.goalCount,
      account_count: data.accountCount,
      health_score: data.healthScore,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("household_shared_snapshots")
      .upsert(row, { onConflict: "household_id,user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listSharedSnapshots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { householdId: string }) =>
    z.object({ householdId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("household_shared_snapshots")
      .select("*")
      .eq("household_id", data.householdId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { snapshots: rows ?? [] };
  });

export const deleteMySharedSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { householdId: string }) =>
    z.object({ householdId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("household_shared_snapshots")
      .delete()
      .eq("household_id", data.householdId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
