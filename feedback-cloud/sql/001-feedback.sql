-- Run once in the existing WorkBuddy PostgreSQL database with its administrator.
-- No extension, public RPC, browser key, or new cloud environment is required.
-- Do not add this schema to the platform's client-exposed API schemas.
BEGIN;
CREATE SCHEMA IF NOT EXISTS feedback_private;
REVOKE ALL ON SCHEMA feedback_private FROM PUBLIC;

DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'three_maps_feedback_backend') THEN
    CREATE ROLE three_maps_feedback_backend NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END
$role$;

CREATE TABLE IF NOT EXISTS feedback_private.feedback (
  id text COLLATE "C" PRIMARY KEY CHECK (id ~* '^FB-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  target jsonb NOT NULL CHECK (jsonb_typeof(target) = 'object' AND target ->> 'mapId' IN ('domain', 'ecosystem', 'cognition')),
  type text NOT NULL CHECK (type IN ('内容错误', '链接问题', '使用体验', '其他建议')),
  content text NOT NULL CHECK (char_length(content) BETWEEN 5 AND 1000),
  nickname text CHECK (char_length(nickname) <= 20),
  reference_url text,
  created_at timestamptz(3) NOT NULL,
  status text NOT NULL DEFAULT '待核实' CHECK (status IN ('待核实', '已采纳待修改', '已完成', '暂不采纳')),
  is_public boolean NOT NULL DEFAULT true,
  reply text CHECK (char_length(reply) <= 10000),
  resolution text CHECK (char_length(resolution) <= 10000),
  release_version text CHECK (release_version IS NULL OR release_version = '' OR release_version ~ '^v[0-9]+\.[0-9]+$'),
  internal_notes text
);
CREATE TABLE IF NOT EXISTS feedback_private.feedback_requests (
  idempotency_id text COLLATE "C" PRIMARY KEY CHECK (idempotency_id ~ '^[0-9a-f]{64}$'),
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  feedback_id text NOT NULL REFERENCES feedback_private.feedback(id) DEFERRABLE INITIALLY DEFERRED,
  created_at timestamptz(3) NOT NULL
);
CREATE TABLE IF NOT EXISTS feedback_private.feedback_rate_limits (
  source_hash text COLLATE "C" PRIMARY KEY CHECK (source_hash ~ '^[0-9a-f]{64}$'),
  minute_window bigint NOT NULL CHECK (minute_window >= 0),
  count integer NOT NULL CHECK (count BETWEEN 0 AND 5),
  updated_at timestamptz(3) NOT NULL
);

-- Match all eight public map/type/status filter combinations plus keyset paging.
CREATE INDEX IF NOT EXISTS feedback_public_time ON feedback_private.feedback (created_at DESC, id DESC) WHERE is_public;
CREATE INDEX IF NOT EXISTS feedback_public_map ON feedback_private.feedback ((target ->> 'mapId'), created_at DESC, id DESC) WHERE is_public;
CREATE INDEX IF NOT EXISTS feedback_public_type ON feedback_private.feedback (type, created_at DESC, id DESC) WHERE is_public;
CREATE INDEX IF NOT EXISTS feedback_public_status ON feedback_private.feedback (status, created_at DESC, id DESC) WHERE is_public;
CREATE INDEX IF NOT EXISTS feedback_public_map_type ON feedback_private.feedback ((target ->> 'mapId'), type, created_at DESC, id DESC) WHERE is_public;
CREATE INDEX IF NOT EXISTS feedback_public_map_status ON feedback_private.feedback ((target ->> 'mapId'), status, created_at DESC, id DESC) WHERE is_public;
CREATE INDEX IF NOT EXISTS feedback_public_type_status ON feedback_private.feedback (type, status, created_at DESC, id DESC) WHERE is_public;
CREATE INDEX IF NOT EXISTS feedback_public_map_type_status ON feedback_private.feedback ((target ->> 'mapId'), type, status, created_at DESC, id DESC) WHERE is_public;

REVOKE ALL ON ALL TABLES IN SCHEMA feedback_private FROM PUBLIC;
ALTER TABLE feedback_private.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_private.feedback_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_private.feedback_rate_limits ENABLE ROW LEVEL SECURITY;
-- New tables have no anonymous/authenticated policies. The dedicated server role
-- gets only the operations the three endpoints actually need (no admin updates).
GRANT USAGE ON SCHEMA feedback_private TO three_maps_feedback_backend;
GRANT SELECT, INSERT ON feedback_private.feedback TO three_maps_feedback_backend;
GRANT SELECT, INSERT ON feedback_private.feedback_requests TO three_maps_feedback_backend;
GRANT SELECT, INSERT, UPDATE ON feedback_private.feedback_rate_limits TO three_maps_feedback_backend;
DO $policies$
DECLARE entry text;
BEGIN
  FOREACH entry IN ARRAY ARRAY['feedback', 'feedback_requests', 'feedback_rate_limits'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'feedback_private' AND tablename = entry AND policyname = 'feedback_server_access') THEN
      EXECUTE format('CREATE POLICY feedback_server_access ON feedback_private.%I FOR ALL TO three_maps_feedback_backend USING (true) WITH CHECK (true)', entry);
    END IF;
  END LOOP;
END
$policies$;
COMMIT;

-- In the protected DB console, create/select a server-only LOGIN role with a
-- strong password, then grant membership. Do not use anon/authenticated roles:
-- GRANT three_maps_feedback_backend TO your_server_only_login;
-- That login's private URL belongs only in FEEDBACK_POSTGRES_URL on the function.
-- The table owner/platform administrator handles status, replies and visibility.
