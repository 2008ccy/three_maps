import type { MapDefinition, MapNode } from './types';

export type DiagramNode = {
  id: string; title: string; summary: string; column: number; row: number;
  kind: 'root' | 'branch' | 'view' | 'method' | 'case';
};
export type DiagramEdge = { from: string; to: string; kind: 'hierarchy' | 'feedback'; label?: string };

// 与 map__text/认知地图关系图.html 的 14 个节点一一对应。
// 六类习惯、四问的展开解释保留在阅读面板，不另加到原图的层级里。
export function buildCognitionDiagram(map: MapDefinition) {
  const nodes: DiagramNode[] = [{ id: 'root', title: map.title, summary: map.question, column: 1, row: 1, kind: 'root' }];
  const edges: DiagramEdge[] = [];
  map.branches.forEach((branch, index) => {
    nodes.push({ ...pick(branch), column: index + 1, row: 2, kind: 'branch' });
    edges.push({ from: 'root', to: branch.id, kind: 'hierarchy' });
    if (index > 1) return;
    branch.children?.forEach((child, childIndex) => {
      nodes.push({ ...pick(child), column: index + 1, row: childIndex + 3, kind: index === 0 ? 'view' : 'method' });
      edges.push({ from: branch.id, to: child.id, kind: 'hierarchy' });
      if (index === 1) child.children?.forEach((example) => {
        nodes.push({ ...pick(example), column: 3, row: childIndex + 3, kind: 'case' });
        edges.push({ from: child.id, to: example.id, kind: 'hierarchy' });
      });
    });
  });
  edges.push(...(map.connections ?? []).map((edge) => ({ ...edge, kind: 'feedback' as const })));
  return { nodes, edges };
}

function pick(node: MapNode) { return { id: node.id, title: node.title, summary: node.summary }; }

// 案例在画布第三列，侧栏方向由实际位置决定，而不是继承“分析方法”的左列。
export function cognitionNodeSide(map: MapDefinition, id: string): 'left' | 'right' | undefined {
  const node = buildCognitionDiagram(map).nodes.find((item) => item.id === id);
  return node && (node.column <= 2 ? 'left' : 'right');
}
