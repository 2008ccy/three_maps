import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createFeedbackHandler, validateInput, targetSet } from '../src/service.mjs';
import { createCloudbaseStore, collections } from '../src/cloudbase-store.mjs';
import { databaseFixture } from './database-fixture.mjs';
import { main } from '../src/runtime.mjs';

const targets = JSON.parse(await readFile(new URL('../data/targets.json', import.meta.url), 'utf8'));
const allowedOrigin = 'https://maps.example.test';
const input = { target: { mapId: 'domain', nodeId: 'rag' }, type: '内容错误', content: '请补充这个判断的适用条件。' };
const fixedTime = Date.parse('2026-11-03T06:00:00.000Z');
function fixture(options = {}) {
  const database = options.database ?? databaseFixture();
  const handler = createFeedbackHandler({ targets, allowedOrigins: [allowedOrigin], secret: 'test-secret-only-not-a-real-key-123456789',
    verified: true, store: createCloudbaseStore(database), trustedSource: () => '192.0.2.12', clock: () => fixedTime, ...options });
  return { database, handler };
}
function event({ method = 'POST', path = '/feedback', body = input, key = randomUUID(), origin = allowedOrigin, query = {}, headers = {} } = {}) {
  return { httpMethod: method, path, queryStringParameters: query, body: JSON.stringify(body), headers: {
    ...(origin ? { Origin: origin } : {}), 'Content-Type': 'application/json', 'Idempotency-Key': key, ...headers,
  } };
}
const decode = (response) => JSON.parse(response.body);

test('production entry fails closed before SDK load without cloud configuration', async () => {
  const response = await main(event(), {});
  assert.equal(response.statusCode, 503);
  assert.equal(decode(response).error.code, 'SERVICE_UNAVAILABLE');
  assert.ok(!response.body.includes('secret'));
});

test('current manifest contains the three maps and 59 active nodes, not historical aliases', () => {
  const entries = targetSet(targets);
  assert.equal(entries.size, 62);
  assert.ok(entries.has('domain:rag') && entries.has('cognition:weekly-review'));
  assert.ok(!entries.has('cognition:independent-feedback'));
  assert.ok(!entries.has('ecosystem:participants'));
});

test('whitelist rejects injected management fields, target extras and retired nodes', async () => {
  const { handler, database } = fixture();
  for (const body of [
    { ...input, status: '已完成' }, { ...input, reply: '冒充小组' }, { ...input, id: 'chosen' },
    { ...input, createdAt: 'chosen' }, { ...input, isPublic: true }, { ...input, resolution: 'chosen' },
    { ...input, releaseVersion: 'v1.5' }, { ...input, target: { ...input.target, admin: true } },
    { ...input, target: { mapId: 'cognition', nodeId: 'independent-feedback' } },
  ]) assert.equal((await handler(event({ body }))).statusCode, 400);
  assert.equal(database.records(collections.feedback).length, 0);
});

test('Unicode length, optional fields and HTTP(S) links are checked server-side', () => {
  const current = targetSet(targets);
  for (const content of ['1234', '😀'.repeat(1001)]) assert.throws(() => validateInput({ ...input, content }, current));
  assert.equal(validateInput({ ...input, content: '😀'.repeat(1000) }, current).content.length, 2000);
  assert.throws(() => validateInput({ ...input, nickname: '😀'.repeat(21) }, current));
  for (const referenceUrl of ['javascript:alert(1)', '/relative', 'https://user:pass@example.test', 'https://example.test/with space', 'https://exa mple.test/path', 'data:text/html,test', 'https://example.test/' + 'x'.repeat(2048)]) {
    assert.throws(() => validateInput({ ...input, referenceUrl }, current));
  }
  assert.equal(validateInput({ ...input, nickname: '', referenceUrl: ' https://example.test/ ' }, current).referenceUrl, 'https://example.test/');
});

