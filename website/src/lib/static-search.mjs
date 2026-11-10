import Search from 'flexsearch';

// Keep indexing and querying on the same CJK encoder. The upstream static
// client recreates a default encoder, so it cannot query CJK exports correctly.
/** @type {{ encoder: import('flexsearch').EncoderOptions, tokenize: 'full' }} */
export const searchOptions = { encoder: Search.Charset.CJK, tokenize: 'full' };

/** @param {string} from */
export function createStaticSearch(from) {
  let database;
  async function load() {
    if (!database) database = (async () => {
      const response = await fetch(from);
      if (!response.ok) throw new Error('搜索索引暂时无法加载，请重试。');
      const data = await response.json();
      const index = new Search.Document({
        ...searchOptions,
        document: { id: 'id', index: ['content'], tag: ['tags'], store: true },
      });
      for (const [key, value] of Object.entries(data.raw)) index.import(key, value);
      return index;
    })().catch((error) => { database = undefined; throw error; });
    return database;
  }
  return {
    /** @param {string} query @param {string[]} tags @returns {Promise<import('fumadocs-core/search').SortedResult[]>} */
    async search(query, tags = []) {
      const index = await load();
      const term = query.trim();
      if (!term && !tags.length) return [];
      // Filter each selected map before the hit limit so quieter maps still surface.
      const scopes = tags.length ? tags : [null];
      const hits = await Promise.all(scopes.map((tag) => index.searchAsync(term, {
        index: 'content', limit: term ? 80 : Number.MAX_SAFE_INTEGER,
        ...(tag ? { tag: { tags: tag } } : {}),
      })));
      const groups = new Map();
      for (const id of hits.flatMap((scope) => scope[0]?.result ?? [])) {
        const doc = index.get(id);
        if (!doc || (!term && doc.type !== 'page')) continue;
        if (!groups.has(doc.page_id)) groups.set(doc.page_id, []);
        if (doc.type !== 'page') groups.get(doc.page_id).push(doc);
      }
      const results = [];
      for (const [id, matches] of groups) {
        const page = index.get(id);
        if (page) results.push(page, ...matches);
      }
      return results;
    },
  };
}
