import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { load } from 'cheerio';
import { createStaticSearch } from '../src/lib/static-search.mjs';
import { readPages } from './content-utils.mjs';
import { documentReturnTarget, isAppUrl, isLegacyMapArticle } from '../src/lib/document-navigation.ts';
import { maps } from '../src/lib/maps/content.ts';
import { buildCatalog } from '../src/lib/maps/catalog.ts';
import { mapSearchIndexes } from '../src/lib/map-search-indexes.ts';

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
  ['微调', '/docs/domain/#node-finetuning'],
  ['检索增强', '/docs/domain/#node-rag'],
  ['LoRA', '/docs/domain/#node-lora'],
  ['RAG', '/docs/domain/#node-rag'],
  ['独立反馈', '/docs/cognition/#node-weekly-review'],
]) {
  test(`exported browser search: ${query}`, async () => {
    const results = await client.search(query);
    assert.ok(results.some((item) => item.url === target));
    for (const result of results) {
      assert.ok(!isLegacyMapArticle(result.url), result.url);
      assert.ok((result.url.match(/#/g) ?? []).length <= 1, result.url);
    }
  });
}
test('search indexes every active node directly without retired addresses or duplicate fragments', () => {
  const indexes = mapSearchIndexes();
  const expected = maps.flatMap((map) => [`/docs/${map.id}/`, ...buildCatalog(map).map((node) => `/docs/${map.id}/#node-${node.id}`)]);
  assert.deepEqual(indexes.map((entry) => entry.url), expected);
  assert.equal(new Set(indexes.map((entry) => entry.id)).size, indexes.length);
  assert.equal(new Set(indexes.map((entry) => entry.url)).size, indexes.length);
  for (const entry of indexes) {
    assert.equal(entry.structuredData.headings.length, 0);
    assert.ok(entry.structuredData.contents.every((content) => !content.heading));
  }
});
test('search omits the original docs introduction including its section results', async () => {
  for (const query of ['从预训练模型到课程答疑助手', 'RAG', '认知地图']) {
    const results = await client.search(query);
    assert.ok(results.every((entry) => !isLegacyMapArticle(entry.url)), query);
  }
  for (const href of ['/docs', '/docs/', '/docs?query=rag', '/docs/#入门']) assert.ok(isLegacyMapArticle(href), href);
  for (const href of ['/', '/docs/domain/', '/docs/cognition/#node-system-view', '/docs/project/updates/', '/docs/sources/#l1']) assert.ok(!isLegacyMapArticle(href), href);
});
test('search retains current updates and sources as public destinations', async () => {
  for (const [query, target] of [['更新记录', '/docs/project/updates'], ['资料来源', '/docs/sources'], ['来源与依据', '/docs/sources']]) {
    const results = await client.search(query);
    assert.ok(results.some((entry) => entry.url.split('#')[0].replace(/\/$/, '') === target), query);
  }
});
test('unknown search returns no fabricated result', async () => {
  assert.deepEqual(await client.search('zzzxnonexistent999'), []);
});
function html(route) { return load(readFileSync(`out${route}/index.html`, 'utf8')); }
test('top navigation keeps sources immediately after updates as a peer destination', () => {
  const expected = [
    ['领域', '/docs/domain/'], ['生态', '/docs/ecosystem/'], ['认知', '/docs/cognition/'],
    ['更新记录', '/docs/project/updates/'], ['资料来源', '/docs/sources/'],
  ];
  for (const route of ['', '/docs/domain', '/docs/ecosystem', '/docs/cognition', '/docs/project/updates', '/docs/sources', '/feedback']) {
    const $ = html(route);
    const nav = $('#nd-nav nav[aria-label="网站主导航"]');
    assert.equal(nav.length, 1, route || '/');
    assert.deepEqual(nav.find('a').toArray().map((item) => [$(item).text().trim(), $(item).attr('href')?.slice(basePath.length)]), expected, route || '/');
    assert.equal($('#nd-sidebar').length, 0, route || '/');
  }
});

test('renamed sources preserve their stable identity, article layout and every source anchor', () => {
  const page = readPages().find((item) => item.data.id === 'P-SOURCES');
  assert.equal(page?.url, '/docs/sources');
  assert.equal(page?.data.title, '资料来源');
  const $ = html('/docs/sources');
  assert.equal($('article.reading-article .reading-header h1').text(), '资料来源');
  assert.equal($('.reading-grid').length, 1);
  assert.equal($('aside[aria-label="阅读辅助导航"]').length, 1);
  for (const id of [...Array.from({ length: 8 }, (_, index) => `l${index + 1}`), ...Array.from({ length: 30 }, (_, index) => `s${String(index + 1).padStart(2, '0')}`)]) {
    assert.equal($(`[id="${id}"]`).length, 1, id);
  }
});

for (const chain of [
  ['/docs/domain/#node-rag', '/docs/ecosystem/#node-research-origins', '/docs/domain/#node-rag', '/docs/cognition/#node-system-view'],
  ['/docs/domain/#node-lora', '/docs/ecosystem/#node-research-origins', '/docs/domain/#node-lora', '/docs/domain/#node-finetuning', '/docs/cognition/#node-loss-test'],
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
    assert.equal($('.reading-eyebrow').length, 0, url);
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
test('edited RAG title and description reach body and static concept cards', () => {
  const $=html('/docs/domain/entries/k-rag');
  assert.equal($('h1').text(), 'RAG · 检索增强生成');
  assert.ok($.text().includes('先检索，再生成：让回答有可以核对的资料依据。'));
  const concepts = html('/docs/domain/concepts');
  assert.ok(concepts('article .node-card-static').toArray().some((card) => concepts(card).text().includes('RAG · 检索增强生成')));
  assert.equal(concepts('article a.node-card').length, 0);
});

test('article bodies keep knowledge labels, citations and old anchors without old article links', () => {
  const $ = html('/docs/domain/entries/k-rag');
  assert.ok($('.article-content').text().includes('核心概念与公式'));
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
  assert.ok($('nav[aria-label="相关知识"] a').length);
});

test('updates are collapsed native version cards with no templates or old reading entrances', () => {
  const $ = html('/docs/project/updates');
  const cards = $('.update-entry');
  assert.deepEqual(cards.find('.update-version').map((_, item) => $(item).text()).get(), ['v1.4','v1.3','v1.2','v1.1','v1.0']);
  assert.equal(cards.filter('[open]').length, 0);
  assert.equal(cards.filter('details').length, 5);
  assert.equal(cards.children('summary').length, 5);
  assert.equal(cards.find('time[datetime]').length, 5);
  assert.ok($('#v1-0').text().includes('三张地图初始版本'));
  assert.ok($('#v1-1').text().includes('生态地图'));
  assert.equal($('nav[aria-label="相关知识"], section[aria-label="关联阅读"], aside[aria-label="阅读辅助导航"]').length, 0);
  assert.equal($('.article-content table, .article-content pre, .article-content code').length, 0);
  assert.ok(!$('.article-content').text().includes('可复制的记录模板'));
  assert.equal($('.article-content a[href]').length, 0);
});

test('all knowledge cards and reading relations omit old map article destinations', () => {
  for (const { url } of readPages()) {
    const $ = html(url);
    for (const anchor of $('.article-content a[href], .reading-next a[href], .reading-relations a[href], [data-map] a[href]').toArray()) {
      const href = $(anchor).attr('href');
      const pathname = href.startsWith(basePath + '/') ? href.slice(basePath.length) : href;
      assert.ok(!/^\/docs\/(?:domain|ecosystem|cognition)\/[^/?#]+/.test(pathname), `${url}: ${href}`);
    }
  }
});

test('retired ecosystem articles remain accessible but do not re-enter the search index', async () => {
  const results = await client.search('Qwen');
  assert.ok(!results.some((item) => item.url.includes('/docs/ecosystem/entries/')));
  const $ = html('/docs/ecosystem/entries/e-qwen');
  assert.ok($(`.article-content a[href="${basePath}/docs/ecosystem/#node-qwen"]`).length);
});
