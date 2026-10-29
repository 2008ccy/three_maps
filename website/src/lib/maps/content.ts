import { ecosystemMap } from './ecosystem-learning.ts';
import { domainMap } from './domain-learning.ts';
import { cognitionMap } from './cognition-learning.ts';
import type { DocumentRef, MapDefinition, MapNode } from './types';

// Stable node IDs remain independent of article IDs and page titles.
export const maps: MapDefinition[] = [domainMap, ecosystemMap, cognitionMap];

export function getMap(id: string) {
  const map = maps.find((item) => item.id === id);
  if (!map) throw new Error(`Unknown map: ${id}`);
  return map;
}

export function flattenNodes(nodes: MapNode[]): MapNode[] {
  return nodes.flatMap((node) => [node, ...flattenNodes(node.children ?? [])]);
}

export function documentKey(ref: DocumentRef) {
  return `${ref.id}${ref.anchor ? `#${ref.anchor}` : ''}`;
}
