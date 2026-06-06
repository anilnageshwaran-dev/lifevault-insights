import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function randomToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const listHouseholds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: memberships, error: mErr } = await supabase
      .from("household_members")
      .select("household_id, role, joined_at")
      .eq("user_id", userId);
    if (mErr) throw new Error(mErr.message);
    if (!memberships || memberships.length === 0) return { households: [] };

    const ids = memberships.map((m) => m.household_id);
    const { data: hs, error: hErr } = await supabase
      .from("households")
      .select("id, name, owner_id, created_at")
      .in("id", ids);
    if (hErr) throw new Error(hErr.message);

    const map = new Map(memberships.map((m) => [m.household_id, m]));
    return {
      households: (hs ?? []).map((h) => ({
        ...h,
        role: map.get(h.id)?.role ?? "member",
      })),
    };
  });

export const createHousehold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ name: z.string().min(1).max(80) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: hh, error } = await supabaseAdmin
      .from("households")
      .insert({ name: data.name, owner_id: userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    const { error: mErr } = await supabaseAdmin.from("household_members").insert({
      household_id: hh.id,
      user_id: userId,
      role: "owner",
    });
    if (mErr) throw new Error(mErr.message);
    return { household: hh };
  });

export const renameHousehold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ householdId: z.string().uuid(), name: z.string().min(1).max(80) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("households")
      .update({ name: data.name })
      .eq("id", data.householdId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteHousehold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ householdId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("households")
      .delete()
      .eq("id", data.householdId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ householdId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: members, error } = await supabase
      .from("household_members")
      .select("user_id, role, joined_at")
      .eq("household_id", data.householdId);
    if (error) throw new Error(error.message);
    const ids = (members ?? []).map((m) => m.user_id);
    let profiles: { id: string; display_name: string | null; avatar_url: string | null }[] = [];
    if (ids.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: ps } = await supabaseAdmin
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", ids);
      profiles = ps ?? [];
    }
    const pmap = new Map(profiles.map((p) => [p.id, p]));
    return {
      members: (members ?? []).map((m) => ({
        ...m,
        display_name: pmap.get(m.user_id)?.display_name ?? null,
        avatar_url: pmap.get(m.user_id)?.avatar_url ?? null,
      })),
    };
  });

export const listInvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ householdId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: invites, error } = await context.supabase
      .from("household_invites")
      .select("id, email, token, accepted_at, expires_at, created_at")
      .eq("household_id", data.householdId)
      .is("accepted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { invites: invites ?? [] };
  });

export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        householdId: z.string().uuid(),
        email: z.string().email().max(255),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const token = randomToken();
    const { data: inv, error } = await supabase
      .from("household_invites")
      .insert({
        household_id: data.householdId,
        email: data.email.toLowerCase(),
        token,
        invited_by: userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { invite: inv };
  });

export const revokeInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ inviteId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Verify caller is the owner of the household this invite belongs to
    const { data: inv, error: invErr } = await supabaseAdmin
      .from("household_invites")
      .select("id, household_id")
      .eq("id", data.inviteId)
      .maybeSingle();
    if (invErr) {
      console.error("[households] revokeInvite lookup:", invErr);
      throw new Error("An internal error occurred. Please try again.");
    }
    if (!inv) throw new Error("Invite not found");
    const { data: hh, error: hhErr } = await supabaseAdmin
      .from("households")
      .select("owner_id")
      .eq("id", inv.household_id)
      .maybeSingle();
    if (hhErr) {
      console.error("[households] revokeInvite owner lookup:", hhErr);
      throw new Error("An internal error occurred. Please try again.");
    }
    if (!hh || hh.owner_id !== userId) throw new Error("Forbidden");
    const { error } = await supabaseAdmin
      .from("household_invites")
      .delete()
      .eq("id", data.inviteId);
    if (error) {
      console.error("[households] revokeInvite delete:", error);
      throw new Error("An internal error occurred. Please try again.");
    }
    return { ok: true };
  });

export const acceptInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ token: z.string().min(8).max(128) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: invite, error: iErr } = await supabaseAdmin
      .from("household_invites")
      .select("id, household_id, email, accepted_at, expires_at")
      .eq("token", data.token)
      .maybeSingle();
    if (iErr) {
      console.error("[households] acceptInvite lookup:", iErr);
      throw new Error("An internal error occurred. Please try again.");
    }
    if (!invite) throw new Error("Invite not found");
    if (invite.accepted_at) throw new Error("Invite already used");
    if (new Date(invite.expires_at) < new Date()) throw new Error("Invite expired");

    // Verify the authenticated user's email matches the invite email.
    let callerEmail = (claims as { email?: string } | undefined)?.email?.toLowerCase() ?? null;
    if (!callerEmail) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId);
      callerEmail = u?.user?.email?.toLowerCase() ?? null;
    }
    if (!callerEmail || callerEmail !== invite.email.toLowerCase()) {
      throw new Error("This invite was sent to a different email address.");
    }

    const { error: mErr } = await supabase
      .from("household_members")
      .insert({
        household_id: invite.household_id,
        user_id: userId,
        role: "member",
      });
    if (mErr && !mErr.message.includes("duplicate")) {
      console.error("[households] acceptInvite member insert:", mErr);
      throw new Error("An internal error occurred. Please try again.");
    }

    await supabaseAdmin
      .from("household_invites")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invite.id);

    return { householdId: invite.household_id };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ householdId: z.string().uuid(), userId: z.string().uuid() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Only the household owner can remove a member.
    const { data: hh, error: hhErr } = await supabaseAdmin
      .from("households")
      .select("owner_id")
      .eq("id", data.householdId)
      .maybeSingle();
    if (hhErr) {
      console.error("[households] removeMember owner lookup:", hhErr);
      throw new Error("An internal error occurred. Please try again.");
    }
    if (!hh || hh.owner_id !== userId) throw new Error("Forbidden");
    // Disallow removing the owner themselves through this endpoint.
    if (data.userId === hh.owner_id) {
      throw new Error("Owner cannot be removed. Delete the household instead.");
    }
    const { error } = await supabaseAdmin
      .from("household_members")
      .delete()
      .eq("household_id", data.householdId)
      .eq("user_id", data.userId);
    if (error) {
      console.error("[households] removeMember delete:", error);
      throw new Error("An internal error occurred. Please try again.");
    }
    return { ok: true };
  });

export const leaveHousehold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ householdId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("household_members")
      .delete()
      .eq("household_id", data.householdId)
      .eq("user_id", userId);
    if (error) {
      console.error("[households] leaveHousehold:", error);
      throw new Error("An internal error occurred. Please try again.");
    }
    return { ok: true };
  });

// Auth-required so unauthenticated callers cannot enumerate invite tokens.
// Returns only non-PII metadata — never the recipient email — so a stolen
// token cannot leak who the invite was sent to. The accepting user's email
// is verified against the invite inside `acceptInvite`.
export const getInviteByToken = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ token: z.string().min(8).max(128) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invite } = await supabaseAdmin
      .from("household_invites")
      .select("id, accepted_at, expires_at, household_id")
      .eq("token", data.token)
      .maybeSingle();
    if (!invite) return { invite: null, householdName: null };
    const { data: hh } = await supabaseAdmin
      .from("households")
      .select("name")
      .eq("id", invite.household_id)
      .maybeSingle();
    return {
      invite: {
        id: invite.id,
        accepted_at: invite.accepted_at,
        expires_at: invite.expires_at,
        household_id: invite.household_id,
      },
      householdName: hh?.name ?? null,
    };
  });
