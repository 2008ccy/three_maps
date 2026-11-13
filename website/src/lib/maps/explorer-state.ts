import { emptyFilters, readCatalogQuery, type CatalogFilters } from './catalog.ts';
import { resolveRef, type Atlas, type NodeRef } from './expanded-graph.ts';
import type { MapDefinition } from './types';

export type ExplorerState = { expanded: string[]; selected: NodeRef | null; scope: 'core' | 'all'; filters: CatalogFilters; focus: string };
export const initialExplorerState: ExplorerState = { expanded: [], selected: null, scope: 'core', filters: emptyFilters, focus: '' };
export function readExplorerState(search: string, hash: string, map: MapDefinition, atlas: Atlas): ExplorerState {
  const query = new URLSearchParams(search), old = readCatalogQuery(search);
  const valid = (id: string) => resolveRef(atlas, { mapId: map.id, nodeId: id });
  const expanded = new Set((query.get('branches') ?? '').split(',').map(id => valid(id)?.groupId).filter((id): id is string => !!id));
  const stage = valid(old.stage ?? '');
  if (stage && !stage.collection) expanded.add(stage.groupId);
  const peek = query.get('peek')?.split(':');
  let selected = peek?.length === 2 ? resolveRef(atlas, { mapId: peek[0] as NodeRef['mapId'], nodeId: peek[1] }) : undefined;
  selected ??= hash.startsWith('#node-') ? valid(hash.slice(6)) : undefined;
  if (selected?.mapId === map.id && !selected.collection) expanded.add(selected.groupId);
  return { expanded: [...expanded], selected: selected ? { mapId: selected.mapId, nodeId: selected.id } : null,
    scope: old.relations, filters: old.filters, focus: stage && !stage.collection ? `${map.id}:${stage.id}` : '' };
}
export function explorerUrl(state: ExplorerState, map: MapDefinition) {
  const query = new URLSearchParams();
  if (state.expanded.length) query.set('branches', map.branches.filter(branch => state.expanded.includes(branch.id)).map(branch => branch.id).join(','));
  if (state.scope === 'all') query.set('relations', 'all');
  for (const [key, value] of Object.entries(state.filters)) if (value) query.set(key, value);
  if (state.selected && state.selected.mapId !== map.id) query.set('peek', `${state.selected.mapId}:${state.selected.nodeId}`);
  const hash = state.selected?.mapId === map.id ? `#node-${state.selected.nodeId}` : '';
  return `${query.size ? '?' + query : ''}${hash}`;
}
