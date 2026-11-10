import type { CatalogNode, MapEdge } from './catalog';

export const mapHubId = '@map';

export type RelationLine = {
  from: string;
  to: string;
  edges: MapEdge[];
  arrow: 'forward' | 'both' | 'none';
};

export function buildRadialGraph(matches: CatalogNode[], allNodes: CatalogNode[], edges: MapEdge[], focusId: string, scope: 'core' | 'all') {
  const byId = new Map(allNodes.map(node => [node.id, node]));
  const focus = byId.get(focusId);
  const hub = focus?.id ?? mapHubId;
  const matchedIds = new Set(matches.map(node => node.id));
  const groups = new Set(matches.map(node => node.groupId));
  const themes = allNodes.filter(node => !node.parent && groups.has(node.id));
  const local = edges.filter(edge => edge.kind !== 'hierarchy' && edge.targetMap === allNodes[0]?.mapId && byId.has(edge.from) && byId.has(edge.to));

  let satellites: CatalogNode[];
  let eligible: MapEdge[];
  if (focus?.parent) {
    eligible = local.filter(edge => edge.from === hub || edge.to === hub);
    const neighbors = new Set(eligible.flatMap(edge => [edge.from, edge.to]));
    satellites = allNodes.filter(node => node.id !== hub && neighbors.has(node.id));
  } else if (focus) {
    satellites = matches.filter(node => node.parent === hub);
    const ids = new Set([hub, ...satellites.map(node => node.id)]);
    eligible = local.filter(edge => ids.has(edge.from) && ids.has(edge.to));
  } else {
    satellites = themes;
    themes.forEach(node => matchedIds.add(node.id));
    eligible = local.filter(edge => matchedIds.has(edge.from) && matchedIds.has(edge.to) && byId.get(edge.from)!.groupId !== byId.get(edge.to)!.groupId);
  }

  const displayed = eligible.filter(edge => scope === 'all' || focus?.parent || edge.core);
  const endpoint = (id: string) => focus ? id : byId.get(id)!.groupId;
  const bundles = new Map<string, RelationLine>();
  for (const edge of displayed) {
    const from = endpoint(edge.from), to = endpoint(edge.to);
    const key = JSON.stringify([from, to].sort());
    const line = bundles.get(key) ?? { from, to, edges: [], arrow: 'none' };
    line.edges.push(edge);
    bundles.set(key, line);
  }
  for (const line of bundles.values()) {
    // Preserve both directions in a bundle. A mix of directed and comparison
    // edges uses a neutral line; its detail list shows each original direction.
    if (line.edges.some(edge => edge.direction === 'undirected')) continue;
    line.arrow = line.edges.every(edge => endpoint(edge.from) === line.from) ? 'forward' : 'both';
  }
  const memberCounts = new Map(themes.map(theme => [theme.id, matches.filter(node => node.parent === theme.id).length]));
  return { hub, focus, satellites, themes, displayed, lines: [...bundles.values()], byId, memberCounts };
}

export type RadialGraphModel = ReturnType<typeof buildRadialGraph>;
