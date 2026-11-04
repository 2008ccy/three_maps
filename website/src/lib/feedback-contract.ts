import { z } from 'zod';
import { isLegacyMapArticle } from './document-navigation.ts';

export const feedbackTypes = ['内容错误', '链接问题', '使用体验', '其他建议'] as const;
export const feedbackStatuses = ['待核实', '已采纳待修改', '已完成', '暂不采纳'] as const;
export const feedbackIdPattern = /^FB-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const releaseVersionPattern = /^v\d+\.\d+$/;
const characterCount = (value: string) => Array.from(value).length;
export function isPublicReferenceUrl(value: string) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !!url.hostname && !url.username && !url.password;
  } catch { return false; }
}

export const feedbackTargetSchema = z.object({
  mapId: z.enum(['domain', 'ecosystem', 'cognition']),
  nodeId: z.string().regex(/^[a-z0-9-]+$/).optional(),
}).strict();
export const feedbackInputSchema = z.object({
  target: feedbackTargetSchema,
  type: z.enum(feedbackTypes),
  content: z.string().trim().refine((value) => characterCount(value) >= 5 && characterCount(value) <= 1000, '反馈内容需要5—1000字'),
  nickname: z.string().trim().refine((value) => characterCount(value) <= 20, '昵称最多20字').optional(),
  referenceUrl: z.string().trim().refine((value) => !value || characterCount(value) <= 2048 && isPublicReferenceUrl(value), '参考链接需为有效的HTTP或HTTPS地址，最多2048字符').optional(),
}).strict();
export const publicFeedbackSchema = z.object({
  id: z.string().regex(feedbackIdPattern), target: feedbackTargetSchema,
  type: z.enum(feedbackTypes), content: feedbackInputSchema.shape.content, nickname: feedbackInputSchema.shape.nickname,
  referenceUrl: feedbackInputSchema.shape.referenceUrl, createdAt: z.iso.datetime(),
  status: z.enum(feedbackStatuses), reply: z.string().refine((value) => characterCount(value) <= 10000).optional(),
  resolution: z.string().refine((value) => characterCount(value) <= 10000).optional(), releaseVersion: z.string().regex(releaseVersionPattern).optional(),
}).strip();
export const feedbackPageSchema = z.object({ items: z.array(publicFeedbackSchema).max(20), nextCursor: z.string().min(1).max(1024).nullable() }).strip();
export const feedbackFiltersSchema = z.object({
  map: feedbackTargetSchema.shape.mapId.optional(), type: z.enum(feedbackTypes).optional(),
  status: z.enum(feedbackStatuses).optional(), cursor: z.string().min(1).max(1024).optional(),
}).strict();
export type FeedbackTarget = z.infer<typeof feedbackTargetSchema>;
export type FeedbackInput = z.infer<typeof feedbackInputSchema>;
export type PublicFeedback = z.infer<typeof publicFeedbackSchema>;
export type FeedbackPage = z.infer<typeof feedbackPageSchema>;
export type FeedbackType = typeof feedbackTypes[number];
export type FeedbackStatus = typeof feedbackStatuses[number];
export type FeedbackFilters = { map?: FeedbackTarget['mapId']; type?: FeedbackType; status?: FeedbackStatus; cursor?: string };

export function feedbackHref(id: string) { return feedbackIdPattern.test(id) ? `/feedback/?id=${encodeURIComponent(id)}` : '/feedback/'; }
export function feedbackReleaseHref(version: string) { return releaseVersionPattern.test(version) ? `/docs/project/updates/#${version.replace('.', '-')}` : null; }
export function feedbackComposeHref(target: FeedbackTarget) {
  if (!feedbackTargetSchema.safeParse(target).success) return '/feedback/';
  const query = new URLSearchParams({ map: target.mapId });
  if (target.nodeId) query.set('node', target.nodeId);
  return `/feedback/?${query}`;
}
export function feedbackReferenceHref(value: string, origin: string, basePath = '') {
  if (!isPublicReferenceUrl(value)) return null;
  const url = new URL(value);
  if (url.origin === origin) {
    let pathname = url.pathname;
    try {
      for (let pass = 0; pass < 3; pass++) {
        const decoded = decodeURIComponent(pathname);
        if (decoded === pathname) break;
        pathname = decoded;
      }
    } catch { return null; }
    if (/%[0-9a-f]{2}/i.test(pathname)) return null;
    pathname = pathname.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
    if (basePath && pathname.startsWith(basePath + '/')) pathname = pathname.slice(basePath.length);
    if (isLegacyMapArticle(pathname)) return null;
  }
  return value;
}
