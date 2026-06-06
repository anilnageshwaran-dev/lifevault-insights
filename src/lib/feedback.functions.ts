import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FeedbackSchema = z.object({
  category: z.enum(["bug", "idea", "praise", "general"]),
  message: z.string().trim().min(3).max(2000),
  rating: z.number().int().min(1).max(5).optional(),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  appVersion: z.string().max(64).optional(),
  userAgent: z.string().max(512).optional(),
});

export const submitFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => FeedbackSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("feedback").insert({
      user_id: userId,
      email: data.email || null,
      category: data.category,
      message: data.message,
      rating: data.rating ?? null,
      app_version: data.appVersion ?? null,
      user_agent: data.userAgent ?? null,
    });
    if (error) { console.error("[server] db error:", error); throw new Error("An internal error occurred. Please try again."); }
    return { ok: true };
  });
