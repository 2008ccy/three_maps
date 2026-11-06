import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from 'cheerio';
import { feedbackInputSchema, feedbackPageSchema, publicFeedbackSchema, feedbackHref, feedbackReferenceHref, feedbackReleaseHref, feedbackComposeHref } from '../src/lib/feedback-contract.ts';
import { feedbackTargets, findFeedbackTarget } from '../src/lib/feedback-targets.ts';
import { createFeedbackClient, feedbackServiceConfig } from '../src/lib/feedback-client.ts';
import { createCloudFeedbackFetcher } from '../src/lib/feedback-cloud.ts';

const input = { target: { mapId: 'domain', nodeId: 'rag' }, type: '内容错误', content: '这是一条用于协议验证的反馈。' };
const id = 'FB-11111111-1111-4111-8111-111111111111';
const record = { ...input, id, createdAt: '2026-11-03T00:00:00.000Z', status: '待核实' };
const configured = feedbackServiceConfig('https://feedback.example.test/v1', 'true');
const response = (data, init) => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' }, ...init });

test('feedback input is a strict visitor whitelist with Unicode and URL limits', () => {
  assert.ok(feedbackInputSchema.safeParse(input).success);
  for (const forbidden of ['status','reply','resolution','id','createdAt','isPublic','releaseVersion']) assert.ok(!feedbackInputSchema.safeParse({ ...input, [forbidden]: 'injected' }).success);
  assert.ok(!feedbackInputSchema.safeParse({ ...input, target: { ...input.target, status: '已完成' } }).success);
  for (const content of ['短', ' '.repeat(8), '字'.repeat(1001)]) assert.ok(!feedbackInputSchema.safeParse({ ...input, content }).success);
  assert.ok(feedbackInputSchema.safeParse({ ...input, content: '😀'.repeat(1000) }).success);
  assert.ok(!feedbackInputSchema.safeParse({ ...input, nickname: '字'.repeat(21) }).success);
  for (const referenceUrl of ['javascript:alert(1)', 'data:text/html,bad', '/relative', 'https://name:password@example.com/', 'https://example.test/with space', 'https://exa mple.test/path', 'https://example.com/' + 'a'.repeat(2048)]) assert.ok(!feedbackInputSchema.safeParse({ ...input, referenceUrl }).success);
});

test('feedback targets omit retired aliases and links only reach current maps and logs', () => {
  assert.equal(feedbackTargets.length, 62);
  assert.equal(findFeedbackTarget({ mapId: 'cognition', nodeId: 'independent-feedback' }), undefined);
  assert.ok(findFeedbackTarget({ mapId: 'cognition', nodeId: 'weekly-review' }));
  assert.equal(feedbackComposeHref(input.target), '/feedback/?map=domain&node=rag');
  assert.equal(feedbackHref(id), '/feedback/?id=' + id);
  assert.equal(feedbackReleaseHref('v1.4'), '/docs/project/updates/#v1-4');
  assert.equal(feedbackReleaseHref('javascript:alert(1)'), null);
});

test('visitor reference links cannot reintroduce original article navigation on this site', () => {
  const origin = 'https://three-maps.test';
  for (const basePath of ['', '/three_maps']) {
    for (const route of ['/docs/', '/docs/domain/concepts/', '/docs/cognition/loss/', '/docs/ecosystem/entries/e-rag/']) assert.equal(feedbackReferenceHref(origin + basePath + route, origin, basePath), null);
    const current = origin + basePath + '/docs/domain/#node-rag';
    assert.equal(feedbackReferenceHref(current, origin, basePath), current);
  }
  assert.equal(feedbackReferenceHref('https://official.test/docs/', origin), 'https://official.test/docs/');
  assert.equal(feedbackReferenceHref('javascript:alert(1)', origin), null);
  for (const route of ['/three_maps/docs/%64omain/entries/k-rag/', '/three%5Fmaps/docs/domain/entries/k-rag/', '/three_maps//docs/domain/entries/k-rag/', '/three_maps/docs/%2564omain/entries/k-rag/', '/three_maps/docs/%E0']) assert.equal(feedbackReferenceHref(origin + route, origin, '/three_maps'), null);
});

test('unconfigured or unverified feedback never fetches or manufactures records', async () => {
  for (const config of [feedbackServiceConfig(undefined, undefined), feedbackServiceConfig('https://api.example.com', 'false'), feedbackServiceConfig('https://secret@api.example.com', 'true')]) {
    assert.equal(config.configured, false);
    const client = createFeedbackClient(config, async () => { assert.fail('No network request may be sent without verified service configuration'); });
    await assert.rejects(client.listFeedback(), { code: 'NOT_CONFIGURED' });
    await assert.rejects(client.getFeedback(id), { code: 'NOT_CONFIGURED' });
    await assert.rejects(client.submitFeedback(input, '11111111-1111-4111-8111-111111111111'), { code: 'NOT_CONFIGURED' });
  }
});

