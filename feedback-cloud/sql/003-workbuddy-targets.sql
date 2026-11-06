-- Optional follow-up migration for the hosted WorkBuddy SQL002 path.
-- Prepared locally on 2026-11-06; this file does not apply itself to the cloud.
-- Validate and apply through the protected SQL administrator only after review.
-- Existing public/historical feedback stays readable; only NEW submissions must
-- reference a currently active target and use public URLs without credentials
-- or unencoded whitespace. Replaying this migration is safe.
BEGIN;
CREATE TABLE IF NOT EXISTS public.feedback_targets (
  map_id text NOT NULL CHECK (map_id IN ('domain', 'ecosystem', 'cognition')),
  node_id text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (map_id, node_id)
);
ALTER TABLE public.feedback_targets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.feedback_targets FROM anon, authenticated, PUBLIC;
UPDATE public.feedback_targets SET is_active = false;
INSERT INTO public.feedback_targets (map_id, node_id, is_active) VALUES
  ('domain', '', true),
  ('ecosystem', '', true),
  ('cognition', '', true),
  ('domain', 'task', true),
  ('domain', 'prediction', true),
  ('domain', 'generation', true),
  ('domain', 'alignment', true),
  ('domain', 'data', true),
  ('domain', 'collection', true),
  ('domain', 'cleaning', true),
  ('domain', 'evaluation-set', true),
  ('domain', 'model', true),
  ('domain', 'token', true),
  ('domain', 'attention', true),
  ('domain', 'transformer', true),
  ('domain', 'training', true),
  ('domain', 'pretraining', true),
  ('domain', 'loss', true),
  ('domain', 'finetuning', true),
  ('domain', 'lora', true),
  ('domain', 'system', true),
  ('domain', 'retrieval', true),
  ('domain', 'rag', true),
  ('domain', 'inference', true),
  ('domain', 'deployment', true),
  ('domain', 'monitoring', true),
  ('ecosystem', 'stage-publish', true),
  ('ecosystem', 'qwen', true),
  ('ecosystem', 'research-origins', true),
  ('ecosystem', 'model-releases', true),
  ('ecosystem', 'stage-adapt', true),
  ('ecosystem', 'huggingface', true),
  ('ecosystem', 'inference-tools', true),
  ('ecosystem', 'api-platforms', true),
  ('ecosystem', 'stage-apply', true),
  ('ecosystem', 'course-data', true),
  ('ecosystem', 'build-application', true),
  ('ecosystem', 'content-cost', true),
  ('ecosystem', 'stage-evaluate', true),
  ('ecosystem', 'benchmarks', true),
  ('ecosystem', 'evaluation-tools', true),
  ('ecosystem', 'evaluate-model', true),
  ('ecosystem', 'stage-feedback', true),
  ('ecosystem', 'user-feedback', true),
  ('ecosystem', 'official-information', true),
  ('ecosystem', 'inference-cost', true),
  ('cognition', 'perspectives', true),
  ('cognition', 'system-view', true),
  ('cognition', 'development-view', true),
  ('cognition', 'third-view', true),
  ('cognition', 'analysis-methods', true),
  ('cognition', 'loss-test', true),
  ('cognition', 'ranking-task', true),
  ('cognition', 'cost-api', true),
  ('cognition', 'habits', true),
  ('cognition', 'define-problem', true),
  ('cognition', 'small-trial', true),
  ('cognition', 'weekly-review', true),
  ('cognition', 'revision', true),
  ('cognition', 'revision-before', true),
  ('cognition', 'revision-evidence', true),
  ('cognition', 'revision-after', true)
ON CONFLICT (map_id, node_id) DO UPDATE SET is_active = EXCLUDED.is_active;

CREATE OR REPLACE FUNCTION public.feedback_validate_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF NEW.reference_url IS NOT NULL AND NEW.reference_url !~* '^https?://[^/?#@[:space:]]+([/?#][^[:space:]]*)?$' THEN
    RAISE EXCEPTION 'invalid public reference url' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.feedback_targets t
    WHERE t.map_id = NEW.map_id AND t.node_id = coalesce(NEW.node_id, '') AND t.is_active
  ) THEN
    RAISE EXCEPTION 'invalid or retired feedback target' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public.feedback_validate_submission() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE TRIGGER feedback_submission_guard
  BEFORE INSERT ON public.feedback
  FOR EACH ROW EXECUTE FUNCTION public.feedback_validate_submission();
COMMIT;
