import { z } from 'zod';
import { feedbackInputSchema, feedbackPageSchema, publicFeedbackSchema, feedbackFiltersSchema, feedbackIdPattern, type FeedbackFilters, type FeedbackInput } from './feedback-contract.ts';
import { findFeedbackTarget } from './feedback-targets.ts';
import { cloudFeedbackConfig, createCloudFeedbackFetcher } from './feedback-cloud.ts';

export class FeedbackApiError extends Error {
  code: string; status: number; retryAfter?: number;
  constructor(code: string, message: string, status = 0, retryAfter?: number) { super(message); this.name = 'FeedbackApiError'; this.code = code; this.status = status; this.retryAfter = retryAfter; }
}
export type FeedbackService = { configured: boolean; baseUrl: string; message: string };
export function feedbackServiceConfig(value: string | undefined, verified: string | undefined): FeedbackService {
  if (!value) return { configured: false, baseUrl: '', message: '反馈服务尚未接通，当前无法提交或查看反馈。' };
  try {
    const url = new URL(value);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash || !(url.protocol === 'https:' || local && url.protocol === 'http:')) throw new Error('Invalid URL');
    if (verified !== 'true') return { configured: false, baseUrl: '', message: '共享反馈尚在准备中，暂不接受提交。' };
    return { configured: true, baseUrl: url.toString().replace(/\/$/, ''), message: '' };
  } catch { return { configured: false, baseUrl: '', message: '共享反馈服务配置无效，暂时无法提交或读取反馈。' }; }
}
// 传输层二选一：优先使用 WorkBuddy 云数据库（当前接入方式）；未配置时退回
// 原有的自建 HTTP 接口配置，两者都未配置则整体关闭，绝不发请求。
const cloudService = cloudFeedbackConfig();
export const feedbackService: FeedbackService = cloudService.configured
  ? cloudService
  : feedbackServiceConfig(process.env.NEXT_PUBLIC_FEEDBACK_API_BASE_URL, process.env.NEXT_PUBLIC_FEEDBACK_SERVICE_VERIFIED);
export const { listFeedback, getFeedback, submitFeedback } = createFeedbackClient(feedbackService, cloudService.configured ? createCloudFeedbackFetcher() : undefined);

export function createFeedbackClient(config = feedbackService, fetcher: typeof fetch = globalThis.fetch, timeoutMs = 12000) {
async function request<T>(path: string, schema: z.ZodType<T>, options: RequestInit = {}, signal?: AbortSignal): Promise<T> {
  if (!config.configured) throw new FeedbackApiError('NOT_CONFIGURED', config.message);
  if (signal?.aborted) throw new FeedbackApiError('ABORTED', '已取消请求。');
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, timeoutMs);
  try {
    const response = await fetcher(config.baseUrl + path, { ...options, signal: controller.signal, credentials: 'omit', cache: 'no-store', headers: { Accept: 'application/json', ...options.headers } });
    const data: unknown = await response.json().catch((error: unknown) => {
      if (controller.signal.aborted) throw error;
      return null;
    });
    if (!response.ok) {
      const header = response.headers.get('Retry-After');
      const seconds = header && /^\d+$/.test(header) ? Number(header) : header ? Math.ceil((Date.parse(header) - Date.now()) / 1000) : 0;
      const retryAfter = Number.isFinite(seconds) && seconds > 0 ? Math.min(3600, seconds) : undefined;
      const messages: Record<number, string> = { 400: '反馈信息无效，请检查内容与链接。', 403: '当前网站未获准访问反馈服务，请联系网站维护者。', 404: '这条反馈不存在或暂未公开。', 409: '这次提交与先前请求不一致，请重新提交。', 413: '提交内容过长，请缩短后重试。', 415: '反馈接口协议不兼容，请联系网站维护者。', 429: '提交过于频繁，请稍后重试。', 503: '共享反馈服务暂时不可用，请稍后重试。' };
      throw new FeedbackApiError(`HTTP_${response.status}`, messages[response.status] ?? '反馈服务返回错误，请稍后重试。', response.status, retryAfter);
    }
    const parsed = schema.safeParse(data);
    if (!parsed.success) throw new FeedbackApiError('INVALID_RESPONSE', '反馈服务返回的数据无法识别，请稍后重试。');
    return parsed.data;
  } catch (error) {
    if (error instanceof FeedbackApiError) throw error;
    if (signal?.aborted) throw new FeedbackApiError('ABORTED', '已取消请求。');
    throw new FeedbackApiError(controller.signal.aborted ? 'TIMEOUT' : 'NETWORK', controller.signal.aborted ? '反馈服务响应超时，请重试。' : '网络连接失败，请检查网络后重试。');
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}

async function listFeedback(filters: FeedbackFilters = {}, signal?: AbortSignal) {
  const validated = feedbackFiltersSchema.safeParse(filters);
  if (!validated.success) throw new FeedbackApiError('INVALID_FILTERS', '筛选条件无效，请重新选择。');
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(validated.data)) if (value) query.set(key, value);
  const page = await request(`/feedback${query.size ? `?${query}` : ''}`, feedbackPageSchema, {}, signal);
  if (new Set(page.items.map((item) => item.id)).size !== page.items.length || page.items.some((item) =>
    filters.map && item.target.mapId !== filters.map || filters.type && item.type !== filters.type || filters.status && item.status !== filters.status)) {
    throw new FeedbackApiError('INVALID_RESPONSE', '反馈服务返回的列表与筛选条件不一致，请稍后重试。');
  }
  return page;
}
async function getFeedback(id: string, signal?: AbortSignal) {
  if (!feedbackIdPattern.test(id)) throw new FeedbackApiError('INVALID_ID', '反馈编号无效。');
  const data = await request(`/feedback/${encodeURIComponent(id)}`, z.object({ item: publicFeedbackSchema }).strip(), {}, signal);
  if (data.item.id !== id) throw new FeedbackApiError('INVALID_RESPONSE', '反馈服务返回的编号不一致，请稍后重试。');
  return data.item;
}
async function submitFeedback(input: FeedbackInput, idempotencyKey: string, signal?: AbortSignal) {
  const parsed = feedbackInputSchema.safeParse(input);
  if (!parsed.success || !findFeedbackTarget(input.target)) throw new FeedbackApiError('INVALID_INPUT', parsed.success ? '请选择当前有效的地图或知识点。' : parsed.error.issues[0]?.message ?? '反馈信息无效。');
  if (!/^[a-zA-Z0-9-]{16,100}$/.test(idempotencyKey)) throw new FeedbackApiError('INVALID_REQUEST', '提交请求无效，请刷新页面重试。');
  const data = await request('/feedback', z.object({ item: publicFeedbackSchema }).strip(), { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey }, body: JSON.stringify(parsed.data) }, signal);
  const item = data.item, expected = parsed.data;
  if (item.target.mapId !== expected.target.mapId || item.target.nodeId !== expected.target.nodeId || item.type !== expected.type || item.content !== expected.content || (item.nickname ?? '') !== (expected.nickname ?? '') || (item.referenceUrl ?? '') !== (expected.referenceUrl ?? '')) {
    throw new FeedbackApiError('INVALID_RESPONSE', '反馈服务返回的内容与本次提交不一致，请保留内容并重试。');
  }
  return data.item;
}
return { listFeedback, getFeedback, submitFeedback };
}
