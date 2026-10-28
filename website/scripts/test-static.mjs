import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { load } from 'cheerio';
import { createStaticSearch } from '../src/lib/static-search.mjs';
import { readPages } from './content-utils.mjs';
import { documentReturnTarget, isAppUrl } from '../src/lib/document-navigation.ts';

const { basePath } = JSON.parse(readFileSync('out/.site-build.json', 'utf8'));
const searchFile = ['out/api/search', 'out/api/search/index.json', 'out/api/search/index.html'].find((file) => {
  try { return existsSync(file) && readFileSync(file).length > 0; } catch { return false; }
});
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  assert.equal(url, `${basePath}/api/search/`);
  return new Response(readFileSync(searchFile, 'utf8'), { headers: { 'Content-Type': 'application/json' } });
};
test.after(() => { globalThis.fetch = originalFetch; });
const client = createStaticSearch(`${basePath}/api/search/`);

for (const [query, target] of [
  ['微调', '/docs/domain/entries/k-sft'],
  ['检索增强', '/docs/domain/entries/k-rag'],
  ['LoRA', '/docs/domain/entries/k-lora'],
  ['RAG', '/docs/domain/entries/k-rag'],
]) {
  test(`exported browser search: ${query}`, async () => {
    const results = await client.search(query);
    assert.ok(results.some((item) => item.url.split('#')[0].replace(/\/$/, '') === target));
  });
}
test('unknown search returns no fabricated result', async () => {
  assert.deepEqual(await client.search('zzzxnonexistent999'), []);
});
function html(route) { return load(readFileSync(`out${route}/index.html`, 'utf8')); }
for (const chain of [
  ['/docs/domain/#node-rag', '/docs/ecosystem/#node-rag-authors', '/docs/domain/#node-rag', '/docs/cognition/#node-system-view'],
  ['/docs/domain/#node-lora', '/docs/ecosystem/#node-lora-authors', '/docs/domain/#node-lora', '/docs/domain/#node-finetuning', '/docs/cognition/#node-loss-test'],
  ['/docs/domain/#node-deployment', '/docs/ecosystem/#node-api-platforms', '/docs/cognition/#node-cost-api', '/docs/ecosystem/#node-inference-cost'],
]) test(`cross-map path: ${chain[0]}`, () => {
  for (let i=0; i<chain.length-1; i++) {
    const [route, hash] = chain[i].split('#');
    const $=html(route.replace(/\/$/, ''));
    const node = $(`details[id="${hash}"]`);
    assert.ok(node.find(`a[href="${basePath}${chain[i+1]}"]`).length, `${chain[i]} → ${chain[i+1]}`);
  }
});

test('document pages offer owning-node navigation and keep pagination absent', () => {
  const titles = { domain: '领域地图', ecosystem: '生态地图', cognition: '认知地图' };
  const overviewRoutes = new Set(Object.keys(titles).map((id) => `/docs/${id}`));
  for (const { url } of readPages()) {
    if (overviewRoutes.has(url)) continue;
    const $ = html(url);
    const article = $('article');
    const map = url.split('/')[2];
    const link = article.find('nav[aria-label="正文返回导航"] a');
    assert.equal(link.length, 1, url);
    assert.ok(link.attr('href')?.startsWith(titles[map] ? `${basePath}/docs/${map}/` : `${basePath}/`), url);
    assert.ok(link.text().trim().startsWith(`返回${titles[map] ?? '首页'}`), url);
    assert.ok(!article.text().includes('沿着关系继续探索'), url);
    assert.ok(!article.text().includes('上一篇'), url);
    assert.ok(!article.text().includes('下一篇'), url);
    assert.equal(article.find('section[aria-label="相关条目"]').length, 0, url);
  }
});

test('back navigation rejects blank, external and different-deployment history entries', () => {
  const origin = 'https://example.test';
  for (const previous of [undefined, null, 'about:blank', 'https://other.test/three_maps/docs/domain/', `${origin}/other/`, `${origin}/three_maps-copy/`, '/three_maps/docs/domain/']) {
    assert.equal(isAppUrl(previous, origin, '/three_maps'), false, String(previous));
  }
  assert.equal(isAppUrl(`${origin}/three_maps/docs/domain/#node-rag`, origin, '/three_maps'), true);
  assert.equal(isAppUrl(`${origin}/three_maps/`, origin, '/three_maps'), true);
  assert.equal(isAppUrl(`${origin}/docs/domain/`, origin, ''), true);
});

test('direct-entry back fallback resolves the owning map rather than a blank page', () => {
  for (const [route, href] of [['/docs/domain/evaluation/', '/docs/domain/'], ['/docs/ecosystem/entries/e-rag/', '/docs/ecosystem/'], ['/docs/cognition/loss/', '/docs/cognition/'], ['/docs/sources/', '/'], ['/docs/domainish/', '/']]) {
    assert.equal(documentReturnTarget(route).href, href);
  }
});
test('formulas render and sources remain navigable', () => {
  const $=html('/docs/domain/concepts');
  assert.ok($('.katex').length >= 4);
  assert.equal($('.katex-error').length, 0);
  assert.ok($(`a[href="${basePath}/docs/sources/#s01"]`).length);
});
test('edited RAG title and description reach body and linked concept cards', () => {
  const $=html('/docs/domain/entries/k-rag');
  assert.equal($('h1').text(), 'RAG · 检索增强生成');
  assert.ok($.text().includes('先检索，再生成：让回答有可以核对的资料依据。'));
  const concepts = html('/docs/domain/concepts');
  assert.ok(concepts('article a.node-card').toArray().some((card) => concepts(card).text().includes('RAG · 检索增强生成')));
  assert.ok(concepts(`.article-content a[href="${basePath}/docs/domain/entries/k-rag"]`).length || concepts(`.article-content a[href="${basePath}/docs/domain/entries/k-rag/"]`).length);
});

test('article bodies expose knowledge links and preserve citations and old anchors', () => {
  const $ = html('/docs/domain/entries/k-rag');
  assert.ok($(`.article-content a[href="${basePath}/docs/domain/concepts"]`).length || $(`.article-content a[href="${basePath}/docs/domain/concepts/"]`).length);
  assert.ok($(`.article-content a[href="${basePath}/docs/sources/#s02"]`).length);
  const lora = html('/docs/domain/entries/k-lora');
  assert.equal(lora('#它是什么').length, 1);
  assert.equal(lora('.article-content').text().includes('冻结基座权重，用可训练的低秩增量适配模型。'), false);
  assert.ok(lora('nav[aria-label="相关知识"] a').length);
});
test('deep pages use top navigation without a site-wide left sidebar', () => {
  const $ = html('/docs/domain/entries/k-rag');
  assert.equal($('#nd-sidebar').length, 0);
  assert.ok($('nav[aria-label="正文所属路径"]').text().includes('领域地图'));
  assert.ok($('nav[aria-label="相关知识"]').text().includes('关联阅读'));
});
