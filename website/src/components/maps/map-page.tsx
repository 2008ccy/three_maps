import { flattenNodes, getMap } from '@/lib/maps/content';
import type { MapKey, MapLinks } from '@/lib/maps/types';
import { MapExplorer } from './map-explorer';
import { DomainExplorer } from './domain-explorer';
import { documentStatuses, sourceTitles } from '@/lib/reading-context';

export function mapMetadata(id: MapKey) {
  const map = getMap(id);
  return { title: map.title, description: map.description };
}

export function MapPage({ id }: { id: MapKey }) {
  const map = getMap(id);
  const links: MapLinks = {};
  for (const node of flattenNodes(map.branches)) {
    for (const relation of node.relations ?? []) {
      const target = getMap(relation.map);
      const targetNode = flattenNodes(target.branches).find((item) => item.id === relation.node);
      if (!targetNode) throw new Error(`Unknown map node: ${relation.map}/${relation.node}`);
      links[`relation:${relation.map}:${relation.node}`] = {
        title: `${target.title} · ${targetNode.title}`,
        href: `/docs/${target.id}/#node-${targetNode.id}`,
      };
    }
  }
  const Explorer = id === 'domain' ? DomainExplorer : MapExplorer;
  return <Explorer map={map} links={links} statuses={documentStatuses()} sourceTitles={sourceTitles()} />;
}
