import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { maps, flattenNodes } from '../src/lib/maps/content.ts';
import { buildCatalog, buildEdges, resolveCatalogNode, filterCatalog, emptyFilters, catalogQuery, readCatalogQuery } from '../src/lib/maps/catalog.ts';
import { zoomGraphCamera } from '../src/lib/maps/graph-camera.ts';

test('mobile graph zoom-out keeps its fitted overview instead of enlarging it', () => {
  const viewport = { width: 350, height: 520 }, graph = { width: 1204, height: 600 };
  const scale = Math.min(1, viewport.width / graph.width, viewport.height / graph.height);
  const fitted = { scale, x: (viewport.width - graph.width * scale) / 2, y: (viewport.height - graph.height * scale) / 2 };
  const out = zoomGraphCamera(fitted, 1 / 1.2, viewport, graph);
  assert.ok(out.scale <= fitted.scale, 'minus must never enlarge the mobile overview');
  assert.deepEqual(out, fitted, 'the full fitted overview remains the lower zoom boundary');
  const enlarged = zoomGraphCamera(fitted, 1.2, viewport, graph);
  assert.ok(enlarged.scale > fitted.scale);
  const restored = zoomGraphCamera(enlarged, 1 / 1.2, viewport, graph);
  assert.ok(Math.abs(restored.scale - fitted.scale) < 1e-10);
});

test('graph zoom preserves the viewport center and existing desktop zoom bounds', () => {
  const viewport = { width: 1204, height: 560 }, graph = { width: 1204, height: 600 };
  const camera = { x: -130, y: 45, scale: 1 };
  const pointAtCenter = (value) => [(viewport.width / 2 - value.x) / value.scale, (viewport.height / 2 - value.y) / value.scale];
  for (const factor of [1 / 1.2, 1.2, 100, .001]) {
    const result = zoomGraphCamera(camera, factor, viewport, graph);
    const before = pointAtCenter(camera), after = pointAtCenter(result);
    before.forEach((coordinate, index) => assert.ok(Math.abs(coordinate - after[index]) < 1e-10));
    assert.ok(result.scale >= .4 && result.scale <= 1.8);
  }
});

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
  assert.deepEqual(matches.map((node) => node.id), ['finetuning', 'lora']);
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
  assert.deepEqual(readCatalogQuery(catalogQuery('graph', filters)), { view: 'graph', relations: 'core', filters });
  assert.deepEqual(readCatalogQuery(''), { view: 'cards', relations: 'core', filters: emptyFilters });
  assert.equal(catalogQuery('cards', emptyFilters), '');
  assert.equal(readCatalogQuery('?view=unknown').view, 'cards');
});

