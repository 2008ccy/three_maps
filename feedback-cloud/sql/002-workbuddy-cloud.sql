-- WorkBuddy 云服务（托管 PostgreSQL 17 / PostgREST 数据面）反馈表
--
-- 与 sql/001-feedback.sql 的区别（同一业务模型，不同执行位置）：
--   * 001 假设云函数用独立服务器登录角色直连 PostgreSQL，于是把权限放在专用角色
--     与私有 schema 上。
--   * 本文件面向 WorkBuddy 云服务的托管数据库：只有一个 public schema，访客经
--     PostgREST 以 anon 角色访问，没有可用的服务器进程。
--   因此把"接口"实现为三个 public 下的 SECURITY DEFINER 函数：访客对表零权限，
--   只能执行这三个函数；管理员仍通过「云服务 → 数据库 → 数据」以管理员角色读写表。
--
-- 访客能力（requirement 2/3/4）：
--   * 可提交：submit_feedback
--   * 可读公开：list_feedback / get_feedback（只返回 is_public = true 的投影）
--   * 不可改状态、不可回复、不可删除：anon 没有表的 UPDATE/DELETE 权限，
--     也没有任何策略授予它；函数体内也不更新既有行。
--
-- 字段命名：数据库用 snake_case，HTTP/前端用 camelCase（由函数内投影完成）。

-- ---------------------------------------------------------------------------
-- 1. 表
-- ---------------------------------------------------------------------------
CREATE TABLE public.feedback (
  id              text COLLATE "C" NOT NULL DEFAULT ('FB-' || gen_random_uuid()::text),
  map_id          text        NOT NULL,
  node_id         text,
  type            text        NOT NULL,
  content         text        NOT NULL,
  nickname        text,
  reference_url   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  status          text        NOT NULL DEFAULT '待核实',
  reply           text,
  resolution      text,
  release_version text,
  is_public       boolean     NOT NULL DEFAULT true,
  internal_notes  text,
  request_key     text,
  request_hash    text,
  CONSTRAINT feedback_pkey PRIMARY KEY (id),
  CONSTRAINT feedback_request_key_key UNIQUE (request_key),
  CONSTRAINT feedback_map_id_check CHECK (map_id IN ('domain', 'ecosystem', 'cognition')),
  CONSTRAINT feedback_node_id_check CHECK (node_id IS NULL OR node_id ~ '^[a-z0-9-]+$'),
  CONSTRAINT feedback_type_check CHECK (type IN ('内容错误', '链接问题', '使用体验', '其他建议')),
  CONSTRAINT feedback_content_check CHECK (char_length(btrim(content)) BETWEEN 5 AND 1000),
  CONSTRAINT feedback_nickname_check CHECK (nickname IS NULL OR char_length(nickname) <= 20),
  CONSTRAINT feedback_reference_url_check CHECK (
    reference_url IS NULL OR (
      char_length(reference_url) <= 2048
      AND reference_url ~* '^https?://[^/?#@[:space:]]+'
    )
  ),
  CONSTRAINT feedback_status_check CHECK (status IN ('待核实', '已采纳待修改', '已完成', '暂不采纳')),
  CONSTRAINT feedback_reply_check CHECK (reply IS NULL OR char_length(reply) <= 10000),
  CONSTRAINT feedback_resolution_check CHECK (resolution IS NULL OR char_length(resolution) <= 10000),
  CONSTRAINT feedback_release_version_check CHECK (release_version IS NULL OR release_version ~ '^v[0-9]+\.[0-9]+$')
);

COMMENT ON TABLE public.feedback IS
  '三张活地图的公开反馈。访客只能通过 submit_feedback / list_feedback / get_feedback 三个函数提交与读取；本表由小组在「云服务→数据库→数据」中维护状态、回复与公开可见性。字段说明见各列注释。';

COMMENT ON COLUMN public.feedback.id            IS '反馈编号。服务端自动生成 FB- + UUIDv4，稳定不变，请勿手工修改。';
COMMENT ON COLUMN public.feedback.map_id        IS '所属地图：domain=领域地图，ecosystem=生态地图，cognition=认知地图。';
COMMENT ON COLUMN public.feedback.node_id       IS '知识点 id（小写字母/数字/连字符）。留空表示针对整张地图。';
COMMENT ON COLUMN public.feedback.type          IS '反馈类型：内容错误 / 链接问题 / 使用体验 / 其他建议。';
COMMENT ON COLUMN public.feedback.content       IS '访客填写的反馈正文，纯文本，5—1000 字。请勿改动原文。';
COMMENT ON COLUMN public.feedback.nickname      IS '访客昵称，最多 20 字。留空表示匿名访客。';
COMMENT ON COLUMN public.feedback.reference_url IS '访客提供的参考链接，仅 HTTP/HTTPS，最多 2048 字符。可为空。';
COMMENT ON COLUMN public.feedback.created_at    IS '提交时间（UTC）。自动生成，请勿修改。';
COMMENT ON COLUMN public.feedback.status        IS '处理状态：待核实 / 已采纳待修改 / 已完成 / 暂不采纳。小组在此字段更新进度。';
COMMENT ON COLUMN public.feedback.reply         IS '公开回复。小组写给访客的答复，会显示在反馈页「小组回复」。可为空。';
COMMENT ON COLUMN public.feedback.resolution    IS '公开处理说明。说明改了什么或为什么不采纳，显示在「处理说明」。内部备注请勿写在这里。';
COMMENT ON COLUMN public.feedback.release_version IS '实际已发布的版本号，格式 v1.5。仅在该版本真正上线后填写；留空表示尚未关联版本。';
COMMENT ON COLUMN public.feedback.is_public     IS '是否公开展示。true=公开（默认），false=隐藏：列表、详情与提交重放都不再对外返回。';
COMMENT ON COLUMN public.feedback.internal_notes IS '内部管理备注，仅管理员可见。访客与公开接口永远读不到此列。';
COMMENT ON COLUMN public.feedback.request_key   IS '提交幂等键（浏览器生成），用于防止重复提交。内部字段，不对外返回。';
COMMENT ON COLUMN public.feedback.request_hash  IS '该幂等键对应的内容指纹，用于识别同键不同内容的冲突。内部字段。';

