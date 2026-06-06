-- family_invites
CREATE TABLE IF NOT EXISTS public.family_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_email text NOT NULL,
  invitee_name text NOT NULL,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer','emergency')),
  allowed_sections text[] NOT NULL DEFAULT ARRAY['essentials','networth','cashflow','goals'],
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','revoked')),
  personal_message text,
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  invitee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_invites TO authenticated;
GRANT ALL ON public.family_invites TO service_role;

ALTER TABLE public.family_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages own family invites"
  ON public.family_invites
  FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Invitee reads own family invite"
  ON public.family_invites
  FOR SELECT
  TO authenticated
  USING (auth.uid() = invitee_id);

CREATE INDEX IF NOT EXISTS family_invites_owner_idx ON public.family_invites(owner_id);
CREATE INDEX IF NOT EXISTS family_invites_token_idx ON public.family_invites(token);

-- family_access
CREATE TABLE IF NOT EXISTS public.family_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('viewer','emergency')),
  allowed_sections text[] NOT NULL DEFAULT ARRAY['essentials','networth','cashflow','goals'],
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, member_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_access TO authenticated;
GRANT ALL ON public.family_access TO service_role;

ALTER TABLE public.family_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages family access"
  ON public.family_access
  FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Member views own family access"
  ON public.family_access
  FOR SELECT
  TO authenticated
  USING (auth.uid() = member_id);

CREATE INDEX IF NOT EXISTS family_access_owner_idx ON public.family_access(owner_id);
CREATE INDEX IF NOT EXISTS family_access_member_idx ON public.family_access(member_id);