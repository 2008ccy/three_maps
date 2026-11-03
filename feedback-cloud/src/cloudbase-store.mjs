import { ApiError, unavailable } from './service.mjs';

export const collections = { feedback: 'feedback', requests: 'feedback_requests', rates: 'feedback_rate_limits' };
function first(result) {
  if (result?.code) throw unavailable();
  return Array.isArray(result?.data) ? result.data[0] : result?.data ?? undefined;
}
function checkedWrite(result) { if (!result || result.code) throw unavailable(); }
export function createCloudbaseStore(db) {
  return {
    async create({ idempotencyId, payloadHash, sourceHash, now, record }) {
      const result = await db.runTransaction(async (transaction) => {
        const requests = transaction.collection(collections.requests);
        const prior = first(await requests.doc(idempotencyId).get());
        if (prior) {
          if (prior.payloadHash !== payloadHash) throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', '这次提交与先前请求不一致，请重新提交。');
          const item = first(await transaction.collection(collections.feedback).doc(prior.feedbackId).get());
          if (!item) throw new ApiError(404, 'NOT_FOUND', '这条反馈不存在或暂未公开。');
          return { item, replayed: true };
        }
        const rates = transaction.collection(collections.rates);
        const rate = first(await rates.doc(sourceHash).get());
        const window = Math.floor(now / 60000);
        const count = rate?.window === window ? rate.count : 0;
        if (!Number.isInteger(count) || count < 0) throw unavailable();
        if (count >= 5) throw new ApiError(429, 'RATE_LIMITED', '提交过于频繁，请稍后重试。', Math.max(1, Math.ceil(((window + 1) * 60000 - now) / 1000)));
        const feedback = transaction.collection(collections.feedback);
        if (first(await feedback.doc(record.id).get())) throw unavailable();
        checkedWrite(await rates.doc(sourceHash).set({ window, count: count + 1, updatedAt: new Date(now).toISOString() }));
        checkedWrite(await feedback.doc(record.id).set(record));
        checkedWrite(await requests.doc(idempotencyId).set({ payloadHash, feedbackId: record.id, createdAt: record.createdAt }));
        return { item: record, replayed: false };
      });
      // node-sdk versions document both direct and wrapped callback results.
      const value = result?.result ?? result;
      if (!value?.item || typeof value.replayed !== 'boolean') throw unavailable();
      return value;
    },
    async get(id) { return first(await db.collection(collections.feedback).doc(id).get()); },
    async list({ filters, cursor, limit }) {
      const predicate = { isPublic: true };
      if (filters.map) predicate['target.mapId'] = filters.map;
      if (filters.type) predicate.type = filters.type;
      if (filters.status) predicate.status = filters.status;
      const where = cursor ? db.command.and([
        predicate,
        db.command.or([{ createdAt: db.command.lt(cursor.createdAt) }, { createdAt: cursor.createdAt, _id: db.command.lt(cursor.id) }]),
      ]) : predicate;
      const result = await db.collection(collections.feedback).where(where).orderBy('createdAt', 'desc').orderBy('_id', 'desc').limit(limit).get();
      if (result?.code || !Array.isArray(result?.data)) throw unavailable();
      return result.data;
    },
  };
}
