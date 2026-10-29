import test from 'node:test';
import assert from 'node:assert/strict';
import { maps, flattenNodes } from '../src/lib/maps/content.ts';
import { buildCatalog, buildEdges, resolveCatalogNode, filterCatalog, emptyFilters, catalogQuery, readCatalogQuery } from '../src/lib/maps/catalog.ts';

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

test('topic overview collapses the three maps to 5, 7 and 4 groups without losing members', async () => {
  const { groupCatalog, catalogChildren } = await import('../src/lib/maps/catalog.ts');
  for (const [index, map] of maps.entries()) {
    const nodes = buildCatalog(map), groups = groupCatalog(nodes, nodes);
    assert.equal(groups.length, [5, 7, 4][index]);
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
  assert.ok(resolveCatalogNode(maps[1], ecosystem, 'participants').children.some((node) => node.id === 'lora-authors'));
  assert.ok(catalogChildren(ecosystem, 'stage-adapt').some((node) => node.id === 'lora-authors'));
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
  assert.ok(buildEdges(maps[1]).some((edge) => edge.from === 'lora-authors' && edge.to === 'lora'));
  assert.ok(!edges.some((edge) => edge.from === 'finetuning' && edge.to === 'lora-authors'));
});

test('lesson examples are searchable, intersection still applies, and relation scope round trips', () => {
  const nodes = buildCatalog(maps[0]);
  assert.deepEqual(filterCatalog(nodes, { ...emptyFilters, q: '4×1' }).map((node) => node.id), ['lora']);
  assert.equal(filterCatalog(nodes, { ...emptyFilters, q: '4×1', type: '任务' }).length, 0);
  assert.deepEqual(readCatalogQuery(catalogQuery('graph', emptyFilters, 'all')), { view:'graph', filters:emptyFilters, relations:'all' });
  assert.equal(readCatalogQuery('?relations=unexpected').relations, 'core');
});

test('ecosystem has 7 stages, 47 complete lessons, 47 memberships and 10 independent legacy collections', () => {
  const map = maps[1], nodes = buildCatalog(map), points = nodes.filter((node) => node.parent), edges = buildEdges(map);
  assert.equal(map.branches.length, 7); assert.equal(nodes.length, 54); assert.equal(points.length, 47);
  assert.equal(edges.filter((edge) => edge.kind === 'hierarchy').length, 47);
  assert.equal(map.legacyCollections.length, 10);
  const old = ['participants','research-teams','model-teams','communities','platform-services','resources','publications','collaboration','costs','access'];
  for (const id of old) {
    const collection = resolveCatalogNode(map, nodes, id);
    assert.ok(collection.collection && collection.children.length && !nodes.some((node) => node.id === id));
    assert.equal(new Set(collection.children.map((node) => node.id)).size, collection.children.length);
    assert.ok(collection.children.every((node) => points.some((point) => point.id === node.id)));
  }
  assert.equal(new Set(map.learningPath).size, 47);
  assert.deepEqual(map.learningPath, map.branches.flatMap((stage) => stage.children.map((node) => node.id)));
  for (const node of points) {
    const lesson = node.lesson;
    assert.ok(node.boundary && node.sources.includes('L8'));
    assert.ok(lesson.role && lesson.goal && lesson.explanation.length >= 2 && lesson.example.steps.length >= 3, node.id);
    assert.ok(lesson.example.input && lesson.example.output && lesson.confusions.length >= 2 && lesson.check.question && lesson.check.answer, node.id);
    assert.ok(node.records.every((record) => record.date && record.source && record.locator && record.text));
    assert.ok(edges.some((edge) => edge.kind === 'relation' && edge.targetMap === 'ecosystem' && (edge.from === node.id || edge.to === node.id)), node.id);
    assert.equal(node.understanding, '待自评'); assert.equal(node.verification, '待核实');
  }
});

test('five ecosystem teams use equal profile fields and do not infer tool support or task ranking', () => {
  const teams = buildCatalog(maps[1]).filter((node) => node.teamProfile);
  assert.deepEqual(teams.map((node) => node.id), ['qwen','deepseek-team','llama-team','glm-team','kimi-team']);
  for (const node of teams) {
    const profile = node.teamProfile;
    for (const key of ['series','release','reusable','dependencies','limits','missingEvidence']) assert.ok(profile[key]);
    assert.ok(profile.official.length && profile.official.every((link) => link.title && /^https:\/\//.test(link.href)));
    assert.ok(profile.release.includes('历史'));
    assert.equal(node.verification, '待核实');
  }
});

test('ecosystem overview is exactly 7 stages and 8 bounded handoffs; detail adds only direct neighbors', async () => {
  const { ecosystemGraphSlice } = await import('../src/lib/maps/ecosystem-graph.ts');
  const map = maps[1], nodes = buildCatalog(map), edges = buildEdges(map).filter((edge) => edge.kind === 'relation' && edge.targetMap === 'ecosystem');
  const overview = ecosystemGraphSlice(nodes, nodes, edges, '', null, 'core');
  assert.equal(overview.nodes.length, 7); assert.equal(overview.edges.length, 8);
  assert.equal(overview.nodes.every((node) => !node.parent), true);
  assert.equal(Math.max(...overview.nodes.map((node) => node.x + 220)) <= overview.width, true);
  const selected = ecosystemGraphSlice(nodes, nodes, edges, '', 'peft', 'core');
  assert.equal(selected.stage, 'stage-adapt');
  for (const edge of edges.filter((edge) => edge.from === 'peft' || edge.to === 'peft')) assert.ok(selected.edges.some((item) => item.id === edge.id));
  const nonmember = selected.nodes.filter((node) => node.parent !== 'stage-adapt' && node.id !== 'stage-adapt');
  assert.ok(nonmember.every((node) => edges.some((edge) => edge.from === 'peft' && edge.to === node.id || edge.to === 'peft' && edge.from === node.id)));
  assert.ok(selected.edges.filter((edge) => edge.direction === 'undirected').length);
  assert.equal(ecosystemGraphSlice(nodes.filter((node) => node.id === 'peft'), nodes, edges, '', null, 'core').nodes.length, 1);
  const back = readCatalogQuery(catalogQuery('graph', { ...emptyFilters, q: '接口' }, 'all', 'stage-adapt'));
  assert.equal(back.stage, 'stage-adapt'); assert.equal(back.filters.q, '接口'); assert.equal(back.relations, 'all');
});

test('ecosystem search covers historical records and relation explanations with filter intersection', () => {
  const nodes = buildCatalog(maps[1]), edges = buildEdges(maps[1]);
  assert.ok(filterCatalog(nodes, { ...emptyFilters, q: '7390' }, edges).some((node) => node.id === 'glm-team'));
  assert.ok(filterCatalog(nodes, { ...emptyFilters, q: '不能扩展为 EleutherAI' }, edges).some((node) => node.id === 'eleuther'));
  assert.equal(filterCatalog(nodes, { ...emptyFilters, q: '7390', type: '工具' }, edges).length, 0);
  assert.equal(filterCatalog(nodes, { ...emptyFilters, q: '不存在的条目123456' }, edges).length, 0);
  assert.equal(filterCatalog(nodes, emptyFilters, edges).length, 54);
});

test('cognition fills all 19 original points and method groups without changing their addresses or hierarchy', async () => {
  const { cognitionOriginal } = await import('../src/lib/maps/cognition-base.ts');
  const map = maps[2], nodes = buildCatalog(map), points = nodes.filter((node) => node.parent);
  assert.equal(map.branches.length, 4); assert.equal(nodes.length, 23); assert.equal(points.length, 19);
  assert.deepEqual(nodes.map((node) => [node.id, node.parent]), buildCatalog(cognitionOriginal).map((node) => [node.id, node.parent]));
  assert.equal(new Set(map.learningPath).size, 19);
  assert.deepEqual(map.learningPath, points.map((node) => node.id));
  for (const node of points) {
    const lesson = node.lesson;
    assert.ok(lesson.role && lesson.goal && lesson.explanation.length >= 2, node.id);
    assert.ok(lesson.example.input && lesson.example.steps.length >= 3 && lesson.example.output, node.id);
    assert.ok(lesson.confusions.length >= 2 && lesson.check.question && lesson.check.answer, node.id);
    assert.ok(node.boundary && node.sources.includes('L7') && node.sources.includes('L5'));
    assert.equal(node.understanding, '待自评'); assert.equal(node.verification, '待核实');
  }
  assert.match(nodes.find((node) => node.id === 'third-view').boundary, /正式名称.*核验/);
  assert.ok(nodes.find((node) => node.id === 'revision-before').records[0].text.includes('日期'));
});

test('cognition separates 32 teaching and feedback relations from 19 memberships, preserving all five original directions', () => {
  const map = maps[2], nodes = buildCatalog(map), edges = buildEdges(map);
  const local = edges.filter((edge) => edge.targetMap === 'cognition' && edge.kind !== 'hierarchy');
  assert.equal(local.length, 32); assert.equal(local.filter((edge) => edge.core).length, 21);
  assert.equal(edges.filter((edge) => edge.kind === 'hierarchy').length, 19);
  assert.equal(edges.filter((edge) => edge.targetMap !== 'cognition').length, 20);
  assert.deepEqual(local.filter((edge) => edge.kind === 'feedback').map((edge) => [edge.from, edge.to, edge.label]), [
    ['perspectives','analysis-methods','指导选方法'], ['loss-test','revision','跑过后修正'], ['ranking-task','revision','跑过后修正'], ['cost-api','revision','跑过后修正'], ['revision','habits','反哺习惯'],
  ]);
  assert.equal(local.filter((edge) => edge.direction === 'undirected').length, 2);
  for (const edge of local) assert.ok(edge.description && edge.sources.length && edge.basis && edge.category && edge.direction, edge.id);
  for (const node of nodes.filter((node) => node.parent)) assert.ok(local.some((edge) => edge.from === node.id || edge.to === node.id), node.id);
});

test('cognition graph retains normal-size grouped nodes, comparisons and selected neighbors outside filters', async () => {
  const { cognitionLearningGraph } = await import('../src/lib/maps/cognition-learning-graph.ts');
  const map = maps[2], nodes = buildCatalog(map), edges = buildEdges(map).filter((edge) => edge.targetMap === 'cognition' && edge.kind !== 'hierarchy');
  const core = cognitionLearningGraph(nodes, nodes, edges, null, 'core'), all = cognitionLearningGraph(nodes, nodes, edges, null, 'all');
  assert.equal(core.nodes.length, 23); assert.equal(core.edges.length, 21); assert.equal(all.edges.length, 32);
  assert.equal(new Set(core.nodes.filter((node) => !node.parent).map((node) => node.x)).size, 4);
  assert.ok(core.width <= 1120);
  const filtered = cognitionLearningGraph(nodes.filter((node) => node.id === 'loss-test'), nodes, edges, 'loss-test', 'core');
  const direct = edges.filter((edge) => edge.from === 'loss-test' || edge.to === 'loss-test');
  for (const edge of direct) assert.ok(filtered.edges.some((item) => item.id === edge.id));
  assert.ok(filtered.nodes.some((node) => node.id === 'ranking-task'));
  assert.ok(filtered.edges.some((edge) => edge.direction === 'undirected'));
  assert.ok(filtered.nodes.some((node) => node.id === 'system-analysis'), 'original method ancestor remains visible');
  assert.equal(cognitionLearningGraph([], nodes, edges, null, 'core').nodes.length, 0);
});

test('cognition search includes manual examples, relation boundaries and historical records with intersection', () => {
  const nodes = buildCatalog(maps[2]), edges = buildEdges(maps[2]);
  assert.deepEqual(filterCatalog(nodes, { ...emptyFilters, q: '不把它改成已经核实的成员经历' }, edges).map((node) => node.id), ['revision-before']);
  assert.equal(filterCatalog(nodes, { ...emptyFilters, q: '不把它改成已经核实的成员经历', type: '认识视角' }, edges).length, 0);
  assert.ok(filterCatalog(nodes, { ...emptyFilters, q: '课堂正式名称仍待课件核验' }, edges).some((node) => node.id === 'third-view'));
  assert.ok(filterCatalog(nodes, { ...emptyFilters, q: '经历、日期、原课件' }, edges).some((node) => node.id === 'revision-evidence'));
  assert.ok(filterCatalog(nodes, { ...emptyFilters, q: '少量成功不能证明所有课程问题有效' }, edges).some((node) => node.id === 'loss-test'));
});
