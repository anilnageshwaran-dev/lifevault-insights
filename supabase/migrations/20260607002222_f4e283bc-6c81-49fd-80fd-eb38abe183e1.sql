CREATE TABLE IF NOT EXISTS public.landing_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  name text,
  comment text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.landing_feedback TO anon, authenticated;
GRANT SELECT ON public.landing_feedback TO authenticated;
GRANT ALL ON public.landing_feedback TO service_role;

ALTER TABLE public.landing_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit feedback"
  ON public.landing_feedback
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    char_length(comment) BETWEEN 1 AND 2000
    AND (name IS NULL OR char_length(name) <= 80)
  );

CREATE POLICY "Authenticated users can read feedback"
  ON public.landing_feedback
  FOR SELECT
  TO authenticated
  USING (true);