-- 分页与筛选索引（只索引公开行）
CREATE INDEX feedback_public_created_idx ON public.feedback (created_at DESC, id DESC) WHERE is_public;
CREATE INDEX feedback_public_map_idx     ON public.feedback (map_id, created_at DESC, id DESC) WHERE is_public;
CREATE INDEX feedback_public_type_idx    ON public.feedback (type, created_at DESC, id DESC) WHERE is_public;
CREATE INDEX feedback_public_status_idx  ON public.feedback (status, created_at DESC, id DESC) WHERE is_public;

-- ---------------------------------------------------------------------------
-- 2. 权限：默认全关
-- ---------------------------------------------------------------------------
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.feedback FROM anon, authenticated, PUBLIC;

-- ---------------------------------------------------------------------------
-- 3. 公开投影（内部工具，禁止直接调用）
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.feedback_public_item(p public.feedback)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $fn$
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'id',             p.id,
    'target',         jsonb_strip_nulls(jsonb_build_object('mapId', p.map_id, 'nodeId', p.node_id)),
    'type',           p.type,
    'content',        p.content,
    'nickname',       p.nickname,
    'referenceUrl',   p.reference_url,
    'createdAt',      to_char(p.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'status',         p.status,
    'reply',          p.reply,
    'resolution',     p.resolution,
    'releaseVersion', p.release_version
  ));
$fn$;

