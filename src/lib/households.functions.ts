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
    const { supabase, userId } = context;
    const { data: hh, error } = await supabase
      .from("households")
      .insert({ name: data.name, owner_id: userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    const { error: mErr } = await supabase.from("household_members").insert({
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
    const { error } = await context.supabase
      .from("household_invites")
      .delete()
      .eq("id", data.inviteId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const acceptInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ token: z.string().min(8).max(128) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: invite, error: iErr } = await supabaseAdmin
      .from("household_invites")
      .select("id, household_id, email, accepted_at, expires_at")
      .eq("token", data.token)
      .maybeSingle();
    if (iErr) throw new Error(iErr.message);
    if (!invite) throw new Error("Invite not found");
    if (invite.accepted_at) throw new Error("Invite already used");
    if (new Date(invite.expires_at) < new Date()) throw new Error("Invite expired");

    const { error: mErr } = await supabase
      .from("household_members")
      .insert({
        household_id: invite.household_id,
        user_id: userId,
        role: "member",
      });
    if (mErr && !mErr.message.includes("duplicate")) throw new Error(mErr.message);

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
    const { error } = await context.supabase
      .from("household_members")
      .delete()
      .eq("household_id", data.householdId)
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
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
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getInviteByToken = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z.object({ token: z.string().min(8).max(128) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invite } = await supabaseAdmin
      .from("household_invites")
      .select("id, email, accepted_at, expires_at, household_id")
      .eq("token", data.token)
      .maybeSingle();
    if (!invite) return { invite: null, householdName: null };
    const { data: hh } = await supabaseAdmin
      .from("households")
      .select("name")
      .eq("id", invite.household_id)
      .maybeSingle();
    return { invite, householdName: hh?.name ?? null };
  });
