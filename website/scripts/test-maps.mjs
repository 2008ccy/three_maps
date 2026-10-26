import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from 'cheerio';
import { maps, flattenNodes, documentKey } from '../src/lib/maps/content.ts';
import { findPath, stateForNode, stateFromHash, stateHash, toggleBranch } from '../src/lib/maps/state.ts';
import { readPages } from './content-utils.mjs';

const pages = readPages();
const { basePath } = JSON.parse(readFileSync('out/.site-build.json', 'utf8'));
const pageById = new Map(pages.map((page) => [page.data.id, page]));
const source = load(readFileSync('out/docs/sources/index.html', 'utf8'));
const html = (url) => load(readFileSync(`out${url}/index.html`, 'utf8'));

test('domain graph preserves the supplied five branches and fifteen leaves', () => {
  assert.deepEqual(maps[0].branches.map((node) => [node.title, node.children.map((child) => child.title)]), [
    ['任务', ['预测', '生成', '对齐']], ['数据', ['采集', '清洗', '评测集']],
    ['模型', ['Token', '注意力', 'Transformer']], ['训练', ['损失', '预训练', '微调 / LoRA']],
    ['系统', ['RAG', '部署', '监控']],
  ]);
});

for (const map of maps) {
  test(`${map.id}: stable unique node IDs, document anchors, sources and cross-map destinations`, () => {
    const nodes = flattenNodes(map.branches);
    assert.equal(new Set(nodes.map((node) => node.id)).size, nodes.length);
    for (const node of nodes) {
      assert.match(node.id, /^[a-z0-9-]+$/);
      assert.ok(node.detail && node.documents.length && node.sources.length, node.id);
      for (const ref of node.documents) {
        assert.ok(pageById.has(ref.id), documentKey(ref));
        if (ref.anchor) assert.equal(html(pageById.get(ref.id).url)(`[id="${ref.anchor}"]`).length, 1, documentKey(ref));
      }
      for (const ref of node.sources) assert.equal(source(`[id="${ref.toLowerCase()}"]`).length, 1, ref);
      for (const relation of node.relations ?? []) {
        assert.ok(relation.label, node.id);
        const target = maps.find((item) => item.id === relation.map);
        assert.ok(target && findPath(target.branches, relation.node), `${relation.map}/${relation.node}`);
        assert.equal(stateForNode(target.branches, relation.node).selected, relation.node);
      }
    }
  });

  test(`${map.id}: static full-width route and usable no-JavaScript outline`, () => {
    const $ = html(`/docs/${map.id}`);
    assert.equal($('h1').text(), map.title);
    assert.equal($('#nd-sidebar').length, 0);
    for (const node of flattenNodes(map.branches)) {
      const item = $(`details[id="node-${node.id}"]`);
      assert.equal(item.length, 1, node.id);
      assert.ok(item.children('summary').text().includes(node.title));
      for (const ref of node.documents) {
        const page = pageById.get(ref.id);
        const href = `${basePath}${page.url}/${ref.anchor ? `#${ref.anchor}` : ''}`;
        assert.ok(item.find(`a[href="${href}"]`).length, href);
      }
    }
    // Every pre-existing top-level map topic remains reachable.
    const topicPages = pages.filter((page) => page.url.startsWith(`/docs/${map.id}/`) && !page.url.includes('/entries/'));
    for (const page of topicPages) assert.ok($(`a[href="${basePath}${page.url}/"]`).length, page.url);
  });

  test(`${map.id}: hash restores every branch and leaf without opening siblings`, () => {
    for (const node of flattenNodes(map.branches)) {
      const state = stateFromHash(map.branches, `#node-${node.id}`);
      const path = findPath(map.branches, node.id);
      assert.deepEqual(state.expanded, path.filter((item) => item.children?.length).map((item) => item.id));
      assert.equal(state.selected, node.children ? null : node.id);
      assert.equal(stateHash(state), `#node-${node.id}`);
    }
    assert.deepEqual(stateFromHash(map.branches, '#node-unknown'), { expanded: [], selected: null });
    assert.deepEqual(stateFromHash(map.branches, '#%E0%A4%A'), { expanded: [], selected: null });
  });
}

test('nested branches switch, collapse and reset without keeping stale leaf selection', () => {
  const nodes = maps[1].branches;
  const selected = stateForNode(nodes, 'lora-authors');
  assert.deepEqual(selected, { expanded: ['participants', 'research-teams'], selected: 'lora-authors' });
  assert.deepEqual(toggleBranch(nodes, selected, 'communities'), { expanded: ['participants', 'communities'], selected: null });
  assert.deepEqual(toggleBranch(nodes, selected, 'research-teams'), { expanded: ['participants'], selected: null });
  assert.deepEqual(toggleBranch(nodes, selected, 'participants'), { expanded: [], selected: null });
  assert.deepEqual(toggleBranch(nodes, selected, 'costs'), { expanded: ['costs'], selected: null });
  const closedPanel = { ...selected, selected: null };
  assert.equal(stateHash(closedPanel), '#node-research-teams');
});

test('updated curriculum and its derivative-source boundary reach the site', () => {
  const $ = html('/docs/domain/learning');
  assert.ok($('article').text().includes('浙江大学 2026 级人工智能专业'));
  assert.ok($('article').text().includes('科研实践 III-VI'));
  assert.ok($('article').text().includes('正式培养方案原件'));
  assert.ok($(`a[href="${basePath}/docs/sources/#l6"]`).length);
  assert.ok(source(`a[href="${basePath}/sources/ai-model-building-zju.pdf"]`).length);
});