test('feedback client serializes the public contract and strips unexpected response fields', async () => {
  const requests = [];
  const client = createFeedbackClient(configured, async (url, options) => {
    requests.push({ url, options });
    return response(url.includes('?') ? { items: [{ ...record, internalNote: 'private' }], nextCursor: null } : { item: { ...record, internalNote: 'private' } });
  });
  const result = await client.submitFeedback(input, '11111111-1111-4111-8111-111111111111');
  assert.equal(result.id, id); assert.equal('internalNote' in result, false);
  assert.equal(requests[0].url, 'https://feedback.example.test/v1/feedback');
  assert.equal(requests[0].options.headers['Idempotency-Key'], '11111111-1111-4111-8111-111111111111');
  assert.equal(requests[0].options.credentials, 'omit');
  assert.deepEqual(JSON.parse(requests[0].options.body), input);
  const page = await client.listFeedback({ map: 'domain', type: '内容错误', cursor: 'next-page' });
  assert.equal(page.items.length, 1); assert.equal('internalNote' in page.items[0], false);
  assert.ok(requests[1].url.includes('cursor=next-page'));
  await assert.rejects(client.submitFeedback({ ...input, target: { mapId: 'domain', nodeId: 'old-missing' } }, '11111111-1111-4111-8111-111111111111'), { code: 'INVALID_INPUT' });
});

test('feedback client handles rate limits, invalid responses, timeout and cancellation', async () => {
  await assert.rejects(createFeedbackClient(configured, async () => response({}, { status: 429, headers: { 'Retry-After': '30' } })).listFeedback(), { status: 429, retryAfter: 30 });
  await assert.rejects(createFeedbackClient(configured, async () => response({ items: [], nextCursor: 42 })).listFeedback(), { code: 'INVALID_RESPONSE' });
  const slowFetch = (_, options) => new Promise((_, reject) => { if (options.signal.aborted) reject(new Error('aborted')); else options.signal.addEventListener('abort', () => reject(new Error('aborted'))); });
  await assert.rejects(createFeedbackClient(configured, slowFetch, 5).listFeedback(), { code: 'TIMEOUT' });
  const controller = new AbortController(); controller.abort();
  await assert.rejects(createFeedbackClient(configured, slowFetch).listFeedback({}, controller.signal), { code: 'ABORTED' });
});

test('static feedback page follows its build configuration without manufacturing records', () => {
  const { basePath, feedbackConfigured } = JSON.parse(readFileSync('out/.site-build.json', 'utf8'));
  assert.equal(typeof feedbackConfigured, 'boolean');
  const $ = load(readFileSync('out/feedback/index.html', 'utf8'));
  assert.equal($('h1').text(), '反馈与改进');
  assert.equal($.text().includes('共享反馈尚未开放'), !feedbackConfigured);
  assert.equal($('button[type="submit"][disabled]').length, 1);
  assert.ok(!$.text().includes('还没有公开反馈。欢迎指出第一个具体问题。'));
  assert.equal($('.feedback-record[data-id]').length, 0);
  const home = load(readFileSync('out/index.html', 'utf8'));
  assert.ok(home(`footer a[href="${basePath}/feedback/"]`).length, 'the homepage footer keeps feedback discoverable');
  assert.equal($('button').filter((_, item) => $(item).text() === '预览反馈').length, 1);
});

test('feedback client rejects invalid and mismatched records before reporting success', async () => {
  for (const bad of [
    { ...record, target: { mapId: 'cognition' } }, { ...record, content: '这是另一条反馈的正文。' },
    { ...record, referenceUrl: 'javascript:alert(1)' }, { ...record, content: '字'.repeat(1001) },
  ]) {
    const client = createFeedbackClient(configured, async () => response({ item: bad }));
    await assert.rejects(client.submitFeedback(input, '11111111-1111-4111-8111-111111111111'), { code: 'INVALID_RESPONSE' });
  }
  const wrongId = createFeedbackClient(configured, async () => response({ item: { ...record, id: 'FB-22222222-2222-4222-8222-222222222222' } }));
  await assert.rejects(wrongId.getFeedback(id), { code: 'INVALID_RESPONSE' });
  const duplicate = createFeedbackClient(configured, async () => response({ items: [record, record], nextCursor: null }));
  await assert.rejects(duplicate.listFeedback(), { code: 'INVALID_RESPONSE' });
  const wrongFilter = createFeedbackClient(configured, async () => response({ items: [record], nextCursor: null }));
  await assert.rejects(wrongFilter.listFeedback({ status: '已完成' }), { code: 'INVALID_RESPONSE' });
  assert.equal(feedbackPageSchema.safeParse({ items: Array(21).fill(record), nextCursor: null }).success, false);
  assert.equal(publicFeedbackSchema.safeParse({ ...record, reply: '字'.repeat(10001) }).success, false);
  assert.equal(publicFeedbackSchema.safeParse({ ...record, reply: '😀'.repeat(10000) }).success, true);
});

test('invalid filters and cancelled requests never reach the server', async () => {
  const client = createFeedbackClient(configured, async () => assert.fail('Unexpected request'));
  await assert.rejects(client.listFeedback({ status: 'unknown' }), { code: 'INVALID_FILTERS' });
  await assert.rejects(client.listFeedback({ cursor: 'x'.repeat(1025) }), { code: 'INVALID_FILTERS' });
  const controller = new AbortController(); controller.abort();
  await assert.rejects(client.listFeedback({}, controller.signal), { code: 'ABORTED' });
});

