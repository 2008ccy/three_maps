import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { load } from 'cheerio';
import { createStaticSearch } from '../src/lib/static-search.mjs';

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
  ['/docs/domain/entries/k-rag', '/docs/ecosystem/entries/e-rag', '/docs/ecosystem/collaboration', '/docs/cognition/tradeoffs'],
  ['/docs/ecosystem/entries/e-hf', '/docs/domain/entries/t-peft', '/docs/cognition/loss'],
  ['/docs/domain/entries/k-deploy', '/docs/ecosystem/entries/e-api', '/docs/cognition/tradeoffs'],
]) test(`cross-map path: ${chain[0]}`, () => {
  for (let i=0; i<chain.length-1; i++) {
    const $=html(chain[i]);
    assert.ok($(`article a[href="${basePath}${chain[i+1]}/"]`).length, `${chain[i]} → ${chain[i+1]}`);
  }
});
test('formulas render and sources remain navigable', () => {
  const $=html('/docs/domain/concepts');
  assert.ok($('.katex').length >= 4);
  assert.equal($('.katex-error').length, 0);
  assert.ok($(`a[href="${basePath}/docs/sources/#s01"]`).length);
});
test('edited RAG title and description reach body and navigation', () => {
  const $=html('/docs/domain/entries/k-rag');
  assert.equal($('h1').text(), 'RAG · 检索增强生成');
  assert.ok($.text().includes('先检索，再生成：让回答有可以核对的资料依据。'));
  assert.ok($(`aside a[href="${basePath}/docs/domain/entries/k-rag/"]`).text().includes('RAG'));
});
