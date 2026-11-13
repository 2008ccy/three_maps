import { buildCatalog, buildEdges, resolveCatalogNode, type CatalogNode, type MapEdge } from './catalog.ts';
import type { MapDefinition, MapKey } from './types';

export type NodeRef = { mapId: MapKey; nodeId: string };
export const nodeKey = (ref: NodeRef) => `${ref.mapId}:${ref.nodeId}`;
export type AtlasEdge = MapEdge & { sourceMap: MapKey };
export function buildAtlas(maps: MapDefinition[], statuses: Record<string, string> = {}, overrides: Record<string, string> = {}) {
  const catalogs = new Map(maps.map(map => [map.id, buildCatalog(map, statuses, overrides)]));
  const byId = new Map([...catalogs.values()].flat().map(node => [nodeKey({ mapId: node.mapId, nodeId: node.id }), node]));
  const edges: AtlasEdge[] = maps.flatMap(map => buildEdges(map).map(edge => ({ ...edge, sourceMap: map.id,
    from: nodeKey({ mapId: map.id, nodeId: edge.from }), to: nodeKey({ mapId: edge.targetMap, nodeId: edge.to }),
  })));
  return { maps, catalogs, byId, edges };
}
export type Atlas = ReturnType<typeof buildAtlas>;
export function resolveRef(atlas: Atlas, ref: NodeRef | null) {
  if (!ref) return;
  const map = atlas.maps.find(map => map.id === ref.mapId);
  return map && resolveCatalogNode(map, atlas.catalogs.get(map.id)!, ref.nodeId);
}
export type GraphNode = { key: string; kind: 'map' | 'theme' | 'point' | 'external'; node?: CatalogNode; group: string; count?: number };
export type GraphLine = { id: string; from: string; to: string; kind: 'hierarchy' | 'local' | 'cross'; edges: AtlasEdge[]; arrow: 'forward' | 'both' | 'none' };

export function buildExpandedGraph(atlas: Atlas, map: MapDefinition, matches: CatalogNode[], expanded: string[], scope: 'core' | 'all', selected: NodeRef | null) {
  const hub = `${map.id}:@map`;
  const catalog = atlas.catalogs.get(map.id)!;
  const matched = new Set(matches.map(node => node.id));
  const selectedNode = resolveRef(atlas, selected);
  if (selectedNode?.mapId === map.id && !selectedNode.collection) matched.add(selectedNode.id);
  const groups = new Set(catalog.filter(node => matched.has(node.id)).map(node => node.groupId));
  const open = new Set(expanded);
  const themes = catalog.filter(node => !node.parent && groups.has(node.id));
  const nodes: GraphNode[] = [{ key: hub, kind: 'map', group: '' }];
  const lines: GraphLine[] = [];
  const membership = (from: string, to: string) => lines.push({ id: `membership:${from}:${to}`, from, to, kind: 'hierarchy', edges: [], arrow: 'none' });
  for (const theme of themes) {
    const key = `${map.id}:${theme.id}`;
    nodes.push({ key, node: theme, kind: 'theme', group: theme.id, count: catalog.filter(node => node.parent === theme.id).length });
    membership(hub, key);
    if (open.has(theme.id)) for (const child of catalog.filter(node => node.parent === theme.id && matched.has(node.id))) {
      const childKey = `${map.id}:${child.id}`;
      nodes.push({ key: childKey, node: child, kind: 'point', group: theme.id });
      membership(key, childKey);
    }
  }
  const visible = new Set(nodes.map(node => node.key));
  const endpoint = (key: string) => {
    const node = atlas.byId.get(key);
    if (!node || node.mapId !== map.id || !matched.has(node.id) && node.parent) return;
    return visible.has(key) ? key : groups.has(node.groupId) ? `${map.id}:${node.groupId}` : undefined;
  };
  const bundles = new Map<string, GraphLine>();
  const owners = new Map<string, string[]>();
  for (const edge of atlas.edges) {
    if (edge.kind === 'hierarchy') continue;
    const cross = edge.sourceMap !== edge.targetMap;
    if (!cross && (edge.sourceMap !== map.id || scope === 'core' && !edge.core)) continue;
    if (cross && edge.sourceMap !== map.id && edge.targetMap !== map.id) continue;
    let from: string | undefined, to: string | undefined;
    if (cross) {
      const localKey = edge.sourceMap === map.id ? edge.from : edge.to;
      const externalKey = edge.sourceMap === map.id ? edge.to : edge.from;
      const local = atlas.byId.get(localKey), external = atlas.byId.get(externalKey);
      if (!local || !external || !open.has(local.groupId) || !visible.has(localKey)) continue;
      from = edge.from; to = edge.to;
      owners.set(externalKey, [...owners.get(externalKey) ?? [], local.groupId]);
    } else { from = endpoint(edge.from); to = endpoint(edge.to); }
    if (!from || !to || from === to) continue;
    const key = JSON.stringify([from, to].sort());
    const line = bundles.get(key) ?? { id: key, from, to, kind: cross ? 'cross' : 'local', edges: [], arrow: 'none' };
    line.edges.push(edge); bundles.set(key, line);
  }
  for (const [key, values] of owners) {
    const group = map.branches.map(branch => branch.id).sort((a, b) => values.filter(v => v === b).length - values.filter(v => v === a).length)[0];
    nodes.push({ key, node: atlas.byId.get(key)!, kind: 'external', group });
  }
  for (const line of bundles.values()) {
    if (line.edges.every(edge => edge.direction !== 'undirected')) {
      const starts = line.edges.map(edge => line.kind === 'cross' ? edge.from : endpoint(edge.from));
      line.arrow = starts.every(key => key === line.from) ? 'forward' : 'both';
    }
    lines.push(line);
  }
  return { hub, nodes, lines, themes, expanded, byId: atlas.byId, relations: [...bundles.values()].flatMap(line => line.edges), map };
}
export type ExpandedGraph = ReturnType<typeof buildExpandedGraph>;
