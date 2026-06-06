import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Best-effort cleanup of vault storage object(s) for this user
    try {
      const { data: files } = await supabaseAdmin.storage.from("vaults").list(userId);
      if (files && files.length > 0) {
        await supabaseAdmin.storage
          .from("vaults")
          .remove(files.map((f) => `${userId}/${f.name}`));
      }
    } catch {
      // ignore — proceed with account deletion regardless
    }

    // Best-effort cleanup of app rows that may not cascade
    try {
      await supabaseAdmin.from("household_members").delete().eq("user_id", userId);
      await supabaseAdmin.from("household_invites").delete().eq("invited_by", userId);
      await supabaseAdmin.from("households").delete().eq("owner_id", userId);
      await supabaseAdmin.from("household_shared_snapshots").delete().eq("user_id", userId);
      await supabaseAdmin.from("feedback").delete().eq("user_id", userId);
      await supabaseAdmin.from("profiles").delete().eq("id", userId);
    } catch {
      // ignore — proceed with auth deletion
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
