import type { MapDefinition, MapKey, MapNode, ConceptRelation } from './types';

export const understandingOptions = ['待自评', '已初步理解', '已经尝试', '待深入学习'] as const;
export const verificationOptions = ['待核实', '已核实'] as const;
export type CatalogNode = MapNode & {
  type: string; understanding: NonNullable<MapNode['understanding']>; verification: NonNullable<MapNode['verification']>;
  group: string; groupId: string; path: string[]; parent: string | null; depth: number;
  mapId: MapKey; collection?: boolean;
};
export type MapEdge = {
  id: string; from: string; to: string; targetMap: MapKey; label: string;
  kind: 'hierarchy' | 'relation' | 'feedback'; sources: string[]; verification: '待核实' | '已核实';
  description?: string; core?: boolean; direction?: ConceptRelation['direction']; basis?: ConceptRelation['basis'];
  category?: ConceptRelation['category'];
};
export type CatalogFilters = { type: string; understanding: string; verification: string; q: string };
export const emptyFilters: CatalogFilters = { type: '', understanding: '', verification: '', q: '' };
const types: Record<MapKey, Record<string, string>> = {
  domain: { task: '任务', data: '数据与评测', model: '概念与原理', training: '训练方法', system: '系统实践' },
  ecosystem: { participants: '参与者', resources: '成果与资源', publications: '信息入口', collaboration: '协作环节', costs: '资源与成本', access: '规则与访问' },
  cognition: { perspectives: '认识视角', 'analysis-methods': '分析方法', habits: '成长习惯', revision: '认识修正' },
};

// 不从“附有来源”推断已核实，也不从学习建议推断成员已经尝试。
export function buildCatalog(map: MapDefinition, statuses: Record<string, string> = {}): CatalogNode[] {
  const result: CatalogNode[] = [];
  function visit(node: MapNode, root: MapNode, ancestors: MapNode[]) {
    const status = statuses[node.documents[0]?.id] ?? '';
    const explicitUnderstanding = understandingOptions.find((value) => status.split(/[·，；]/).some((part) => part.trim() === value));
    const explicitVerification = verificationOptions.find((value) => status.split(/[·，；]/).some((part) => part.trim() === value));
    result.push({ ...node, mapId: map.id,
      type: node.type ?? (ancestors.length === 0 ? '主题' : map.id === 'cognition' && ['loss-test', 'ranking-task', 'cost-api'].includes(node.id) ? '分析案例' : types[map.id][root.id] ?? '知识条目'),
      understanding: node.understanding ?? explicitUnderstanding ?? '待自评',
      verification: node.verification ?? explicitVerification ?? '待核实',
      group: root.title, groupId: root.id, path: ancestors.map((item) => item.title), parent: ancestors.at(-1)?.id ?? null, depth: ancestors.length,
    });
    node.children?.forEach((child) => visit(child, root, [...ancestors, node]));
  }
  map.branches.forEach((node) => visit(node, node, []));
  return result;
}

// Compatibility collections are addressable, but never enter the active catalog
// or its membership/statistics/graph edges.
export function resolveCatalogNode(map: MapDefinition, nodes: CatalogNode[], id: string): CatalogNode | undefined {
  const active = nodes.find((node) => node.id === id); if (active) return active;
  const legacy = map.legacyCollections?.find((item) => item.id === id); if (!legacy) return;
  const members = legacy.members.map((member) => nodes.find((node) => node.id === member)).filter((node): node is CatalogNode => !!node);
  return { id: legacy.id, title: legacy.title, summary: legacy.summary, detail: '旧分类专题：条目已按七个协作环节重新组织。此入口保留原分类与分享地址，不计入主题、知识点或关系统计。',
    sources: legacy.sources, documents: legacy.documents, children: members, type: '旧分类专题', understanding: '待自评', verification: '待核实',
    mapId: map.id, collection: true, group: members[0]?.group ?? '', groupId: members[0]?.groupId ?? '', path: [], parent: null, depth: 0,
  };
}

