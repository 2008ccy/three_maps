import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { createPostgresStore } from '../src/postgres-store.mjs';
import { postgresConfiguration } from '../src/postgres-config.mjs';
import { cloudConfiguration } from '../src/runtime.mjs';
import { createFeedbackHandler } from '../src/service.mjs';

const migration = await readFile(new URL('../sql/001-feedback.sql', import.meta.url), 'utf8');
const targets = JSON.parse(await readFile(new URL('../data/targets.json', import.meta.url), 'utf8'));
const origin = 'https://maps.example.test';
const now = Date.parse('2026-11-04T03:00:00.000Z');
const input = { target: { mapId: 'domain', nodeId: 'rag' }, type: '内容错误', content: '请补充这个判断的适用条件。' };
const event = (body = input, key = randomUUID()) => ({ httpMethod: 'POST', path: '/feedback', headers: { Origin: origin, 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(body) });
const get = (query = {}, id) => ({ httpMethod: 'GET', path: id ? `/feedback/${id}` : '/feedback', queryStringParameters: query, headers: {} });
const decode = (response) => JSON.parse(response.body);
async function fixture(t) {
  const database = new PGlite();
  t.after(() => database.close());
  await database.exec(migration);
  const query = async (text, values) => {
    const result = await database.query(text, values);
    return { ...result, rowCount: result.affectedRows ?? result.rows.length };
  };
  // PGlite is a real embedded PostgreSQL engine with one connection. Serialize
  // checkouts here; this does NOT claim to verify cross-connection cloud locks.
  let tail = Promise.resolve();
  const pool = { query, async connect() {
    const previous = tail;
    let release;
    tail = new Promise((resolve) => { release = resolve; });
    await previous;
    return { query, release };
  } };
  const store = createPostgresStore(pool);
  const handler = createFeedbackHandler({ store, targets, verified: true, allowedOrigins: [origin], secret: 'postgres-test-secret-123456789-123456789', trustedSource: () => '192.0.2.12', clock: () => now });
  return { database, pool, store, handler };
}

test('PostgreSQL configuration requires valid server URL and verified TLS, before opening a connection', () => {
  const environment = { FEEDBACK_DATABASE_MODE: 'postgres', FEEDBACK_ENV_ID: 'existing-env', FEEDBACK_HASH_SECRET: 'x'.repeat(32), FEEDBACK_ALLOWED_ORIGINS: JSON.stringify([origin]), FEEDBACK_MANAGEMENT_VERIFIED: 'true', FEEDBACK_GATEWAY_VERIFIED: 'true', FEEDBACK_POSTGRES_URL: 'postgresql://server_only:private@db.example.test:5432/workbuddy' };
  const config = cloudConfiguration(environment);
  assert.equal(config.databaseMode, 'postgres');
  assert.equal(config.postgres.ssl.rejectUnauthorized, true);
  assert.equal(config.postgres.max, 2);
  assert.ok(!JSON.stringify(config.postgres).includes('rejectUnauthorized":false'));
  for (const value of ['', 'https://db.example.test/db', 'postgres://host/db', 'postgres://user:pass@host/db?sslmode=disable', 'postgres://user:pass@host/db?sslmode=no-verify']) {
    assert.throws(() => postgresConfiguration({ FEEDBACK_POSTGRES_URL: value }));
  }
  assert.throws(() => cloudConfiguration({ ...environment, FEEDBACK_MANAGEMENT_VERIFIED: 'false' }));
  assert.throws(() => cloudConfiguration({ ...environment, FEEDBACK_DATABASE_MODE: 'unknown' }));
  assert.throws(() => postgresConfiguration({ ...environment, FEEDBACK_POSTGRES_CA: 'not PEM' }));
  assert.equal(cloudConfiguration({ ...environment, FEEDBACK_DATABASE_MODE: 'document', FEEDBACK_POSTGRES_URL: '' }).databaseMode, 'document');
});

test('migration runs in PostgreSQL, is repeatable, and creates the eight keyset indexes', async (t) => {
  const { database } = await fixture(t);
  await database.exec(migration);
  const indexes = await database.query("SELECT indexname FROM pg_indexes WHERE schemaname = 'feedback_private' AND indexname LIKE 'feedback_public_%'");
  assert.equal(indexes.rows.length, 8);
  const policies = await database.query("SELECT tablename, roles FROM pg_policies WHERE schemaname = 'feedback_private'");
  assert.equal(policies.rows.length, 3);
  for (const policy of policies.rows) assert.deepEqual(policy.roles, ['three_maps_feedback_backend']);
});

test('PostgreSQL create, concurrent retries, payload conflict and rate limit preserve atomic state', async (t) => {
  const { handler, pool } = await fixture(t);
  const key = randomUUID();
  const repeated = await Promise.all(Array.from({ length: 8 }, () => handler(event(input, key))));
  assert.equal(repeated.filter((response) => response.statusCode === 201).length, 1);
  assert.ok(repeated.every((response) => [200, 201].includes(response.statusCode)));
  assert.equal(new Set(repeated.map((response) => decode(response).item.id)).size, 1);
  assert.equal((await handler(event({ ...input, content: '同一个请求标识但内容已经变化。' }, key))).statusCode, 409);
  const following = await Promise.all(Array.from({ length: 7 }, () => handler(event())));
  assert.equal(following.filter((response) => response.statusCode === 201).length, 4);
  assert.equal(following.filter((response) => response.statusCode === 429).length, 3);
  const count = await pool.query('SELECT (SELECT count(*)::int FROM feedback_private.feedback) AS feedback, (SELECT count(*)::int FROM feedback_private.feedback_requests) AS requests, (SELECT count FROM feedback_private.feedback_rate_limits) AS slots');
  assert.deepEqual(count.rows[0], { feedback: 5, requests: 5, slots: 5 });
  assert.equal((await handler(event(input, key))).statusCode, 200, 'replay succeeds even after the rate limit');
});

test('failed PostgreSQL feedback write rolls back the claimed key and rate slot', async (t) => {
  const { pool, handler, database } = await fixture(t);
  await database.exec("ALTER TABLE feedback_private.feedback ADD CONSTRAINT simulated_failure CHECK (false)");
  assert.equal((await handler(event())).statusCode, 503);
  const result = await pool.query('SELECT (SELECT count(*)::int FROM feedback_private.feedback) AS feedback, (SELECT count(*)::int FROM feedback_private.feedback_requests) AS requests, (SELECT count(*)::int FROM feedback_private.feedback_rate_limits) AS rates');
  assert.deepEqual(result.rows[0], { feedback: 0, requests: 0, rates: 0 });
});

test('PostgreSQL public reads, hidden idempotent replay, admin reply and equal-time pagination match the HTTP contract', async (t) => {
  const { pool, handler } = await fixture(t);
  const key = randomUUID();
  const response = await handler(event(input, key));
  assert.equal(response.statusCode, 201);
  const { item } = decode(response);
  await pool.query('UPDATE feedback_private.feedback SET reply = $2, resolution = $3, release_version = $4, status = $5, internal_notes = $6 WHERE id = $1', [item.id, '已核实，将补充条件。', '已补充适用范围。', 'v1.5', '已完成', 'this-is-private']);
  const read = decode(await handler(get({}, item.id))).item;
  assert.equal(read.reply, '已核实，将补充条件。');
  assert.equal(read.releaseVersion, 'v1.5');
  assert.ok(!JSON.stringify(read).includes('this-is-private'));
  await pool.query('UPDATE feedback_private.feedback SET is_public = false WHERE id = $1', [item.id]);
  assert.equal((await handler(get({}, item.id))).statusCode, 404);
  assert.equal((await handler(event(input, key))).statusCode, 404);
  assert.deepEqual(decode(await handler(get())).items, []);
  const ids = [];
  for (let index = 0; index < 25; index++) {
    const id = 'FB-' + randomUUID(); ids.push(id);
    await pool.query('INSERT INTO feedback_private.feedback (id,target,type,content,created_at) VALUES ($1,$2::jsonb,$3,$4,$5)', [id, JSON.stringify(input.target), input.type, input.content, new Date(now).toISOString()]);
  }
  const first = decode(await handler(get({ map: 'domain', type: input.type, status: '待核实' })));
  assert.equal(first.items.length, 20);
  assert.ok(first.nextCursor);
  const second = decode(await handler(get({ map: 'domain', type: input.type, status: '待核实', cursor: first.nextCursor })));
  assert.equal(second.items.length, 5);
  assert.equal(second.nextCursor, null);
  assert.deepEqual([...first.items, ...second.items].map((value) => value.id), ids.sort().reverse());
});

test('PostgreSQL schema denies visitor read/write and grants backend only the required operations', async (t) => {
  const { database, pool, handler } = await fixture(t);
  await database.exec('CREATE ROLE feedback_test_visitor NOLOGIN; SET ROLE feedback_test_visitor');
  await assert.rejects(() => pool.query('SELECT * FROM feedback_private.feedback'), /permission denied/);
  const insertion = 'INSERT INTO feedback_private.feedback (id,target,type,content,created_at) VALUES ($1,$2::jsonb,$3,$4,$5)';
  const values = ['FB-' + randomUUID(), JSON.stringify(input.target), input.type, input.content, new Date(now).toISOString()];
  await assert.rejects(() => pool.query(insertion, values), /permission denied/);
  await database.exec('RESET ROLE; GRANT USAGE ON SCHEMA feedback_private TO feedback_test_visitor; GRANT SELECT, INSERT ON feedback_private.feedback TO feedback_test_visitor; SET ROLE feedback_test_visitor');
  assert.deepEqual((await pool.query('SELECT * FROM feedback_private.feedback')).rows, [], 'RLS has no visitor policy even if table SELECT is accidentally granted');
  await assert.rejects(() => pool.query(insertion, values), /row-level security/);
  await database.exec('RESET ROLE; SET ROLE three_maps_feedback_backend');
  assert.deepEqual((await pool.query('SELECT id FROM feedback_private.feedback')).rows, []);
  const submitted = await handler(event());
  assert.equal(submitted.statusCode, 201, 'the least-privilege role can execute the entire submission transaction');
  assert.equal(decode(await handler(get())).items[0].id, decode(submitted).item.id);
  await assert.rejects(() => pool.query("UPDATE feedback_private.feedback SET status = '已完成'"), /permission denied/);
  await assert.rejects(() => pool.query('DELETE FROM feedback_private.feedback'), /permission denied/);
  await database.exec('RESET ROLE');
});