test('topic overview collapses the three maps to 5, 5 and 4 groups without losing members', async () => {
  const { groupCatalog, catalogChildren } = await import('../src/lib/maps/catalog.ts');
  for (const [index, map] of maps.entries()) {
    const nodes = buildCatalog(map), groups = groupCatalog(nodes, nodes);
    assert.equal(groups.length, [5, 5, 4][index]);
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
  assert.deepEqual(groups[0].matches.filter((node) => node.parent).map((node) => node.id), ['finetuning', 'lora']);
  assert.equal(groupCatalog(domain, []).length, 0);
  const ecosystem = buildCatalog(maps[1]);
  assert.ok(resolveCatalogNode(maps[1], ecosystem, 'participants').children.some((node) => node.id === 'research-origins'));
  assert.ok(catalogChildren(ecosystem, 'stage-publish').some((node) => node.id === 'research-origins'));
  assert.equal(catalogChildren(ecosystem, 'lora-authors').length, 0);
});

test('domain lessons cover 18 points, preserve legacy IDs, and keep demonstration inputs explicit', async () => {
  const { teachingCase } = await import('../src/lib/maps/teaching-case.ts');
  const nodes = buildCatalog(maps[0]), points = nodes.filter((node) => node.parent);
  assert.equal(nodes.length, 23); assert.equal(points.length, 18);
  const legacy = ['task','data','model','training','system','prediction','generation','alignment','collection','cleaning','evaluation-set','token','attention','transformer','loss','pretraining','finetuning','rag','deployment','monitoring'];
  for (const id of legacy) assert.ok(nodes.some((node) => node.id === id), id);
  for (const node of points) {
    const lesson = node.lesson;
    assert.ok(lesson.role && lesson.goal && lesson.explanation.length >= 2, node.id);
    assert.ok(lesson.example.input && lesson.example.steps.length >= 3 && lesson.example.output, node.id);
    assert.ok(lesson.confusions.length >= 2 && lesson.check.question && lesson.check.answer, node.id);
    for (const id of lesson.example.materials) assert.ok(teachingCase.materials.some((item) => item.id === id), `${node.id}:${id}`);
  }
  assert.match(teachingCase.notice, /非真实课程原文.*非模型实测结果/);
  assert.deepEqual(maps[0].learningPath, ['prediction','generation','alignment','collection','cleaning','evaluation-set','token','attention','transformer','pretraining','loss','finetuning','lora','retrieval','rag','inference','deployment','monitoring']);
  assert.equal(new Set(maps[0].learningPath).size, points.length);
});

test('domain concepts distinguish 12 core, 10 extended and 3 non-causal comparisons from 18 memberships', () => {
  const edges = buildEdges(maps[0]);
  const concepts = edges.filter((edge) => edge.kind === 'relation' && edge.targetMap === 'domain');
  assert.equal(edges.filter((edge) => edge.kind === 'hierarchy').length, 18);
  assert.equal(concepts.length, 22); assert.equal(concepts.filter((edge) => edge.core).length, 12);
  assert.equal(concepts.filter((edge) => !edge.core).length, 10);
  assert.deepEqual(concepts.filter((edge) => edge.direction === 'undirected').map((edge) => [edge.from,edge.to]), [['generation','alignment'],['rag','finetuning'],['loss','evaluation-set']]);
  for (const edge of concepts) assert.ok(edge.description && edge.sources.length && edge.basis && edge.verification === '待核实');
  assert.equal(edges.filter((edge) => edge.targetMap !== 'domain').length, 15);
  assert.ok(buildEdges(maps[1]).some((edge) => edge.from === 'research-origins' && edge.to === 'lora'));
  assert.ok(!edges.some((edge) => edge.from === 'finetuning' && edge.to === 'lora-authors'));
});

test('lesson examples are searchable, intersection still applies, and relation scope round trips', () => {
  const nodes = buildCatalog(maps[0]);
  assert.deepEqual(filterCatalog(nodes, { ...emptyFilters, q: '4×1' }).map((node) => node.id), ['lora']);
  assert.equal(filterCatalog(nodes, { ...emptyFilters, q: '4×1', type: '任务' }).length, 0);
  assert.deepEqual(readCatalogQuery(catalogQuery('graph', emptyFilters, 'all')), { view:'graph', filters:emptyFilters, relations:'all' });
  assert.equal(readCatalogQuery('?relations=unexpected').relations, 'core');
});

test('ecosystem has 5 themes, 15 complete lessons, 15 memberships and 10 independent legacy collections', () => {
  const map = maps[1], nodes = buildCatalog(map), points = nodes.filter((node) => node.parent), edges = buildEdges(map);
  assert.equal(map.branches.length, 5); assert.equal(nodes.length, 20); assert.equal(points.length, 15);
  assert.equal(edges.filter((edge) => edge.kind === 'hierarchy').length, 15);
  assert.equal(map.legacyCollections.length, 10);
  const old = ['participants','research-teams','model-teams','communities','platform-services','resources','publications','collaboration','costs','access'];
  for (const id of old) {
    const collection = resolveCatalogNode(map, nodes, id);
    assert.ok(collection.collection && collection.children.length && !nodes.some((node) => node.id === id));
    assert.equal(new Set(collection.children.map((node) => node.id)).size, collection.children.length);
    assert.ok(collection.children.every((node) => points.some((point) => point.id === node.id)));
  }
  assert.equal(new Set(map.learningPath).size, 15);
  assert.deepEqual(map.learningPath, map.branches.flatMap((stage) => stage.children.map((node) => node.id)));
  for (const node of points) {
    const lesson = node.lesson;
    assert.ok(node.sources.length);
    assert.ok(lesson.role && lesson.goal && lesson.explanation.length >= 2 && lesson.example.steps.length >= 3, node.id);
    assert.ok(lesson.example.input && lesson.example.output && lesson.confusions.length >= 2 && lesson.check.question && lesson.check.answer, node.id);
    assert.ok((node.records ?? []).every((record) => record.date && record.source && record.locator && record.text));
    assert.ok(edges.some((edge) => edge.kind === 'relation' && edge.targetMap === 'ecosystem' && (edge.from === node.id || edge.to === node.id)), node.id);
    assert.equal(node.understanding, '待自评'); assert.equal(node.verification, '待核实');
  }
});

test('ecosystem curation preserves the entire original map and maps every retired address to a current topic', () => {
  const map = maps[1], nodes = buildCatalog(map);
  const before = JSON.parse(readFileSync('../future-updates/ecosystem-2026-11-02/map-before.json', 'utf8'));
  const manifest = JSON.parse(readFileSync('../future-updates/ecosystem-2026-11-02/manifest.json', 'utf8'));
  const oldPoints = flattenNodes(before.branches).filter((node) => node.lesson);
  assert.equal(oldPoints.length, 47);
  assert.equal(manifest.nodes.length, 47);
  assert.equal(before.conceptRelations.length, 62);
  for (const node of flattenNodes(before.branches)) assert.ok(resolveCatalogNode(map, nodes, node.id), node.id);
  for (const [oldId, target] of Object.entries(map.nodeAliases)) {
    assert.ok(!nodes.some((node) => node.id === oldId));
    assert.equal(resolveCatalogNode(map, nodes, oldId).id, target);
    assert.ok(nodes.some((node) => node.id === target));
  }
  assert.equal(resolveCatalogNode(map, nodes, 'deepseek-team').id, 'stage-publish', 'do not relabel another team as Qwen');
  assert.ok(!JSON.stringify(map).includes('7390'));
  assert.ok(JSON.stringify(before).includes('7390'));
  assert.ok(nodes.find((node) => node.id === 'qwen').lesson.example.output.includes('历史'));
});

test('ecosystem overview is exactly 5 themes and 5 bounded handoffs; detail adds only direct neighbors', async () => {
  const { ecosystemGraphSlice } = await import('../src/lib/maps/ecosystem-graph.ts');
  const map = maps[1], nodes = buildCatalog(map), edges = buildEdges(map).filter((edge) => edge.kind === 'relation' && edge.targetMap === 'ecosystem');
  const overview = ecosystemGraphSlice(nodes, nodes, edges, '', null, 'core');
  assert.equal(overview.nodes.length, 5); assert.equal(overview.edges.length, 5);
  assert.equal(overview.nodes.every((node) => !node.parent), true);
  assert.equal(Math.max(...overview.nodes.map((node) => node.x + 220)) <= overview.width, true);
  const selected = ecosystemGraphSlice(nodes, nodes, edges, '', 'huggingface', 'core');
  assert.equal(selected.stage, 'stage-adapt');
  for (const edge of edges.filter((edge) => edge.from === 'huggingface' || edge.to === 'huggingface')) assert.ok(selected.edges.some((item) => item.id === edge.id));
  const nonmember = selected.nodes.filter((node) => node.parent !== 'stage-adapt' && node.id !== 'stage-adapt');
  assert.ok(nonmember.every((node) => edges.some((edge) => edge.from === 'huggingface' && edge.to === node.id || edge.to === 'huggingface' && edge.from === node.id)));
  assert.ok(edges.some((edge) => edge.from === 'inference-tools' && edge.to === 'api-platforms' && edge.direction === 'undirected'));
  assert.equal(ecosystemGraphSlice(nodes.filter((node) => node.id === 'huggingface'), nodes, edges, '', null, 'core').nodes.length, 1);
  const back = readCatalogQuery(catalogQuery('graph', { ...emptyFilters, q: '接口' }, 'all', 'stage-adapt'));
  assert.equal(back.stage, 'stage-adapt'); assert.equal(back.filters.q, '接口'); assert.equal(back.relations, 'all');
});

test('ecosystem search finds core responsibilities while historical metrics stay outside active results', () => {
  const nodes = buildCatalog(maps[1]), edges = buildEdges(maps[1]);
  assert.equal(filterCatalog(nodes, { ...emptyFilters, q: '7390' }, edges).length, 0);
  assert.ok(filterCatalog(nodes, { ...emptyFilters, q: 'OpenCompass' }, edges).some((node) => node.id === 'evaluation-tools'));
  assert.equal(filterCatalog(nodes, { ...emptyFilters, q: 'OpenCompass', type: '参与者' }, edges).length, 0);
  assert.equal(filterCatalog(nodes, { ...emptyFilters, q: '不存在的条目123456' }, edges).length, 0);
  assert.equal(filterCatalog(nodes, emptyFilters, edges).length, 20);
});

test('cognition keeps four themes with three direct points each and independent short summaries', () => {
  const map = maps[2], nodes = buildCatalog(map), points = nodes.filter((node) => node.parent);
  assert.equal(nodes.length, 16); assert.equal(points.length, 12);
  assert.deepEqual(map.branches.map((root) => root.children.map((node) => node.id)), [
    ['system-view','development-view','third-view'], ['loss-test','ranking-task','cost-api'],
    ['define-problem','small-trial','weekly-review'], ['revision-before','revision-evidence','revision-after'],
  ]);
  assert.deepEqual(map.learningPath, points.map((node) => node.id));
  for (const node of points) {
    const lesson = node.lesson;
    assert.equal(node.depth, 1); assert.ok(!node.children?.length);
    assert.ok(node.summary.length <= 55 && node.summary !== lesson.explanation[0], node.id);
    assert.ok(lesson.role && lesson.goal && lesson.explanation.length === 2, node.id);
    assert.ok(lesson.example.input && lesson.example.steps.length === 3 && lesson.example.output, node.id);
    assert.ok(lesson.check.question && lesson.check.answer && lesson.confusions.length === 2, node.id);
    assert.ok(node.sources.includes('L7') && node.sources.includes('L5'));
    assert.equal(node.understanding, '待自评'); assert.equal(node.verification, '待核实');
  }
  assert.match(nodes.find((node) => node.id === 'third-view').boundary, /正式名称.*核验/);
  assert.ok(nodes.find((node) => node.id === 'revision').records[0].text.includes('日期'));
  assert.ok(points.every((node) => !node.records), 'one historical account at the topic level');
});

test('cognition archive preserves every original lesson and retired address while reducing core text by at least half', () => {
  const map = maps[2], nodes = buildCatalog(map);
  const before = JSON.parse(readFileSync('../future-updates/cognition-2026-11-02/map-before.json', 'utf8'));
  const original = flattenNodes(before.branches).filter((node) => node.lesson);
  const current = nodes.filter((node) => node.lesson);
  const size = (items) => items.reduce((sum, node) => sum + JSON.stringify(node.lesson).length, 0);
  assert.equal(original.length, 19); assert.equal(Object.keys(map.nodeAliases).length, 7);
  assert.ok(size(current) <= size(original) * .5);
  for (const node of flattenNodes(before.branches)) assert.ok(resolveCatalogNode(map, nodes, node.id), node.id);
  for (const [oldId, targetId] of Object.entries(map.nodeAliases)) {
    assert.ok(!nodes.some((node) => node.id === oldId));
    assert.equal(resolveCatalogNode(map, nodes, oldId).id, targetId);
  }
  assert.equal(resolveCatalogNode(map, nodes, 'system-analysis').id, 'loss-test');
  assert.equal(resolveCatalogNode(map, nodes, 'independent-feedback').id, 'weekly-review');
});

test('cognition remaps relations without loops or parallel duplicates and preserves five feedback directions', () => {
  const map = maps[2], nodes = buildCatalog(map), edges = buildEdges(map);
  const local = edges.filter((edge) => edge.targetMap === 'cognition' && edge.kind !== 'hierarchy');
  assert.equal(local.length, 26); assert.equal(local.filter((edge) => edge.core).length, 16);
  assert.equal(edges.filter((edge) => edge.kind === 'hierarchy').length, 12);
  assert.equal(edges.filter((edge) => edge.targetMap !== 'cognition').length, 19);
  const key = (edge) => [edge.from, edge.targetMap, edge.to, edge.direction ?? 'directed'].join(':');
  assert.equal(new Set(edges.map(key)).size, edges.length);
  assert.ok(local.every((edge) => edge.from !== edge.to));
  assert.deepEqual(local.filter((edge) => edge.kind === 'feedback').map((edge) => [edge.from,edge.to,edge.label]), [
    ['perspectives','analysis-methods','指导选方法'], ['loss-test','revision','跑过后修正'], ['ranking-task','revision','跑过后修正'], ['cost-api','revision','跑过后修正'], ['revision','habits','反哺习惯'],
  ]);
  for (const node of nodes.filter((node) => node.parent)) assert.ok(local.some((edge) => edge.from === node.id || edge.to === node.id), node.id);
  for (const edge of local) assert.ok(edge.description && edge.sources.length && edge.category && edge.basis);
  const before = JSON.parse(readFileSync('../future-updates/cognition-2026-11-02/map-before.json', 'utf8'));
  const resolve = (id) => map.nodeAliases[id] ?? id;
  for (const old of [...before.connections, ...before.conceptRelations]) {
    if (resolve(old.from) === resolve(old.to)) continue;
    const merged = local.find((edge) => edge.from === resolve(old.from) && edge.to === resolve(old.to) && (edge.direction ?? 'directed') === (old.direction ?? 'directed'));
    assert.ok(merged, `${old.from} → ${old.to}`);
    for (const source of old.sources ?? []) assert.ok(merged.sources.includes(source), `${old.from} → ${old.to}: ${source}`);
  }
});

test('cognition graph keeps four theme columns, direct cases and filtered neighbors', async () => {
  const { cognitionLearningGraph } = await import('../src/lib/maps/cognition-learning-graph.ts');
  const map = maps[2], nodes = buildCatalog(map), edges = buildEdges(map).filter((edge) => edge.targetMap === 'cognition' && edge.kind !== 'hierarchy');
  const core = cognitionLearningGraph(nodes, nodes, edges, null, 'core'), all = cognitionLearningGraph(nodes, nodes, edges, null, 'all');
  assert.equal(core.nodes.length, 16); assert.equal(core.edges.length, 16); assert.equal(all.edges.length, 26);
  assert.equal(new Set(core.nodes.filter((node) => !node.parent).map((node) => node.x)).size, 4);
  assert.ok(core.width <= 1120);
  const filtered = cognitionLearningGraph(nodes.filter((node) => node.id === 'loss-test'), nodes, edges, 'loss-test', 'core');
  for (const edge of edges.filter((edge) => edge.from === 'loss-test' || edge.to === 'loss-test')) assert.ok(filtered.edges.some((item) => item.id === edge.id));
  assert.ok(filtered.nodes.some((node) => node.id === 'ranking-task'));
  assert.ok(filtered.edges.some((edge) => edge.direction === 'undirected'));
  assert.ok(filtered.nodes.some((node) => node.id === 'analysis-methods'));
  assert.ok(!filtered.nodes.some((node) => node.id === 'system-analysis'));
  assert.equal(cognitionLearningGraph([], nodes, edges, null, 'core').nodes.length, 0);
});

test('cognition search indexes concise lessons and keeps historical personal accounts at the topic only', () => {
  const nodes = buildCatalog(maps[2]), edges = buildEdges(maps[2]);
  assert.deepEqual(filterCatalog(nodes, { ...emptyFilters, q: '课件第11、28页' }, edges).map((node) => node.id), []);
  assert.deepEqual(filterCatalog(nodes, { ...emptyFilters, q: '原材料自述曾将认知地图理解为空间认知' }, edges).map((node) => node.id), ['revision']);
  assert.equal(filterCatalog(nodes, { ...emptyFilters, q: '原材料自述曾将认知地图理解为空间认知', type: '认识视角' }, edges).length, 0);
  assert.ok(filterCatalog(nodes, { ...emptyFilters, q: '课堂正式名称' }, edges).some((node) => node.id === 'third-view'));
  assert.ok(filterCatalog(nodes, { ...emptyFilters, q: '训练与测试题只是换了措辞' }, edges).some((node) => node.id === 'loss-test'));
});

test('maintainer status is isolated by map and node and feeds reading and filters', () => {
  const overrides = { 'domain:lora': '已经尝试', 'cognition:loss-test': '已初步理解', 'ecosystem:token': '已经尝试' };
  const domain = buildCatalog(maps[0], { 'K-RAG': '资料整理 · 待深入学习' }, overrides);
  assert.equal(resolveCatalogNode(maps[0], domain, 'lora').understanding, '已经尝试');
  assert.equal(domain.find((node) => node.id === 'lora').verification, '待核实');
  assert.equal(domain.find((node) => node.id === 'token').understanding, '待自评');
  assert.deepEqual(filterCatalog(domain, { ...emptyFilters, understanding: '已经尝试' }).map((node) => node.id), ['lora']);
  const cognition = buildCatalog(maps[2], {}, overrides);
  assert.equal(resolveCatalogNode(maps[2], cognition, 'system-analysis').understanding, '已初步理解');
});
