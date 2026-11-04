import { unavailable } from './service.mjs';

// Keep URL SSL parameters out: node-postgres can otherwise replace the explicit
// verified TLS settings while parsing the connection string.
export function postgresConfiguration(environment) {
  let url;
  try { url = new URL(environment.FEEDBACK_POSTGRES_URL ?? ''); } catch { throw unavailable(); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.username || !url.pathname.slice(1) || url.search || url.hash) throw unavailable();
  const ca = environment.FEEDBACK_POSTGRES_CA;
  if (ca && (!ca.includes('-----BEGIN CERTIFICATE-----') || !ca.includes('-----END CERTIFICATE-----'))) throw unavailable();
  return { connectionString: url.toString(), ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
    max: 2, connectionTimeoutMillis: 5000, idleTimeoutMillis: 10000,
    statement_timeout: 8000, query_timeout: 9000, application_name: 'three-maps-feedback',
  };
}
