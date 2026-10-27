import { getNode } from '@/lib/source';
import { documentKey, flattenNodes, getMap } from '@/lib/maps/content';
import type { MapKey, MapLinks } from '@/lib/maps/types';
import { MapExplorer } from './map-explorer';
import { documentStatuses, sourceTitles } from '@/lib/reading-context';

export function mapMetadata(id: MapKey) {
  const map = getMap(id);
  return { title: map.title, description: map.description };
}

export function MapPage({ id }: { id: MapKey }) {
  const map = getMap(id);
  const links: MapLinks = {};
  const references = [...map.auxiliary, ...flattenNodes(map.branches).flatMap((node) => node.documents)];
  for (const ref of references) {
    const page = getNode(ref.id);
    links[documentKey(ref)] = { title: ref.label ?? page.data.title, href: `${page.url}/${ref.anchor ? `#${ref.anchor}` : ''}` };
  }
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
  return <MapExplorer map={map} links={links} statuses={documentStatuses()} sourceTitles={sourceTitles()} />;
}
