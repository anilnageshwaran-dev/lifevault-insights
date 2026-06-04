CREATE TABLE public.household_shared_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  display_name text,
  base_currency text NOT NULL DEFAULT 'INR',
  net_worth numeric NOT NULL DEFAULT 0,
  total_assets numeric NOT NULL DEFAULT 0,
  total_liabilities numeric NOT NULL DEFAULT 0,
  monthly_income numeric NOT NULL DEFAULT 0,
  monthly_expenses numeric NOT NULL DEFAULT 0,
  emergency_fund numeric NOT NULL DEFAULT 0,
  goal_count integer NOT NULL DEFAULT 0,
  account_count integer NOT NULL DEFAULT 0,
  health_score integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (household_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.household_shared_snapshots TO authenticated;
GRANT ALL ON public.household_shared_snapshots TO service_role;

ALTER TABLE public.household_shared_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view household snapshots"
ON public.household_shared_snapshots
FOR SELECT TO authenticated
USING (public.is_household_member(auth.uid(), household_id));

CREATE POLICY "Users can upsert their own snapshot"
ON public.household_shared_snapshots
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.is_household_member(auth.uid(), household_id));

CREATE POLICY "Users can update their own snapshot"
ON public.household_shared_snapshots
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own snapshot"
ON public.household_shared_snapshots
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER set_household_shared_snapshots_updated_at
BEFORE UPDATE ON public.household_shared_snapshots
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();