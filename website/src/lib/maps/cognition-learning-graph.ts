import type { CatalogNode, MapEdge } from './catalog';

export function cognitionLearningGraph(nodes: CatalogNode[], allNodes: CatalogNode[], edges: MapEdge[], selected: string | null, scope: 'core' | 'all') {
  const ids = new Set(nodes.map((node) => node.id));
  if (selected) {
    ids.add(selected);
    for (const edge of edges.filter((edge) => edge.from === selected || edge.to === selected)) {
      ids.add(edge.from); ids.add(edge.to);
    }
  }
  for (const id of [...ids]) {
    let node = allNodes.find((item) => item.id === id);
    while (node?.parent) { ids.add(node.parent); node = allNodes.find((item) => item.id === node!.parent); }
  }
  const roots = allNodes.filter((node) => !node.parent && ids.has(node.id));
  const positioned = roots.flatMap((root, column) => {
    const members = allNodes.filter((node) => node.parent && node.groupId === root.id);
    return [{ ...root, x: 24 + column * 268, y: 20 }, ...members.flatMap((node, index) => ids.has(node.id) ? [{ ...node, x: 24 + column * 268, y: 112 + index * 94 }] : [])];
  });
  const eligible = edges.filter((edge) => edge.targetMap === 'cognition' && edge.kind !== 'hierarchy' && ids.has(edge.from) && ids.has(edge.to));
  const displayed = eligible.filter((edge) => scope === 'all' || edge.core || edge.from === selected || edge.to === selected);
  return { nodes: positioned, edges: displayed, width: Math.max(1, roots.length) * 268 + 24, height: Math.max(660, ...positioned.map((node) => node.y + 110)) };
}
