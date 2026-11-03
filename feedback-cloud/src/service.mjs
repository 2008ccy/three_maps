import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';

export const feedbackTypes = ['内容错误', '链接问题', '使用体验', '其他建议'];
export const feedbackStatuses = ['待核实', '已采纳待修改', '已完成', '暂不采纳'];
export const feedbackIdPattern = /^FB-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const codepoints = (value) => Array.from(value).length;
export class ApiError extends Error {
  constructor(status, code, message, retryAfter) { super(message); Object.assign(this, { status, code, retryAfter }); }
}
export const unavailable = () => new ApiError(503, 'SERVICE_UNAVAILABLE', '共享反馈服务尚未完成配置或暂时不可用。');
const invalid = (message = '反馈信息无效，请检查内容与链接。') => new ApiError(400, 'INVALID_INPUT', message);
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
function strictKeys(value, allowed) { if (!object(value) || Object.keys(value).some((key) => !allowed.includes(key))) throw invalid(); }
function validDate(value) { return typeof value === 'string' && datePattern.test(value) && new Date(value).toISOString() === value; }
export function referenceUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !!url.hostname && !url.username && !url.password; } catch { return false; }
}
export function allowedOrigin(value) {
  try {
    const url = new URL(value);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    return value === url.origin && (url.protocol === 'https:' || local && url.protocol === 'http:');
  } catch { return false; }
}
export function targetKey(target) { return `${target.mapId}:${target.nodeId ?? ''}`; }
export function targetSet(manifest) {
  if (!Array.isArray(manifest?.maps) || manifest.maps.length !== 3) throw unavailable();
  const result = new Set();
  for (const map of manifest.maps) {
    if (!['domain', 'ecosystem', 'cognition'].includes(map.id) || !Array.isArray(map.nodes)) throw unavailable();
    result.add(targetKey({ mapId: map.id }));
    for (const node of map.nodes) {
      if (!/^[a-z0-9-]+$/.test(node.id)) throw unavailable();
      result.add(targetKey({ mapId: map.id, nodeId: node.id }));
    }
  }
  if (!['domain:', 'ecosystem:', 'cognition:'].every((key) => result.has(key))) throw unavailable();
  return result;
}
function validateTarget(value, targets) {
  strictKeys(value, ['mapId', 'nodeId']);
  if (!['domain', 'ecosystem', 'cognition'].includes(value.mapId) || value.nodeId !== undefined && (typeof value.nodeId !== 'string' || !/^[a-z0-9-]+$/.test(value.nodeId))) throw invalid();
  const target = { mapId: value.mapId, ...(value.nodeId ? { nodeId: value.nodeId } : {}) };
  if (targets && !targets.has(targetKey(target))) throw invalid('请选择当前有效的地图或知识点。');
  return target;
}
export function validateInput(value, targets) {
  strictKeys(value, ['target', 'type', 'content', 'nickname', 'referenceUrl']);
  const target = validateTarget(value.target, targets);
  if (!feedbackTypes.includes(value.type) || typeof value.content !== 'string') throw invalid();
  const content = value.content.trim();
  if (codepoints(content) < 5 || codepoints(content) > 1000) throw invalid('反馈内容需要5—1000字。');
  const optional = {};
  for (const key of ['nickname', 'referenceUrl']) {
    if (value[key] !== undefined && typeof value[key] !== 'string') throw invalid();
    const text = value[key]?.trim();
    if (text) optional[key] = text;
  }
  if (optional.nickname && codepoints(optional.nickname) > 20) throw invalid('昵称最多20字。');
  if (optional.referenceUrl && (codepoints(optional.referenceUrl) > 2048 || !referenceUrl(optional.referenceUrl))) throw invalid('参考链接需为有效的HTTP或HTTPS地址，最多2048字符。');
  return { target, type: value.type, content, ...optional };
}

