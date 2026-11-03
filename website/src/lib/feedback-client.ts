import { z } from 'zod';
import { feedbackInputSchema, feedbackPageSchema, publicFeedbackSchema, feedbackIdPattern, type FeedbackFilters, type FeedbackInput } from './feedback-contract.ts';
import { findFeedbackTarget } from './feedback-targets.ts';

export class FeedbackApiError extends Error {
  code: string; status: number; retryAfter?: number;
  constructor(code: string, message: string, status = 0, retryAfter?: number) { super(message); this.name = 'FeedbackApiError'; this.code = code; this.status = status; this.retryAfter = retryAfter; }
}
export function feedbackServiceConfig(value: string | undefined, verified: string | undefined) {
  if (!value) return { configured: false, baseUrl: '', message: '反馈服务尚未接通，当前无法提交或查看反馈。' };
  try {
    const url = new URL(value);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash || !(url.protocol === 'https:' || local && url.protocol === 'http:')) throw new Error('Invalid URL');
    if (verified !== 'true') return { configured: false, baseUrl: '', message: '共享反馈尚在准备中，暂不接受提交。' };
    return { configured: true, baseUrl: url.toString().replace(/\/$/, ''), message: '' };
  } catch { return { configured: false, baseUrl: '', message: '共享反馈服务配置无效，暂时无法提交或读取反馈。' }; }
}
export const feedbackService = feedbackServiceConfig(process.env.NEXT_PUBLIC_FEEDBACK_API_BASE_URL, process.env.NEXT_PUBLIC_FEEDBACK_SERVICE_VERIFIED);

export function createFeedbackClient(config = feedbackService, fetcher: typeof fetch = globalThis.fetch, timeoutMs = 12000) {
async function request(path: string, schema: z.ZodType, options: RequestInit = {}, signal?: AbortSignal) {
  if (!config.configured) throw new FeedbackApiError('NOT_CONFIGURED', config.message);
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, timeoutMs);
  try {
    const response = await fetcher(config.baseUrl + path, { ...options, signal: controller.signal, credentials: 'omit', cache: 'no-store', headers: { Accept: 'application/json', ...options.headers } });
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const retryAfter = Number(response.headers.get('Retry-After'));
      const messages: Record<number, string> = { 400: '反馈信息无效，请检查内容与链接。', 404: '这条反馈不存在或暂未公开。', 409: '这次提交与先前请求不一致，请重新提交。', 429: '提交过于频繁，请稍后重试。', 503: '共享反馈服务暂时不可用，请稍后重试。' };
      throw new FeedbackApiError(`HTTP_${response.status}`, messages[response.status] ?? '反馈服务返回错误，请稍后重试。', response.status, retryAfter > 0 ? retryAfter : undefined);
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
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
  return await request(`/feedback${query.size ? `?${query}` : ''}`, feedbackPageSchema, {}, signal) as z.infer<typeof feedbackPageSchema>;
}
async function getFeedback(id: string, signal?: AbortSignal) {
  if (!feedbackIdPattern.test(id)) throw new FeedbackApiError('INVALID_ID', '反馈编号无效。');
  const data = await request(`/feedback/${encodeURIComponent(id)}`, z.object({ item: publicFeedbackSchema }).strip(), {}, signal) as { item: z.infer<typeof publicFeedbackSchema> };
  return data.item;
}
async function submitFeedback(input: FeedbackInput, idempotencyKey: string, signal?: AbortSignal) {
  const parsed = feedbackInputSchema.safeParse(input);
  if (!parsed.success || !findFeedbackTarget(input.target)) throw new FeedbackApiError('INVALID_INPUT', parsed.success ? '请选择当前有效的地图或知识点。' : parsed.error.issues[0]?.message ?? '反馈信息无效。');
  if (!/^[a-zA-Z0-9-]{16,100}$/.test(idempotencyKey)) throw new FeedbackApiError('INVALID_REQUEST', '提交请求无效，请刷新页面重试。');
  const data = await request('/feedback', z.object({ item: publicFeedbackSchema }).strip(), { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey }, body: JSON.stringify(parsed.data) }, signal) as { item: z.infer<typeof publicFeedbackSchema> };
  return data.item;
}
return { listFeedback, getFeedback, submitFeedback };
}
export const { listFeedback, getFeedback, submitFeedback } = createFeedbackClient();
