import type { CatalogNode, MapEdge } from './catalog';

export function ecosystemGraphSlice(nodes: CatalogNode[], allNodes: CatalogNode[], edges: MapEdge[], stage: string, selected: string | null, scope: 'core' | 'all') {
  const stages = allNodes.filter((node) => !node.parent);
  const selectedNode = allNodes.find((node) => node.id === selected);
  const activeStage = selectedNode?.parent ? selectedNode.groupId : stages.some((node) => node.id === stage) ? stage : '';
  let ids: Set<string>;
  if (!activeStage) ids = new Set(stages.filter((root) => nodes.some((node) => node.groupId === root.id)).map((node) => node.id));
  else {
    ids = new Set([activeStage, ...nodes.filter((node) => node.parent === activeStage).map((node) => node.id)]);
    if (selectedNode?.parent) {
      ids.add(selectedNode.id);
      for (const edge of edges.filter((edge) => edge.targetMap === 'ecosystem' && (edge.from === selected || edge.to === selected))) { ids.add(edge.from); ids.add(edge.to); }
    }
  }
  const shown = allNodes.filter((node) => ids.has(node.id));
  const eligible = edges.filter((edge) => edge.targetMap === 'ecosystem' && edge.kind === 'relation' && ids.has(edge.from) && ids.has(edge.to));
  const displayed = eligible.filter((edge) => scope === 'all' || edge.core || edge.from === selected || edge.to === selected);
  const coordinates = [[24, 64], [292, 64], [560, 64], [828, 64], [828, 310], [560, 310], [292, 310]];
  let positioned: (CatalogNode & { x: number; y: number })[];
  if (!activeStage) positioned = shown.map((node) => { const index = stages.findIndex((root) => root.id === node.id), [x, y] = coordinates[index]; return { ...node, x, y }; });
  else {
    const root = shown.find((node) => node.id === activeStage)!;
    const members = shown.filter((node) => node.parent === activeStage);
    const neighbors = shown.filter((node) => node.id !== activeStage && node.parent !== activeStage);
    positioned = [{ ...root, x: 24, y: 24 }, ...members.map((node, index) => ({ ...node, x: 24 + index % 2 * 256, y: 136 + Math.floor(index / 2) * 108 })), ...neighbors.map((node, index) => ({ ...node, x: 616, y: 136 + index * 100 }))];
  }
  return { stage: activeStage, nodes: positioned, eligible, edges: displayed, width: activeStage ? 896 : 1100, height: Math.max(activeStage ? 560 : 460, ...positioned.map((node) => node.y + 120)) };
}
