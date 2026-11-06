import type { FeedbackService } from './feedback-client.ts';

// 云端数据面适配层。
//
// 反馈页原本通过 HTTP + fetch 访问自建接口（/feedback、/feedback/{id}）。
// WorkBuddy 云服务只提供托管 PostgreSQL + PostgREST 数据面，没有可部署的
// HTTP 函数进程，因此这里把同一套 HTTP 契约映射到数据库函数：
//
//   GET  /feedback        → rpc('list_feedback')
//   GET  /feedback/{id}   → rpc('get_feedback')
//   POST /feedback        → rpc('submit_feedback')
//
// 这三个函数在数据库里是 SECURITY DEFINER，访客角色对 feedback 表本身没有
// 任何 SELECT/INSERT/UPDATE/DELETE 权限，只能执行这三个函数——“不能改状态、
// 不能冒充小组回复、不能删除”由数据库强制，而不是前端隐藏按钮。
//
// 页面只持有 endpoint 与 publishableKey：它们用于标识应用，本身不带数据权限，
// 数据库连接串与任何密钥都不会进入网页代码。

const REST_PREFIX = '/.cloud/database/rest';

type RpcError = { code?: string; message?: string } | null;
type RpcResult<T> = { data: T | null; error: RpcError };
type CloudClient = { database: { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<RpcResult<unknown>> } };

export const cloudFeedbackConfig = (): FeedbackService => {
  const endpoint = process.env.NEXT_PUBLIC_WORKBUDDY_CLOUD_ENDPOINT?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_WORKBUDDY_CLOUD_KEY?.trim();
  if (!endpoint || !publishableKey) return { configured: false, baseUrl: '', message: '共享反馈尚未接通，当前无法提交或查看反馈。' };
  try {
    const url = new URL(endpoint);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash || !(url.protocol === 'https:' || (local && url.protocol === 'http:'))) throw new Error('Invalid endpoint');
    return { configured: true, baseUrl: `${url.origin}${REST_PREFIX}`, message: '' };
  } catch {
    return { configured: false, baseUrl: '', message: '共享反馈服务配置无效，暂时无法提交或读取反馈。' };
  }
};

// 数据库错误 → HTTP 状态。SDK 把 SQLSTATE 包成 DATABASE_xxxxx，这里先还原。
// 访客只看到既有的中文提示，看不到 SQLSTATE 或表结构细节。
function statusForError(code: string | undefined) {
  const state = code?.replace(/^DATABASE_/, '');
  if (state === '22023' || state === '22P02') return 400;
  if (state === '23505' || state === '23503') return 409;
  if (state === 'P0002') return 404;
  return 503;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
const failure = (status: number, message = '共享反馈服务暂时不可用，请稍后重试。') => json({ error: { code: 'SERVICE_UNAVAILABLE', message } }, status);

// SDK 只在真正发起请求时才加载：静态导出与首屏渲染不依赖云端即可完成。
let clientPromise: Promise<CloudClient> | null = null;
function database(): Promise<CloudClient> {
  if (!clientPromise) {
    clientPromise = import('@tencent-ai/workbuddy-cloud-sdk')
      .then(({ createWorkBuddyCloud }) => createWorkBuddyCloud({
        endpoint: process.env.NEXT_PUBLIC_WORKBUDDY_CLOUD_ENDPOINT!.trim(),
        publishableKey: process.env.NEXT_PUBLIC_WORKBUDDY_CLOUD_KEY!.trim(),
      }) as unknown as CloudClient)
      .catch((error) => { clientPromise = null; throw error; });
  }
  return clientPromise;
}

async function call<T>(name: string, args: Record<string, unknown>): Promise<RpcResult<T>> {
  const db = await database();
  return await db.database.rpc(name, args) as RpcResult<T>;
}

const abortError = () => new DOMException('Aborted', 'AbortError');

// 与 fetch 同签名的适配器：让 feedback-client 的契约校验、错误文案与幂等键
// 逻辑完全复用，只替换传输层。
export function createCloudFeedbackFetcher(rpc: typeof call = call): typeof fetch {
  return async (input, init) => {
    const request = new Request(input as RequestInfo, init);
    const signal = request.signal;
    if (signal.aborted) throw abortError();
    const { pathname, searchParams } = new URL(request.url);
    const route = pathname.slice(pathname.indexOf(REST_PREFIX) + REST_PREFIX.length);

    const run = async (): Promise<Response> => {
      try {
        if (request.method === 'GET' && route === '/feedback') {
          const { data, error } = await rpc<{ items: unknown[]; nextCursor: string | null }>('list_feedback', {
            p_map: searchParams.get('map'), p_type: searchParams.get('type'), p_status: searchParams.get('status'),
            p_cursor: searchParams.get('cursor'), p_limit: 20,
          });
          if (error) return failure(statusForError(error.code));
          return json({ items: data?.items ?? [], nextCursor: data?.nextCursor ?? null });
        }

        if (request.method === 'GET' && route.startsWith('/feedback/')) {
          const { data, error } = await rpc<unknown>('get_feedback', { p_id: decodeURIComponent(route.slice('/feedback/'.length)) });
          if (error) return failure(statusForError(error.code), '反馈信息无效，请检查内容与链接。');
          if (!data) return json({ error: { code: 'NOT_FOUND', message: '这条反馈不存在或暂未公开。' } }, 404);
          return json({ item: data });
        }

        if (request.method === 'POST' && route === '/feedback') {
          const body = JSON.parse(await request.text()) as { target?: { mapId?: string; nodeId?: string }; type?: string; content?: string; nickname?: string; referenceUrl?: string };
          const { data, error } = await rpc<unknown>('submit_feedback', {
            p_request_key: request.headers.get('Idempotency-Key') ?? '',
            p_map_id: body.target?.mapId ?? null,
            p_node_id: body.target?.nodeId ?? null,
            p_type: body.type ?? null,
            p_content: body.content ?? null,
            p_nickname: body.nickname ?? null,
            p_reference_url: body.referenceUrl ?? null,
          });
          if (error) return failure(statusForError(error.code), '反馈信息无效，请检查内容与链接。');
          return json({ item: data }, 201);
        }

        return failure(405, '反馈服务不支持这个请求。');
      } catch {
        return failure(503);
      }
    };

    return Promise.race([
      run(),
      new Promise<never>((_, reject) => signal.addEventListener('abort', () => reject(abortError()), { once: true })),
    ]);
  };
}
