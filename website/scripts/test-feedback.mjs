import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from 'cheerio';
import { feedbackInputSchema, feedbackHref, feedbackReferenceHref, feedbackReleaseHref, feedbackComposeHref } from '../src/lib/feedback-contract.ts';
import { feedbackTargets, findFeedbackTarget } from '../src/lib/feedback-targets.ts';
import { createFeedbackClient, feedbackServiceConfig } from '../src/lib/feedback-client.ts';

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
  for (const referenceUrl of ['javascript:alert(1)', 'data:text/html,bad', '/relative', 'https://name:password@example.com/', 'https://example.com/' + 'a'.repeat(2048)]) assert.ok(!feedbackInputSchema.safeParse({ ...input, referenceUrl }).success);
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

test('static feedback page is honest when cloud storage is not configured', () => {
  const { basePath } = JSON.parse(readFileSync('out/.site-build.json', 'utf8'));
  const $ = load(readFileSync('out/feedback/index.html', 'utf8'));
  assert.equal($('h1').text(), '反馈与改进');
  assert.ok($.text().includes('共享反馈尚未开放'));
  assert.equal($('button[type="submit"][disabled]').length, 1);
  assert.ok(!$.text().includes('还没有公开反馈。欢迎指出第一个具体问题。'));
  assert.equal($('.feedback-record[data-id]').length, 0);
  assert.ok($(`a[href="${basePath}/feedback/"]`).length);
});
