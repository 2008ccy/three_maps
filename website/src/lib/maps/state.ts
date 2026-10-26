import type { MapNode, MapState } from './types';

export function findPath(nodes: MapNode[], id: string): MapNode[] | undefined {
  for (const node of nodes) {
    if (node.id === id) return [node];
    const childPath = node.children && findPath(node.children, id);
    if (childPath) return [node, ...childPath];
  }
}

// 所有层级的要点都继承所属一级分支的方向，地址片段恢复时也使用同一规则。
export function nodeSide(nodes: MapNode[], id: string): 'left' | 'right' | undefined {
  const root = findPath(nodes, id)?.[0];
  if (!root) return;
  return nodes.indexOf(root) < Math.ceil(nodes.length / 2) ? 'left' : 'right';
}

export function stateForNode(nodes: MapNode[], id: string): MapState {
  const path = findPath(nodes, id);
  if (!path) return { expanded: [], selected: null };
  const target = path.at(-1)!;
  return {
    expanded: path.filter((node) => node.children?.length).map((node) => node.id),
    selected: target.children?.length ? null : target.id,
  };
}

export function toggleBranch(nodes: MapNode[], state: MapState, id: string): MapState {
  const index = state.expanded.indexOf(id);
  return index < 0 ? stateForNode(nodes, id) : { expanded: state.expanded.slice(0, index), selected: null };
}

export function stateFromHash(nodes: MapNode[], hash: string): MapState {
  return stateForNode(nodes, hash.startsWith('#node-') ? hash.slice(6) : '');
}

export function stateHash(state: MapState) {
  const id = state.selected ?? state.expanded.at(-1);
  return id ? `#node-${id}` : '';
}