// Every read (including idempotency replay) uses this explicit public projection.
export function publicFeedback(document, targets) {
  if (!document || document.isPublic !== true) return null;
  const input = validateInput({ target: document.target, type: document.type, content: document.content,
    ...(document.nickname !== undefined ? { nickname: document.nickname } : {}),
    // Historical feedback remains readable after a node is retired. Only new
    // submissions must use the current manifest; reads validate target shape.
    ...(document.referenceUrl !== undefined ? { referenceUrl: document.referenceUrl } : {}) }, undefined);
  if (!feedbackIdPattern.test(document.id) || !validDate(document.createdAt) || !feedbackStatuses.includes(document.status)) throw unavailable();
  const result = { id: document.id, ...input, createdAt: document.createdAt, status: document.status };
  for (const key of ['reply', 'resolution']) {
    if (document[key] !== undefined && (typeof document[key] !== 'string' || codepoints(document[key]) > 10000)) throw unavailable();
    if (document[key]) result[key] = document[key];
  }
  if (document.releaseVersion !== undefined && document.releaseVersion !== '') {
    if (typeof document.releaseVersion !== 'string' || !/^v\d+\.\d+$/.test(document.releaseVersion)) throw unavailable();
    result.releaseVersion = document.releaseVersion;
  }
  return result;
}
function digest(secret, purpose, value) { return createHmac('sha256', secret).update(purpose + '\0' + value).digest('hex'); }
function queryFilters(value) {
  strictKeys(value, ['map', 'type', 'status', 'cursor']);
  if (Object.values(value).some((item) => typeof item !== 'string')) throw invalid();
  const filters = {};
  for (const name of ['map', 'type', 'status']) if (value[name]) filters[name] = value[name];
  if (filters.map && !['domain', 'ecosystem', 'cognition'].includes(filters.map) || filters.type && !feedbackTypes.includes(filters.type) || filters.status && !feedbackStatuses.includes(filters.status)) throw invalid();
  return filters;
}
function encodeCursor(last, filters, secret) {
  const payload = Buffer.from(JSON.stringify({ createdAt: last.createdAt, id: last.id, filters })).toString('base64url');
  return payload + '.' + digest(secret, 'cursor', payload);
}
function decodeCursor(value, filters, secret) {
  if (!value) return undefined;
  if (typeof value !== 'string' || value.length > 1024 || !/^[A-Za-z0-9_-]+\.[a-f0-9]{64}$/.test(value)) throw invalid('分页位置无效，请重新查询。');
  const [payload, signature] = value.split('.');
  const expected = digest(secret, 'cursor', payload);
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw invalid('分页位置无效，请重新查询。');
  let parsed;
  try { parsed = JSON.parse(Buffer.from(payload, 'base64url').toString()); } catch { throw invalid(); }
  if (!validDate(parsed.createdAt) || !feedbackIdPattern.test(parsed.id) || JSON.stringify(parsed.filters) !== JSON.stringify(filters)) throw invalid('分页筛选已改变，请重新查询。');
  return { createdAt: parsed.createdAt, id: parsed.id };
}
function requestHeaders(headers) {
  if (!object(headers ?? {})) throw invalid();
  const normalized = {};
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (typeof value !== 'string') throw invalid();
    const lower = key.toLowerCase();
    if (lower in normalized) throw invalid();
    normalized[lower] = value;
  }
  return normalized;
}

