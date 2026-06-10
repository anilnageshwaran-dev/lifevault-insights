import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SECTION_VALUES = ["essentials", "networth", "cashflow", "goals"] as const;
const sectionSchema = z.enum(SECTION_VALUES);

// ─── List my outgoing invites and active grants ──────────────────────────────
export const listFamily = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [accessRes, invitesRes] = await Promise.all([
      supabase
        .from("family_access")
        .select("id, member_id, role, allowed_sections, granted_at")
        .eq("owner_id", userId),
      supabase
        .from("family_invites")
        .select("id, invitee_email, invitee_name, role, allowed_sections, token, status, personal_message, invited_at, accepted_at")
        .eq("owner_id", userId)
        .eq("status", "pending")
        .order("invited_at", { ascending: false }),
    ]);

    if (accessRes.error) {
      console.error("[family] listFamily access:", accessRes.error);
      throw new Error("An internal error occurred. Please try again.");
    }
    if (invitesRes.error) {
      console.error("[family] listFamily invites:", invitesRes.error);
      throw new Error("An internal error occurred. Please try again.");
    }

    const memberIds = (accessRes.data ?? []).map((a) => a.member_id);
    let profiles: { id: string; display_name: string | null; avatar_url: string | null }[] = [];
    if (memberIds.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: ps } = await supabaseAdmin
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", memberIds);
      profiles = ps ?? [];

      // Also pull emails from auth for nicer display
      const emails: Record<string, string | null> = {};
      for (const id of memberIds) {
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(id);
        emails[id] = u?.user?.email ?? null;
      }
      return {
        members: (accessRes.data ?? []).map((a) => {
          const p = profiles.find((x) => x.id === a.member_id);
          return {
            id: a.id,
            member_id: a.member_id,
            role: a.role as "viewer" | "emergency",
            allowed_sections: a.allowed_sections as string[],
            granted_at: a.granted_at,
            display_name: p?.display_name ?? null,
            avatar_url: p?.avatar_url ?? null,
            email: emails[a.member_id] ?? null,
          };
        }),
        pending: invitesRes.data ?? [],
      };
    }

    return { members: [], pending: invitesRes.data ?? [] };
  });

// ─── Create an invite (returns token for the shareable link) ─────────────────
export const createFamilyInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        invitee_name: z.string().trim().min(1).max(80),
        invitee_email: z.string().trim().email().max(255),
        role: z.enum(["viewer", "emergency"]),
        allowed_sections: z.array(sectionSchema).min(0).max(4).default([...SECTION_VALUES]),
        personal_message: z.string().trim().max(500).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sections = data.role === "emergency" ? [] : data.allowed_sections;

    const { data: inv, error } = await supabaseAdmin
      .from("family_invites")
      .insert({
        owner_id: userId,
        invitee_name: data.invitee_name,
        invitee_email: data.invitee_email.toLowerCase(),
        role: data.role,
        allowed_sections: sections,
        personal_message: data.personal_message || null,
      })
      .select("id, token, invitee_email, invitee_name, role")
      .single();

    if (error) {
      console.error("[family] createFamilyInvite:", error);
      throw new Error("An internal error occurred. Please try again.");
    }
    return { invite: inv };
  });

// ─── Revoke a pending invite ─────────────────────────────────────────────────
export const revokeFamilyInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ inviteId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("family_invites")
      .update({ status: "revoked" })
      .eq("id", data.inviteId)
      .eq("owner_id", userId);
    if (error) {
      console.error("[family] revokeFamilyInvite:", error);
      throw new Error("An internal error occurred. Please try again.");
    }
    return { ok: true };
  });

// ─── Remove a family member's access ─────────────────────────────────────────
export const removeFamilyMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ accessId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("family_access")
      .delete()
      .eq("id", data.accessId)
      .eq("owner_id", userId);
    if (error) {
      console.error("[family] removeFamilyMember:", error);
      throw new Error("An internal error occurred. Please try again.");
    }
    return { ok: true };
  });

// ─── Lookup invite metadata by token (auth-required, minimal data) ───────────
export const getFamilyInviteByToken = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ token: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv } = await supabaseAdmin
      .from("family_invites")
      .select("id, owner_id, role, status, accepted_at, personal_message, invitee_name, invited_at")
      .eq("token", data.token)
      .maybeSingle();
    if (!inv) return { invite: null, ownerName: null };

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("display_name")
      .eq("id", inv.owner_id)
      .maybeSingle();

    return {
      invite: {
        id: inv.id,
        owner_id: inv.owner_id,
        role: inv.role as "viewer" | "emergency",
        status: inv.status as "pending" | "active" | "revoked",
        accepted_at: inv.accepted_at,
        personal_message: inv.personal_message,
        invitee_name: inv.invitee_name,
        invited_at: inv.invited_at,
      },
      ownerName: profile?.display_name ?? null,
    };
  });

