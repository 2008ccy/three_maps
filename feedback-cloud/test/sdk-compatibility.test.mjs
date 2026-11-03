import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createCloudbaseStore } from '../src/cloudbase-store.mjs';

const require = createRequire(import.meta.url);
let sdk;
try { sdk = require('@cloudbase/node-sdk'); } catch { /* Business tests can run without installing deployment dependencies. */ }

test('locked real SDK preserves transaction, document and query serialization with fixed dependencies', { skip: !sdk && 'Run npm ci --ignore-scripts to enable SDK compatibility validation' }, async () => {
  assert.equal(require('@cloudbase/node-sdk/package.json').version, '3.18.7');
  assert.equal(require('@cloudbase/database/package.json').version, '1.5.1');
  assert.equal(require('axios/package.json').version, '0.34.0');
  assert.equal(typeof sdk.getCloudbaseContext, 'function');
  const app = sdk.init({ env: 'offline-inspection-only' });
  const db = app.database();
  const Database = db.constructor;
  const originalRequestClass = Database.reqClass;
  const documents = new Map(), calls = [];
  // Replace the SDK's transport, not its database/transaction API. No network or
  // real cloud resources are used; this checks the locked dependency wire shape.
  Database.reqClass = class {
    async send(action, params) {
      calls.push({ action, params: structuredClone(params) });
      if (action === 'database.startTransaction') return { transactionId: 'offline-transaction' };
      if (action === 'database.commitTransaction' || action === 'database.abortTransaction') return { requestId: 'offline' };
      if (action === 'database.getDocument') {
        const query = JSON.parse(params.query);
        const rows = query._id ? [documents.get(params.collectionName + ':' + query._id)].filter(Boolean) : [...documents.entries()].filter(([key]) => key.startsWith(params.collectionName + ':')).map(([, value]) => value);
        return { data: { list: rows.map((row) => JSON.stringify(row)) }, requestId: 'offline' };
      }
      if (action === 'database.modifyDocument') {
        const id = JSON.parse(params.query)._id;
        documents.set(params.collectionName + ':' + id, { ...JSON.parse(params.data), _id: id });
        return { data: { updated: 1, upsert_id: id }, requestId: 'offline' };
      }
      throw new Error('Unexpected offline transport action: ' + action);
    }
  };
  try {
    const store = createCloudbaseStore(db);
    const record = { id: 'FB-0d349856-5d49-4ea0-a75a-96342d607cca', target: { mapId: 'domain', nodeId: 'rag' }, type: '内容错误', content: '离线依赖兼容测试，不是真实访客反馈。', status: '待核实', createdAt: '2026-11-03T06:00:00.000Z', isPublic: true };
    const args = { idempotencyId: 'offline-request', payloadHash: 'offline-payload', sourceHash: 'offline-source', now: Date.parse(record.createdAt), record };
    const created = await store.create(args);
    assert.equal(created.replayed, false);
    assert.equal(created.item.id, record.id);
    const replay = await store.create(args);
    assert.equal(replay.replayed, true);
    assert.equal(replay.item.id, record.id);
    assert.equal((await store.get(record.id)).content, record.content);
    const rows = await store.list({ filters: { map: 'domain', type: '内容错误', status: '待核实' }, cursor: { createdAt: record.createdAt, id: record.id }, limit: 21 });
    assert.equal(rows.length, 1);
    const queryCall = calls.filter((call) => call.action === 'database.getDocument').at(-1);
    const query = JSON.parse(queryCall.params.query);
    assert.ok(JSON.stringify(query).includes('isPublic'));
    assert.ok(JSON.stringify(query).includes('target.mapId'));
    assert.ok(JSON.stringify(query).includes('$lt'));
    assert.equal(queryCall.params.limit, 21);
    assert.equal(calls.filter((call) => call.action === 'database.modifyDocument').length, 3);
    assert.equal(calls.filter((call) => call.action === 'database.commitTransaction').length, 2);
  } finally { Database.reqClass = originalRequestClass; }
});