REVOKE ALL ON FUNCTION public.feedback_public_item(public.feedback) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. 访客接口
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_feedback(
  p_request_key   text,
  p_map_id        text,
  p_node_id       text DEFAULT NULL,
  p_type          text DEFAULT NULL,
  p_content       text DEFAULT NULL,
  p_nickname      text DEFAULT NULL,
  p_reference_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_key     text := btrim(coalesce(p_request_key, ''));
  v_map     text := nullif(btrim(coalesce(p_map_id, '')), '');
  v_node    text := nullif(btrim(coalesce(p_node_id, '')), '');
  v_type    text := nullif(btrim(coalesce(p_type, '')), '');
  v_content text := nullif(btrim(coalesce(p_content, '')), '');
  v_nick    text := nullif(btrim(coalesce(p_nickname, '')), '');
  v_url     text := nullif(btrim(coalesce(p_reference_url, '')), '');
  v_hash    text;
  v_row     public.feedback;
  v_public  boolean;
BEGIN
  IF v_key !~ '^[A-Za-z0-9-]{16,100}$' THEN
    RAISE EXCEPTION 'invalid request key' USING ERRCODE = '22023';
  END IF;
  IF v_map IS NULL OR v_map NOT IN ('domain', 'ecosystem', 'cognition') THEN
    RAISE EXCEPTION 'invalid target map' USING ERRCODE = '22023';
  END IF;
  IF v_node IS NOT NULL AND v_node !~ '^[a-z0-9-]+$' THEN
    RAISE EXCEPTION 'invalid target node' USING ERRCODE = '22023';
  END IF;
  IF v_type IS NULL OR v_type NOT IN ('内容错误', '链接问题', '使用体验', '其他建议') THEN
    RAISE EXCEPTION 'invalid type' USING ERRCODE = '22023';
  END IF;
  IF v_content IS NULL OR char_length(v_content) < 5 OR char_length(v_content) > 1000 THEN
    RAISE EXCEPTION 'invalid content' USING ERRCODE = '22023';
  END IF;
  IF v_nick IS NOT NULL AND char_length(v_nick) > 20 THEN
    RAISE EXCEPTION 'invalid nickname' USING ERRCODE = '22023';
  END IF;
  IF v_url IS NOT NULL AND (char_length(v_url) > 2048 OR v_url !~* '^https?://[^/?#@[:space:]]+') THEN
    RAISE EXCEPTION 'invalid reference url' USING ERRCODE = '22023';
  END IF;

  v_hash := md5(concat_ws(E'\x1f', v_map, coalesce(v_node, ''), v_type, v_content, coalesce(v_nick, ''), coalesce(v_url, '')));

  -- 幂等重放：同键同内容直接返回原编号，不重复写入。
  SELECT * INTO v_row FROM public.feedback f WHERE f.request_key = v_key;
  IF FOUND THEN
    IF v_row.request_hash IS DISTINCT FROM v_hash THEN
      RAISE EXCEPTION 'idempotency conflict' USING ERRCODE = '23505';
    END IF;
    v_public := v_row.is_public;
    IF NOT v_public THEN
      RAISE EXCEPTION 'feedback not public' USING ERRCODE = 'P0002';
    END IF;
    RETURN public.feedback_public_item(v_row);
  END IF;

  -- 访客可控字段之外，状态/时间/编号/公开位一律由数据库默认值决定。
  INSERT INTO public.feedback (map_id, node_id, type, content, nickname, reference_url, request_key, request_hash)
  VALUES (v_map, v_node, v_type, v_content, v_nick, v_url, v_key, v_hash)
  ON CONFLICT (request_key) DO NOTHING
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    SELECT * INTO v_row FROM public.feedback f WHERE f.request_key = v_key;
    IF v_row.request_hash IS DISTINCT FROM v_hash THEN
      RAISE EXCEPTION 'idempotency conflict' USING ERRCODE = '23505';
    END IF;
    IF NOT v_row.is_public THEN
      RAISE EXCEPTION 'feedback not public' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  RETURN public.feedback_public_item(v_row);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.list_feedback(
  p_map    text DEFAULT NULL,
  p_type   text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_cursor text DEFAULT NULL,
  p_limit  integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_map    text := nullif(btrim(coalesce(p_map, '')), '');
  v_type   text := nullif(btrim(coalesce(p_type, '')), '');
  v_status text := nullif(btrim(coalesce(p_status, '')), '');
  v_cursor text := nullif(btrim(coalesce(p_cursor, '')), '');
  v_limit  integer := least(greatest(coalesce(p_limit, 20), 1), 20);
  v_cut_ts timestamptz;
  v_cut_id text;
  v_rows   public.feedback[];
  v_last   public.feedback;
  v_items  jsonb := '[]'::jsonb;
  v_next   text := NULL;
  v_n      integer := 0;
  i        integer;
BEGIN
  IF v_map    IS NOT NULL AND v_map    NOT IN ('domain', 'ecosystem', 'cognition') THEN
    RAISE EXCEPTION 'invalid map filter' USING ERRCODE = '22023';
  END IF;
  IF v_type   IS NOT NULL AND v_type   NOT IN ('内容错误', '链接问题', '使用体验', '其他建议') THEN
    RAISE EXCEPTION 'invalid type filter' USING ERRCODE = '22023';
  END IF;
  IF v_status IS NOT NULL AND v_status NOT IN ('待核实', '已采纳待修改', '已完成', '暂不采纳') THEN
    RAISE EXCEPTION 'invalid status filter' USING ERRCODE = '22023';
  END IF;

  IF v_cursor IS NOT NULL THEN
    IF v_cursor !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}Z_FB-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'invalid cursor' USING ERRCODE = '22023';
    END IF;
    v_cut_ts := (split_part(v_cursor, '_', 1))::timestamptz;
    v_cut_id := split_part(v_cursor, '_', 2);
  END IF;

  SELECT coalesce(array_agg(t ORDER BY t.created_at DESC, t.id DESC), '{}')
    INTO v_rows
  FROM (
    SELECT f.*
    FROM public.feedback f
    WHERE f.is_public
      AND (v_map    IS NULL OR f.map_id = v_map)
      AND (v_type   IS NULL OR f.type   = v_type)
      AND (v_status IS NULL OR f.status = v_status)
      AND (v_cut_ts IS NULL OR (f.created_at, f.id) < (v_cut_ts, v_cut_id))
    ORDER BY f.created_at DESC, f.id DESC
    LIMIT v_limit + 1
  ) t;

  v_n := coalesce(array_length(v_rows, 1), 0);
  FOR i IN 1 .. v_n LOOP
    EXIT WHEN i > v_limit;
    v_items := v_items || jsonb_build_array(public.feedback_public_item(v_rows[i]));
  END LOOP;

  IF v_n > v_limit THEN
    v_last := v_rows[v_limit];
    v_next := to_char(v_last.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') || '_' || v_last.id;
  END IF;

  RETURN jsonb_build_object('items', v_items, 'nextCursor', v_next);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.get_feedback(p_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_row public.feedback;
BEGIN
  IF p_id IS NULL OR p_id !~ '^FB-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'invalid feedback id' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_row FROM public.feedback f WHERE f.id = p_id AND f.is_public;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  RETURN public.feedback_public_item(v_row);
END;
$fn$;

-- 访客只能执行这三个函数，表的读写权限保持关闭。
REVOKE ALL ON FUNCTION public.submit_feedback(text, text, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_feedback(text, text, text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_feedback(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.submit_feedback(text, text, text, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_feedback(text, text, text, text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_feedback(text) TO anon, authenticated;
