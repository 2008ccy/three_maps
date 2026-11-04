import { ApiError, unavailable } from './service.mjs';

// Constant identifiers; every visitor-supplied value uses a positional parameter.
const table = 'feedback_private.feedback';
const requests = 'feedback_private.feedback_requests';
const rates = 'feedback_private.feedback_rate_limits';
const columns = 'id, target, type, content, nickname, reference_url, created_at, status, is_public, reply, resolution, release_version';
function record(row) {
  if (!row) return undefined;
  const createdAt = row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at;
  return { id: row.id, target: row.target, type: row.type, content: row.content, createdAt,
    status: row.status, isPublic: row.is_public,
    ...(row.nickname !== null ? { nickname: row.nickname } : {}),
    ...(row.reference_url !== null ? { referenceUrl: row.reference_url } : {}),
    ...(row.reply !== null ? { reply: row.reply } : {}),
    ...(row.resolution !== null ? { resolution: row.resolution } : {}),
    ...(row.release_version !== null ? { releaseVersion: row.release_version } : {}),
  };
}
export function createPostgresStore(pool) {
  return {
    async create({ idempotencyId, payloadHash, sourceHash, now, record: item }) {
      const client = await pool.connect();
      let broken = false;
      try {
        await client.query('BEGIN');
        // The deferred FK lets this claim precede the feedback insert. PostgreSQL
        // unique-index locking serializes the same key across server instances.
        const claim = await client.query(`INSERT INTO ${requests} (idempotency_id, payload_hash, feedback_id, created_at)
          VALUES ($1, $2, $3, $4) ON CONFLICT (idempotency_id) DO NOTHING RETURNING idempotency_id`,
        [idempotencyId, payloadHash, item.id, item.createdAt]);
        if (!claim.rowCount) {
          const prior = (await client.query(`SELECT payload_hash, feedback_id FROM ${requests} WHERE idempotency_id = $1`, [idempotencyId])).rows[0];
          if (!prior) throw unavailable();
          if (prior.payload_hash !== payloadHash) throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', '这次提交与先前请求不一致，请重新提交。');
          const found = (await client.query(`SELECT ${columns} FROM ${table} WHERE id = $1`, [prior.feedback_id])).rows[0];
          if (!found) throw new ApiError(404, 'NOT_FOUND', '这条反馈不存在或暂未公开。');
          await client.query('COMMIT');
          return { item: record(found), replayed: true };
        }
        const window = Math.floor(now / 60000);
        await client.query(`INSERT INTO ${rates} (source_hash, minute_window, count, updated_at) VALUES ($1, $2, 0, $3)
          ON CONFLICT (source_hash) DO NOTHING`, [sourceHash, window, item.createdAt]);
        const rate = (await client.query(`SELECT minute_window, count FROM ${rates} WHERE source_hash = $1 FOR UPDATE`, [sourceHash])).rows[0];
        if (!rate) throw unavailable();
        const count = Number(rate.minute_window) === window ? rate.count : 0;
        if (!Number.isInteger(count) || count < 0) throw unavailable();
        if (count >= 5) throw new ApiError(429, 'RATE_LIMITED', '提交过于频繁，请稍后重试。', Math.max(1, Math.ceil(((window + 1) * 60000 - now) / 1000)));
        await client.query(`UPDATE ${rates} SET minute_window = $2, count = $3, updated_at = $4 WHERE source_hash = $1`, [sourceHash, window, count + 1, item.createdAt]);
        await client.query(`INSERT INTO ${table} (id, target, type, content, nickname, reference_url, created_at, status, is_public)
          VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7, $8, $9)`,
        [item.id, JSON.stringify(item.target), item.type, item.content, item.nickname ?? null, item.referenceUrl ?? null, item.createdAt, item.status, item.isPublic]);
        await client.query('COMMIT');
        return { item, replayed: false };
      } catch (error) {
        try { await client.query('ROLLBACK'); } catch { broken = true; }
        throw error;
      } finally { client.release(broken); }
    },
    async get(id) {
      return record((await pool.query(`SELECT ${columns} FROM ${table} WHERE id = $1`, [id])).rows[0]);
    },
    async list({ filters, cursor, limit }) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 21) throw unavailable();
      const values = [], conditions = ['is_public = true'];
      const add = (value) => { values.push(value); return `$${values.length}`; };
      if (filters.map) conditions.push(`target ->> 'mapId' = ${add(filters.map)}`);
      if (filters.type) conditions.push(`type = ${add(filters.type)}`);
      if (filters.status) conditions.push(`status = ${add(filters.status)}`);
      if (cursor) conditions.push(`(created_at, id) < (${add(cursor.createdAt)}::timestamptz, ${add(cursor.id)}::text)`);
      const result = await pool.query(`SELECT ${columns} FROM ${table} WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC, id DESC LIMIT ${add(limit)}`, values);
      return result.rows.map(record);
    },
  };
}