export function buildEdges(map: MapDefinition): MapEdge[] {
  const nodes = buildCatalog(map);
  const edges: MapEdge[] = [];
  const add = (edge: Omit<MapEdge, 'id'>) => {
    const id = `${map.id}:${edge.from}:${edge.targetMap}:${edge.to}:${edge.label}`;
    const existing = edges.find((item) => item.id === id);
    // 认知反馈在 connections 与 relations 中都有记录，只计算一次，保留反馈语义。
    if (existing) { if (edge.kind === 'feedback') existing.kind = 'feedback'; return; }
    edges.push({ ...edge, id });
  };
  for (const node of nodes) {
    if (node.parent) add({ from: node.parent, to: node.id, targetMap: map.id, label: '包含', kind: 'hierarchy', sources: node.sources, verification: '待核实' });
    for (const rel of node.relations ?? []) add({ from: node.id, to: rel.node, targetMap: rel.map, label: rel.label, kind: 'relation', sources: node.sources, verification: '待核实' });
  }
  for (const edge of map.connections ?? []) add({ ...edge, targetMap: map.id, kind: 'feedback', sources: nodes.find((node) => node.id === edge.from)?.sources ?? [], verification: '待核实' });
  for (const edge of map.conceptRelations ?? []) add({ ...edge, targetMap: map.id, kind: 'relation', verification: '待核实' });
  return edges;
}

export function filterCatalog(nodes: CatalogNode[], filters: CatalogFilters, edges: MapEdge[] = []) {
  const query = filters.q.trim().toLocaleLowerCase();
  return nodes.filter((node) => (!filters.type || node.type === filters.type) && (!filters.understanding || node.understanding === filters.understanding) && (!filters.verification || node.verification === filters.verification) && (!query || `${node.title} ${node.summary} ${node.detail} 学习状态：${node.understanding} 核实状态：${node.verification} ${node.lesson ? JSON.stringify(node.lesson) : ''} ${node.topic ? JSON.stringify(node.topic) : ''} ${JSON.stringify(node.records ?? [])} ${JSON.stringify(node.teamProfile ?? {})} ${edges.filter((edge) => edge.from === node.id || edge.targetMap === node.mapId && edge.to === node.id).map((edge) => edge.label + ' ' + (edge.description ?? '')).join(' ')}`.toLocaleLowerCase().includes(query)));
}

// 总览只展示一级主题；搜索命中深层条目时仍保留它所属的主题。
export function groupCatalog(nodes: CatalogNode[], matches: CatalogNode[]) {
  const matchedGroups = new Set(matches.map((node) => node.groupId));
  return nodes.filter((node) => node.parent === null && matchedGroups.has(node.id)).map((root) => ({
    root,
    members: nodes.filter((node) => node.groupId === root.id && node.id !== root.id),
    matches: matches.filter((node) => node.groupId === root.id),
  }));
}

export function catalogChildren(nodes: CatalogNode[], id: string) {
  return nodes.filter((node) => node.parent === id);
}

export function readCatalogQuery(search: string) {
  const query = new URLSearchParams(search);
  return { view: query.get('view') === 'graph' ? 'graph' as const : 'cards' as const,
    relations: query.get('relations') === 'all' ? 'all' as const : 'core' as const,
    filters: { type: query.get('type') ?? '', understanding: query.get('understanding') ?? '', verification: query.get('verification') ?? '', q: query.get('q') ?? '' }, ...(query.get('stage') ? { stage: query.get('stage')! } : {}) };
}

export function catalogQuery(view: 'cards' | 'graph', filters: CatalogFilters, relations: 'core' | 'all' = 'core', stage = '') {
  const query = new URLSearchParams();
  if (view === 'graph') query.set('view', view);
  if (relations === 'all') query.set('relations', 'all');
  if (view === 'graph' && stage) query.set('stage', stage);
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
  return query.size ? `?${query}` : '';
}
