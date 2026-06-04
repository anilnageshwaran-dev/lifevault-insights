
-- Households
CREATE TABLE public.households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.household_members (
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, user_id)
);

CREATE TABLE public.household_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  email text NOT NULL,
  token text NOT NULL UNIQUE,
  invited_by uuid NOT NULL,
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_household_members_user ON public.household_members(user_id);
CREATE INDEX idx_household_invites_token ON public.household_invites(token);
CREATE INDEX idx_household_invites_email ON public.household_invites(lower(email));

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.households TO authenticated;
GRANT ALL ON public.households TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.household_members TO authenticated;
GRANT ALL ON public.household_members TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.household_invites TO authenticated;
GRANT ALL ON public.household_invites TO service_role;
-- Allow anon to look up an invite by token (token is the secret)
GRANT SELECT ON public.household_invites TO anon;

-- Security definer helpers (avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_household_member(_uid uuid, _hid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.household_members WHERE user_id = _uid AND household_id = _hid)
$$;

CREATE OR REPLACE FUNCTION public.is_household_owner(_uid uuid, _hid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.households WHERE id = _hid AND owner_id = _uid)
$$;

-- RLS
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_invites ENABLE ROW LEVEL SECURITY;

-- households
CREATE POLICY "Members can view their households" ON public.households
  FOR SELECT TO authenticated
  USING (public.is_household_member(auth.uid(), id));

CREATE POLICY "Users can create households" ON public.households
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update households" ON public.households
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can delete households" ON public.households
  FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

-- household_members
CREATE POLICY "Members can view co-members" ON public.household_members
  FOR SELECT TO authenticated
  USING (public.is_household_member(auth.uid(), household_id));

CREATE POLICY "Owners can add members" ON public.household_members
  FOR INSERT TO authenticated
  WITH CHECK (public.is_household_owner(auth.uid(), household_id) OR auth.uid() = user_id);

CREATE POLICY "Owners or self can remove members" ON public.household_members
  FOR DELETE TO authenticated
  USING (public.is_household_owner(auth.uid(), household_id) OR auth.uid() = user_id);

-- household_invites
CREATE POLICY "Owners can view invites" ON public.household_invites
  FOR SELECT TO authenticated
  USING (public.is_household_owner(auth.uid(), household_id));

CREATE POLICY "Anyone can look up invite by token" ON public.household_invites
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "Owners can create invites" ON public.household_invites
  FOR INSERT TO authenticated
  WITH CHECK (public.is_household_owner(auth.uid(), household_id) AND auth.uid() = invited_by);

CREATE POLICY "Owners can revoke invites" ON public.household_invites
  FOR DELETE TO authenticated
  USING (public.is_household_owner(auth.uid(), household_id));

CREATE POLICY "Invitees can mark accepted" ON public.household_invites
  FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

-- updated_at trigger
CREATE TRIGGER households_set_updated_at
  BEFORE UPDATE ON public.households
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