test('normal create generates ID, UTC time and initial state and projects public fields', async () => {
  const { handler, database } = fixture();
  const response = await handler(event({ body: { ...input, content: '<script>alert(1)</script>这只是文本' } }));
  assert.equal(response.statusCode, 201);
  const item = decode(response).item;
  assert.match(item.id, /^FB-[0-9a-f-]{36}$/);
  assert.equal(item.createdAt, '2026-11-03T06:00:00.000Z');
  assert.equal(item.status, '待核实');
  assert.equal(item.content, '<script>alert(1)</script>这只是文本');
  assert.ok(!('isPublic' in item) && !('_id' in item));
  assert.equal(database.records(collections.feedback).length, 1);
  assert.equal(response.headers['Access-Control-Allow-Origin'], allowedOrigin);
  assert.equal(response.headers['Cache-Control'], 'no-store');
});

test('parallel retries across handler instances return one stable record and consume one slot', async () => {
  const database = databaseFixture();
  const handlers = [fixture({ database }).handler, fixture({ database }).handler];
  const key = randomUUID();
  const responses = await Promise.all(Array.from({ length: 12 }, (_, index) => handlers[index % 2](event({ key }))));
  assert.equal(responses.filter((response) => response.statusCode === 201).length, 1);
  assert.ok(responses.every((response) => [200, 201].includes(response.statusCode)));
  assert.equal(new Set(responses.map((response) => decode(response).item.id)).size, 1);
  assert.equal(database.records(collections.feedback).length, 1);
  assert.equal(database.records(collections.requests).length, 1);
  assert.equal(database.records(collections.rates)[0].count, 1);
  assert.equal((await handlers[0](event({ key, body: { ...input, content: '这个请求已经改成另一项反馈。' } }))).statusCode, 409);
});

test('shared per-source rate counter caps concurrent new submissions at five per minute', async () => {
  const database = databaseFixture();
  const handlers = [fixture({ database }).handler, fixture({ database }).handler];
  const responses = await Promise.all(Array.from({ length: 10 }, (_, index) => handlers[index % 2](event())));
  assert.equal(responses.filter((response) => response.statusCode === 201).length, 5);
  const limited = responses.filter((response) => response.statusCode === 429);
  assert.equal(limited.length, 5);
  assert.ok(limited.every((response) => response.headers['Retry-After'] === '60'));
  assert.equal(database.records(collections.feedback).length, 5);
  assert.equal(database.records(collections.requests).length, 5);
  assert.equal(database.records(collections.rates)[0].count, 5);
  assert.equal((await fixture({ database, clock: () => fixedTime + 60000 }).handler(event())).statusCode, 201);
});

test('a failed database write rolls back the feedback, rate slot and idempotency record together', async () => {
  const database = databaseFixture();
  const transaction = database.runTransaction.bind(database);
  database.runTransaction = (callback) => transaction((tx) => callback({
    collection(name) {
      const collection = tx.collection(name);
      if (name !== collections.feedback) return collection;
      return { doc(id) { return { ...collection.doc(id), async set() { return { code: 'DATABASE_WRITE_FAILED' }; } }; } };
    },
  }));
  const { handler } = fixture({ database });
  assert.equal((await handler(event())).statusCode, 503);
  assert.equal(database.records(collections.feedback).length, 0);
  assert.equal(database.records(collections.requests).length, 0);
  assert.equal(database.records(collections.rates).length, 0);
});

test('untrusted headers cannot supply source IP and absent trusted context closes writes', async () => {
  const { handler, database } = fixture({ trustedSource: () => undefined });
  const response = await handler(event({ headers: { 'X-Forwarded-For': '192.0.2.40', 'X-Real-IP': '192.0.2.40' } }), {});
  assert.equal(response.statusCode, 503);
  assert.equal(database.records(collections.feedback).length, 0);
});

test('public reads omit private fields and nonpublic records, and cannot mutate records', async () => {
  const { handler, database } = fixture();
  const item = decode(await handler(event())).item;
  const original = database.records(collections.feedback)[0];
  await database.seed(collections.feedback, item.id, { ...original, reply: '已核实，将补充条件。', resolution: '已补充适用范围。', releaseVersion: 'v1.5', adminIdentity: 'private', internalNotes: 'private', sourceHash: 'private', status: '已完成' });
  const response = await handler(event({ method: 'GET', path: '/feedback/' + item.id, origin: null }));
  const read = decode(response).item;
  assert.equal(read.reply, '已核实，将补充条件。');
  assert.equal(read.status, '已完成');
  assert.ok(!JSON.stringify(read).includes('private'));
  for (const method of ['PATCH', 'PUT', 'DELETE']) assert.equal((await handler(event({ method, path: '/feedback/' + item.id }))).statusCode, 405);
  await database.seed(collections.feedback, item.id, { ...original, isPublic: false });
  assert.equal((await handler(event({ method: 'GET', path: '/feedback/' + item.id }))).statusCode, 404);
  assert.deepEqual(decode(await handler(event({ method: 'GET' }))).items, []);
});