test('rate-limit delay supports seconds and HTTP dates, and errors never echo server content', async () => {
  const response429 = (delay) => createFeedbackClient(configured, async () => response({ error: { message: 'secret internal details' } }, { status: 429, headers: { 'Retry-After': delay } }));
  await assert.rejects(response429('999999999').listFeedback(), (error) => error.retryAfter === 3600 && !error.message.includes('secret'));
  await assert.rejects(response429(new Date(Date.now() + 60000).toUTCString()).listFeedback(), (error) => error.retryAfter >= 59 && error.retryAfter <= 60);
  await assert.rejects(response429('invalid').listFeedback(), (error) => error.retryAfter === undefined);
  await assert.rejects(createFeedbackClient(configured, async () => response({}, { status: 403 })).listFeedback(), (error) => error.status === 403 && error.message.includes('未获准'));
});

test('timeouts and cancellation while reading the response body retain their error classification', async () => {
  const slowBody = async (_, options) => ({ ok: true, headers: new Headers(), json: () => new Promise((_, reject) => {
    if (options.signal.aborted) reject(new Error('body aborted'));
    else options.signal.addEventListener('abort', () => reject(new Error('body aborted')), { once: true });
  }) });
  await assert.rejects(createFeedbackClient(configured, slowBody, 5).listFeedback(), { code: 'TIMEOUT' });
  const controller = new AbortController();
  const request = createFeedbackClient(configured, slowBody).listFeedback({}, controller.signal);
  controller.abort();
  await assert.rejects(request, { code: 'ABORTED' });
});

test('map feedback entries carry the canonical map target for root and subpath builds', () => {
  const { basePath } = JSON.parse(readFileSync('out/.site-build.json', 'utf8'));
  for (const map of ['domain', 'ecosystem', 'cognition']) {
    const $ = load(readFileSync(`out/docs/${map}/index.html`, 'utf8'));
    assert.equal($('nav[aria-label="整图反馈"] a').attr('href'), `${basePath}/feedback/?map=${map}`);
  }
});

test('active WorkBuddy transport maps list/detail/submit to their RPC contracts without a network', async () => {
  const calls = [];
  const fetcher = createCloudFeedbackFetcher(async (name, args) => {
    calls.push({ name, args });
    return { data: name === 'list_feedback' ? { items: [record], nextCursor: null } : record, error: null };
  });
  const client = createFeedbackClient({ configured: true, baseUrl: 'https://cloud.example.test/.cloud/database/rest', message: '' }, fetcher);
  assert.equal((await client.listFeedback({ map: 'domain', type: '内容错误', cursor: 'next-page' })).items[0].id, id);
  assert.deepEqual(calls[0], { name: 'list_feedback', args: { p_map: 'domain', p_type: '内容错误', p_status: null, p_cursor: 'next-page', p_limit: 20 } });
  assert.equal((await client.getFeedback(id)).id, id);
  assert.deepEqual(calls[1], { name: 'get_feedback', args: { p_id: id } });
  const key = '11111111-1111-4111-8111-111111111111';
  assert.equal((await client.submitFeedback(input, key)).id, id);
  assert.deepEqual(calls[2], { name: 'submit_feedback', args: { p_request_key: key, p_map_id: 'domain', p_node_id: 'rag', p_type: input.type, p_content: input.content, p_nickname: null, p_reference_url: null } });
});

test('active WorkBuddy transport maps SQL errors and missing records without exposing internals', async () => {
  const url = 'https://cloud.example.test/.cloud/database/rest/feedback/' + id;
  for (const [code, status] of [['DATABASE_22023', 400], ['DATABASE_23505', 409], ['DATABASE_P0002', 404], ['DATABASE_XX000', 503]]) {
    const fetcher = createCloudFeedbackFetcher(async () => ({ data: null, error: { code, message: 'private SQL details must stay private' } }));
    const result = await fetcher(url);
    assert.equal(result.status, status);
    assert.equal((await result.text()).includes('private'), false);
  }
  const missing = await createCloudFeedbackFetcher(async () => ({ data: null, error: null }))(url);
  assert.equal(missing.status, 404);
});

test('active WorkBuddy transport honors cancellation and rejects unsupported methods before RPC', async () => {
  let count = 0;
  const fetcher = createCloudFeedbackFetcher(async () => { count++; return { data: null, error: null }; });
  const url = 'https://cloud.example.test/.cloud/database/rest/feedback';
  const cancelled = new AbortController(); cancelled.abort();
  await assert.rejects(fetcher(url, { signal: cancelled.signal }), { name: 'AbortError' });
  assert.equal((await fetcher(url, { method: 'DELETE' })).status, 405);
  assert.equal(count, 0);
  const pending = createCloudFeedbackFetcher(() => new Promise(() => {}));
  const controller = new AbortController();
  const request = pending(url, { signal: controller.signal }); controller.abort();
  await assert.rejects(request, { name: 'AbortError' });
});
