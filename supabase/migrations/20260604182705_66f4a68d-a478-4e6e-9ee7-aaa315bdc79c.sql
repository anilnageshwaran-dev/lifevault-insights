
-- Remove overly permissive invite policies; server functions use service_role for token lookups/accepts
DROP POLICY IF EXISTS "Anyone can look up invite by token" ON public.household_invites;
DROP POLICY IF EXISTS "Invitees can mark accepted" ON public.household_invites;

-- Lock down SECURITY DEFINER helpers from anon (still callable by authenticated for RLS evaluation)
REVOKE EXECUTE ON FUNCTION public.is_household_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_household_owner(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_household_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_household_owner(uuid, uuid) TO authenticated, service_role;
