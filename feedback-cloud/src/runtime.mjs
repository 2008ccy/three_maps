import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { allowedOrigin, createFeedbackHandler, targetSet, unavailable } from './service.mjs';
import { createCloudbaseStore } from './cloudbase-store.mjs';
import { createPostgresStore } from './postgres-store.mjs';
import { postgresConfiguration } from './postgres-config.mjs';

const require = createRequire(import.meta.url);
let initialized;
export function cloudConfiguration(environment) {
  if (environment.FEEDBACK_MANAGEMENT_VERIFIED !== 'true' || environment.FEEDBACK_GATEWAY_VERIFIED !== 'true' || !['document', 'postgres'].includes(environment.FEEDBACK_DATABASE_MODE) ||
      !environment.FEEDBACK_ENV_ID || (environment.FEEDBACK_HASH_SECRET ?? '').length < 32) throw unavailable();
  let allowedOrigins;
  try { allowedOrigins = JSON.parse(environment.FEEDBACK_ALLOWED_ORIGINS ?? ''); } catch { throw unavailable(); }
  if (!Array.isArray(allowedOrigins) || !allowedOrigins.length || !allowedOrigins.every(allowedOrigin)) throw unavailable();
  return { allowedOrigins, secret: environment.FEEDBACK_HASH_SECRET, environmentId: environment.FEEDBACK_ENV_ID,
    databaseMode: environment.FEEDBACK_DATABASE_MODE,
    ...(environment.FEEDBACK_DATABASE_MODE === 'postgres' ? { postgres: postgresConfiguration(environment) } : {}),
  };
}
export async function main(event, context) {
  try {
    // All gates run before loading the SDK, using credentials or touching a database.
    const config = cloudConfiguration(process.env);
    if (!initialized) initialized = (async () => {
      const manifest = JSON.parse(await readFile(new URL('../data/targets.json', import.meta.url), 'utf8'));
      targetSet(manifest);
      const sdk = require('@cloudbase/node-sdk');
      let store;
      if (config.databaseMode === 'postgres') {
        const { Pool } = require('pg');
        const pool = new Pool(config.postgres);
        // Idle-connection errors must not crash a warm function process.
        // Individual requests still return sanitized 503s on connection failure.
        pool.on('error', () => {});
        store = createPostgresStore(pool);
      } else {
        store = createCloudbaseStore(sdk.init({ env: config.environmentId }).database());
      }
      return createFeedbackHandler({ ...config, verified: true, targets: manifest, store,
        // Only trusted function-context/runtime metadata is used. Event request
        // bodies and HTTP source/X-Forwarded-For headers never supply this value.
        trustedSource: (functionContext) => sdk.getCloudbaseContext(functionContext).TCB_SOURCE_IP,
      });
    })().catch((error) => { initialized = undefined; throw error; });
    return await (await initialized)(event, context);
  } catch {
    return { statusCode: 503, isBase64Encoded: false, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
      body: JSON.stringify({ error: { code: 'SERVICE_UNAVAILABLE', message: '共享反馈服务尚未完成配置或暂时不可用。' } }) };
  }
}