// ─── Accept a family invite ──────────────────────────────────────────────────
export const acceptFamilyInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ token: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId, claims } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: inv, error: iErr } = await supabaseAdmin
      .from("family_invites")
      .select("id, owner_id, invitee_email, role, allowed_sections, status, invited_at")
      .eq("token", data.token)
      .maybeSingle();
    if (iErr) {
      console.error("[family] acceptFamilyInvite lookup:", iErr);
      throw new Error("An internal error occurred. Please try again.");
    }
    if (!inv) throw new Error("Invite not found");
    if (inv.status !== "pending") throw new Error("Invite is no longer pending");

    // 7-day expiry
    const ageMs = Date.now() - new Date(inv.invited_at).getTime();
    if (ageMs > 7 * 24 * 60 * 60 * 1000) throw new Error("Invite has expired");

    // Verify email match
    let callerEmail = (claims as { email?: string } | undefined)?.email?.toLowerCase() ?? null;
    if (!callerEmail) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId);
      callerEmail = u?.user?.email?.toLowerCase() ?? null;
    }
    if (!callerEmail || callerEmail !== inv.invitee_email.toLowerCase()) {
      throw new Error("This invite was sent to a different email address. Please sign in with the correct account.");
    }

    // Upsert family_access
    const { error: aErr } = await supabaseAdmin
      .from("family_access")
      .upsert(
        {
          owner_id: inv.owner_id,
          member_id: userId,
          role: inv.role,
          allowed_sections: inv.allowed_sections,
        },
        { onConflict: "owner_id,member_id" },
      );
    if (aErr) {
      console.error("[family] acceptFamilyInvite upsert:", aErr);
      throw new Error("An internal error occurred. Please try again.");
    }

    await supabaseAdmin
      .from("family_invites")
      .update({ status: "active", invitee_id: userId, accepted_at: new Date().toISOString() })
      .eq("id", inv.id);

    return { ownerId: inv.owner_id };
  });

// ─── Read-only viewer access: confirm grant + load shared snapshot ───────────
export const getFamilyView = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ ownerId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: access, error: aErr } = await supabase
      .from("family_access")
      .select("role, allowed_sections, granted_at")
      .eq("owner_id", data.ownerId)
      .eq("member_id", userId)
      .maybeSingle();
    if (aErr) {
      console.error("[family] getFamilyView access:", aErr);
      throw new Error("An internal error occurred. Please try again.");
    }
    if (!access) throw new Error("You don't have access to this dashboard.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: ownerProfile } = await supabaseAdmin
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", data.ownerId)
      .maybeSingle();

    // Most recent shared snapshot from this owner (across any household).
    const { data: snap } = await supabaseAdmin
      .from("household_shared_snapshots")
      .select(
        "display_name, base_currency, net_worth, total_assets, total_liabilities, monthly_income, monthly_expenses, emergency_fund, goal_count, account_count, health_score, updated_at",
      )
      .eq("user_id", data.ownerId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      role: access.role as "viewer" | "emergency",
      allowed_sections: access.allowed_sections as string[],
      granted_at: access.granted_at,
      ownerName: ownerProfile?.display_name ?? null,
      ownerAvatar: ownerProfile?.avatar_url ?? null,
      snapshot: snap ?? null,
    };
  });

// ─── Vaults that have been shared WITH the current user ──────────────────────
export const listSharedWithMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("family_access")
      .select("id, owner_id, role, allowed_sections, granted_at")
      .eq("member_id", userId)
      .order("granted_at", { ascending: false });
    if (error) {
      console.error("[family] listSharedWithMe:", error);
      throw new Error("An internal error occurred. Please try again.");
    }
    const ownerIds = (rows ?? []).map((r) => r.owner_id);
    if (!ownerIds.length) return { shared: [] };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", ownerIds);
    const emails: Record<string, string | null> = {};
    for (const id of ownerIds) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(id);
      emails[id] = u?.user?.email ?? null;
    }
    return {
      shared: (rows ?? []).map((r) => {
        const p = profiles?.find((x) => x.id === r.owner_id);
        return {
          id: r.id,
          owner_id: r.owner_id,
          role: r.role as "viewer" | "emergency",
          allowed_sections: r.allowed_sections as string[],
          granted_at: r.granted_at,
          owner_name: p?.display_name ?? null,
          owner_avatar: p?.avatar_url ?? null,
          owner_email: emails[r.owner_id] ?? null,
        };
      }),
    };
  });

// ─── Owner notifications: invites accepted since cutoff timestamp ────────────
export const listRecentAcceptances = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ sinceIso: z.string().datetime().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("family_invites")
      .select("id, invitee_name, invitee_email, accepted_at, role")
      .eq("owner_id", userId)
      .eq("status", "active")
      .not("accepted_at", "is", null)
      .order("accepted_at", { ascending: false })
      .limit(10);
    if (data.sinceIso) q = q.gt("accepted_at", data.sinceIso);
    const { data: rows, error } = await q;
    if (error) {
      console.error("[family] listRecentAcceptances:", error);
      throw new Error("An internal error occurred. Please try again.");
    }
    return { acceptances: rows ?? [], userId };
  });
