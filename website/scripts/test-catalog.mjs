import test from 'node:test';
import assert from 'node:assert/strict';
import { maps, flattenNodes } from '../src/lib/maps/content.ts';
import { buildCatalog, buildEdges, filterCatalog, emptyFilters, catalogQuery, readCatalogQuery } from '../src/lib/maps/catalog.ts';

for (const map of maps) {
  test(`${map.id}: catalog preserves every node, path and evidence boundary`, () => {
    const nodes = buildCatalog(map);
    assert.equal(nodes.length, flattenNodes(map.branches).length);
    assert.equal(new Set(nodes.map((node) => node.id)).size, nodes.length);
    for (const node of nodes) {
      assert.equal(node.verification, '待核实');
      assert.equal(node.understanding, '待自评');
      assert.ok(node.type && node.group && node.path.length === node.depth);
      if (node.parent) assert.ok(nodes.some((item) => item.id === node.parent));
    }
  });
  test(`${map.id}: all edges resolve and directional statistics count unique facts once`, () => {
    const nodes = buildCatalog(map), edges = buildEdges(map);
    assert.equal(new Set(edges.map((edge) => edge.id)).size, edges.length);
    const local = edges.filter((edge) => edge.targetMap === map.id), cross = edges.filter((edge) => edge.targetMap !== map.id);
    assert.equal(local.length + cross.length, edges.length);
    for (const edge of edges) {
      assert.ok(nodes.some((node) => node.id === edge.from));
      assert.ok(buildCatalog(maps.find((item) => item.id === edge.targetMap)).some((node) => node.id === edge.to));
      assert.ok(edge.label && edge.sources.length);
    }
    assert.equal(edges.filter((edge) => edge.kind === 'hierarchy').length, nodes.filter((node) => node.parent).length);
    for (const connection of map.connections ?? []) assert.equal(edges.filter((edge) => edge.from === connection.from && edge.to === connection.to && edge.label === connection.label && edge.kind === 'feedback').length, 1);
  });
}
test('filters use intersection, trim case-insensitive search and return a genuine empty state', () => {
  const nodes = buildCatalog(maps[0]);
  assert.deepEqual(filterCatalog(nodes, emptyFilters), nodes);
  const matches = filterCatalog(nodes, { ...emptyFilters, type: '训练方法', q: '  lOrA  ', verification: '待核实' });
  assert.deepEqual(matches.map((node) => node.id), ['finetuning']);
  assert.equal(filterCatalog(nodes, { ...emptyFilters, q: '不存在的条目123456' }).length, 0);
  assert.equal(filterCatalog(nodes, { ...emptyFilters, verification: '已核实' }).length, 0);
});
test('only explicit understanding labels migrate; trying a tool is not inferred from narrative', () => {
  const nodes = buildCatalog(maps[0], { 'K-LOSS': '资料整理 · 待深入学习', 'K-SFT': '成员试用自述 · 附件待补' });
  assert.equal(nodes.find((node) => node.id === 'loss').understanding, '待深入学习');
  assert.equal(nodes.find((node) => node.id === 'finetuning').understanding, '待自评');
});
test('query state round trips Chinese filters and leaves legacy node hashes independent', () => {
  const filters = { type: '训练方法', understanding: '待自评', verification: '待核实', q: 'LoRA / 参数' };
  assert.deepEqual(readCatalogQuery(catalogQuery('graph', filters)), { view: 'graph', filters });
  assert.deepEqual(readCatalogQuery(''), { view: 'cards', filters: emptyFilters });
  assert.equal(catalogQuery('cards', emptyFilters), '');
  assert.equal(readCatalogQuery('?view=unknown').view, 'cards');
});

test('topic overview collapses the three maps to 5, 6 and 4 groups without losing members', async () => {
  const { groupCatalog, catalogChildren } = await import('../src/lib/maps/catalog.ts');
  for (const [index, map] of maps.entries()) {
    const nodes = buildCatalog(map), groups = groupCatalog(nodes, nodes);
    assert.equal(groups.length, [5, 6, 4][index]);
    const all = groups.flatMap(({ root, members }) => [root.id, ...members.map((node) => node.id)]);
    assert.equal(new Set(all).size, nodes.length);
    assert.equal(all.length, nodes.length);
    assert.deepEqual(groups.map(({ root }) => root.id), map.branches.map((node) => node.id));
    for (const { root } of groups) assert.deepEqual(catalogChildren(nodes, root.id).map((node) => node.id), root.children.map((node) => node.id));
  }
});
test('a deep search match keeps its containing topic and direct-child navigation', async () => {
  const { groupCatalog, catalogChildren } = await import('../src/lib/maps/catalog.ts');
  const domain = buildCatalog(maps[0]);
  const matches = filterCatalog(domain, { ...emptyFilters, q: 'LoRA' });
  const groups = groupCatalog(domain, matches);
  assert.deepEqual(groups.map(({ root }) => root.id), ['training']);
  assert.deepEqual(groups[0].matches.map((node) => node.id), ['finetuning']);
  assert.equal(groupCatalog(domain, []).length, 0);
  const ecosystem = buildCatalog(maps[1]);
  assert.ok(catalogChildren(ecosystem, 'participants').some((node) => node.id === 'research-teams'));
  assert.ok(catalogChildren(ecosystem, 'research-teams').some((node) => node.id === 'lora-authors'));
  assert.equal(catalogChildren(ecosystem, 'lora-authors').length, 0);
});