test('retiring a target blocks new submissions but preserves its historical public feedback', async () => {
  const database = databaseFixture();
  const created = decode(await fixture({ database }).handler(event())).item;
  const changedTargets = structuredClone(targets);
  changedTargets.maps.find((map) => map.id === 'domain').nodes = changedTargets.maps.find((map) => map.id === 'domain').nodes.filter((node) => node.id !== 'rag');
  const { handler } = fixture({ database, targets: changedTargets });
  assert.equal((await handler(event())).statusCode, 400);
  const read = await handler(event({ method: 'GET', path: '/feedback/' + created.id }));
  assert.equal(read.statusCode, 200);
  assert.deepEqual(decode(read).item.target, { mapId: 'domain', nodeId: 'rag' });
  const listed = decode(await handler(event({ method: 'GET' })));
  assert.equal(listed.items.length, 1);
  assert.equal(listed.items[0].id, created.id);
});

test('signed cursor returns pages of 20, handles equal timestamps and binds filters', async () => {
  const { handler, database } = fixture();
  const ids = [];
  for (let index = 0; index < 25; index++) {
    const id = 'FB-' + randomUUID(); ids.push(id);
    await database.seed(collections.feedback, id, { id, ...input, status: '待核实', createdAt: '2026-11-03T06:00:00.000Z', isPublic: true });
  }
  const page1 = decode(await handler(event({ method: 'GET' })));
  assert.equal(page1.items.length, 20);
  assert.ok(page1.nextCursor);
  const page2 = decode(await handler(event({ method: 'GET', query: { cursor: page1.nextCursor } })));
  assert.equal(page2.items.length, 5);
  assert.equal(page2.nextCursor, null);
  assert.equal(new Set([...page1.items, ...page2.items].map((item) => item.id)).size, 25);
  assert.equal((await handler(event({ method: 'GET', query: { cursor: page1.nextCursor, map: 'cognition' } }))).statusCode, 400);
  assert.equal((await handler(event({ method: 'GET', query: { cursor: page1.nextCursor + '0' } }))).statusCode, 400);
  assert.deepEqual(decode(await handler(event({ method: 'GET', query: { map: 'cognition' } }))).items, []);
});

test('unsupported routes, content types, CORS, bodies and query keys are rejected', async () => {
  const { handler, database } = fixture();
  assert.equal((await handler(event({ path: '/admin' }))).statusCode, 404);
  assert.equal((await handler(event({ origin: 'https://evil.test' }))).statusCode, 403);
  assert.equal((await handler(event({ origin: null }))).statusCode, 403);
  assert.equal((await handler(event({ headers: { 'Content-Type': 'text/plain' } }))).statusCode, 415);
  assert.equal((await handler({ ...event(), body: '{' })).statusCode, 400);
  assert.equal((await handler(event({ query: { admin: 'true' } }))).statusCode, 400);
  assert.equal((await handler(event({ method: 'GET', query: { limit: '10000' } }))).statusCode, 400);
  const preflight = await handler(event({ method: 'OPTIONS', headers: { 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,idempotency-key' } }));
  assert.equal(preflight.statusCode, 204);
  assert.equal(preflight.body, '');
  assert.equal(database.records(collections.feedback).length, 0);
});

test('unexpected database errors are sanitized without exposing credentials or raw headers', async () => {
  const { handler } = fixture({ store: { async list() { throw new Error('secret-private-admin-token'); } } });
  const response = await handler(event({ method: 'GET' }));
  assert.equal(response.statusCode, 503);
  assert.ok(!response.body.includes('secret-private-admin-token'));
});
