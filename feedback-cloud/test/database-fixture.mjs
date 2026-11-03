// Test-only transactional SDK fixture. Never imported by the deployment entry.
function matches(value, expression) {
  if (expression.$and) return expression.$and.every((entry) => matches(value, entry));
  if (expression.$or) return expression.$or.some((entry) => matches(value, entry));
  return Object.entries(expression).every(([key, expected]) => {
    const actual = key.split('.').reduce((item, part) => item?.[part], value);
    return expected && typeof expected === 'object' && '$lt' in expected ? actual < expected.$lt : actual === expected;
  });
}
export function databaseFixture() {
  let documents = new Map(), queue = Promise.resolve();
  const scopedCollection = (name, table) => ({
    doc(id) { return {
      async get() { const value = table.get(`${name}:${id}`); return { data: value ? [structuredClone(value)] : [] }; },
      async set(value) { table.set(`${name}:${id}`, { ...structuredClone(value), _id: id }); return { updated: 1 }; },
    }; },
    where(expression) {
      const order = []; let size = 100;
      const query = {
        orderBy(field, direction) { order.push([field, direction]); return query; },
        limit(limit) { size = limit; return query; },
        async get() {
          const rows = [...table.entries()].filter(([key]) => key.startsWith(name + ':')).map(([, doc]) => structuredClone(doc)).filter((doc) => matches(doc, expression));
          rows.sort((a, b) => {
            for (const [key, direction] of order) if (a[key] !== b[key]) return (a[key] < b[key] ? -1 : 1) * (direction === 'desc' ? -1 : 1);
            return 0;
          });
          return { data: rows.slice(0, size) };
        },
      }; return query;
    },
  });
  return {
    command: { and: (parts) => ({ $and: parts }), or: (parts) => ({ $or: parts }), lt: (value) => ({ $lt: value }) },
    collection(name) { return scopedCollection(name, documents); },
    async runTransaction(callback) {
      const operation = queue.then(async () => {
        const copy = structuredClone(documents);
        const result = await callback({ collection: (name) => scopedCollection(name, copy) });
        documents = copy;
        return { result, errMsg: 'runTransaction:ok' };
      });
      queue = operation.catch(() => {});
      return operation;
    },
    async seed(name, id, value) { await this.collection(name).doc(id).set(value); },
    records(name) { return [...documents.entries()].filter(([key]) => key.startsWith(name + ':')).map(([, value]) => structuredClone(value)); },
  };
}