export function createFeedbackHandler({ store, targets: manifest, allowedOrigins, secret, verified = false, trustedSource, clock = Date.now, uuid = randomUUID }) {
  let targets;
  try { targets = targetSet(manifest); } catch { /* An invalid target manifest closes the service. */ }
  const origins = new Set(allowedOrigins ?? []);
  const configured = verified && store && targets && typeof secret === 'string' && secret.length >= 32 && origins.size > 0 && [...origins].every(allowedOrigin);
  return async (event, context) => {
    let cors = {};
    const respond = (statusCode, body, extra = {}) => ({ statusCode, isBase64Encoded: false,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', Vary: 'Origin', 'X-Content-Type-Options': 'nosniff', ...cors, ...extra },
      body: statusCode === 204 ? '' : JSON.stringify(body) });
    try {
      if (!configured) throw unavailable();
      const headers = requestHeaders(event?.headers);
      const origin = headers.origin;
      if (origin && !origins.has(origin)) throw new ApiError(403, 'ORIGIN_NOT_ALLOWED', '当前网站未获准访问反馈服务。');
      if (origin) cors = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Expose-Headers': 'Retry-After' };
      const method = event?.httpMethod;
      const path = typeof event?.path === 'string' ? event.path.replace(/\/$/, '') : '';
      const id = path.startsWith('/feedback/') ? path.slice('/feedback/'.length) : undefined;
      if (path !== '/feedback' && !(id && feedbackIdPattern.test(id))) throw new ApiError(404, 'NOT_FOUND', '反馈接口不存在。');
      if (method === 'OPTIONS') {
        if (!origin || !['GET', 'POST'].includes(headers['access-control-request-method'])) throw invalid();
        const requested = (headers['access-control-request-headers'] ?? '').toLowerCase().split(',').map((item) => item.trim()).filter(Boolean);
        if (requested.some((header) => !['accept', 'content-type', 'idempotency-key'].includes(header))) throw invalid();
        return respond(204, null, { 'Access-Control-Allow-Methods': id ? 'GET, OPTIONS' : 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Accept, Content-Type, Idempotency-Key' });
      }
      if (!['GET', 'POST'].includes(method) || id && method !== 'GET') throw new ApiError(405, 'METHOD_NOT_ALLOWED', '访客不能修改、回复或删除反馈。');
      if (method === 'GET') {
        const query = event.queryStringParameters ?? {};
        if (id) {
          strictKeys(query, []);
          const item = publicFeedback(await store.get(id), targets);
          if (!item) throw new ApiError(404, 'NOT_FOUND', '这条反馈不存在或暂未公开。');
          return respond(200, { item });
        }
        const filters = queryFilters(query), cursor = decodeCursor(query.cursor, filters, secret);
        const rows = await store.list({ filters, cursor, limit: 21 });
        if (!Array.isArray(rows) || rows.length > 21) throw unavailable();
        const selected = rows.slice(0, 20);
        const items = selected.map((row) => publicFeedback(row, targets));
        if (items.some((item) => !item)) throw unavailable();
        return respond(200, { items, nextCursor: rows.length > 20 ? encodeCursor(selected.at(-1), filters, secret) : null });
      }
      if (!origin) throw new ApiError(403, 'ORIGIN_REQUIRED', '提交反馈需要有效的网站来源。');
      strictKeys(event.queryStringParameters ?? {}, []);
      if (!(headers['content-type'] ?? '').toLowerCase().match(/^application\/json(?:\s*;\s*charset=utf-8)?$/)) throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', '请使用JSON提交反馈。');
      const key = headers['idempotency-key'];
      if (!key || !/^[a-zA-Z0-9-]{16,100}$/.test(key)) throw invalid('提交请求标识无效，请刷新页面重试。');
      let text = event.body;
      if (typeof text !== 'string' || text.length > 24000) throw invalid();
      if (event.isBase64Encoded) text = Buffer.from(text, 'base64').toString('utf8');
      if (Buffer.byteLength(text, 'utf8') > 16000) throw invalid();
      let raw;
      try { raw = JSON.parse(text); } catch { throw invalid(); }
      const input = validateInput(raw, targets);
      const source = await trustedSource?.(context);
      if (typeof source !== 'string' || !isIP(source)) throw unavailable();
      const now = clock(), idValue = `FB-${uuid()}`;
      if (!Number.isFinite(now) || !feedbackIdPattern.test(idValue)) throw unavailable();
      const result = await store.create({
        idempotencyId: digest(secret, 'idempotency', key), payloadHash: digest(secret, 'payload', JSON.stringify(input)),
        sourceHash: digest(secret, 'source', source), now,
        record: { id: idValue, ...input, createdAt: new Date(now).toISOString(), status: '待核实', isPublic: true },
      });
      const item = publicFeedback(result.item, targets);
      if (!item) throw new ApiError(404, 'NOT_FOUND', '这条反馈不存在或暂未公开。');
      return respond(result.replayed ? 200 : 201, { item });
    } catch (error) {
      const safe = error instanceof ApiError ? error : unavailable();
      return respond(safe.status, { error: { code: safe.code, message: safe.message } }, safe.retryAfter ? { 'Retry-After': String(safe.retryAfter) } : {});
    }
  };
}
