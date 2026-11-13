import { getMap, maps } from '@/lib/maps/content';
import type { MapKey } from '@/lib/maps/types';
import { LearningExplorer } from './domain-explorer';
import { documentStatuses, sourceTitles } from '@/lib/reading-context';
import { MapArrival } from '@/components/map-transition';

export function mapMetadata(id: MapKey) {
  const map = getMap(id);
  return { title: map.title, description: map.description };
}

export function MapPage({ id }: { id: MapKey }) {
  const map = getMap(id);
  return <><MapArrival map={id} /><LearningExplorer key={id} map={map} maps={maps} statuses={documentStatuses()} sourceTitles={sourceTitles()} /></>;
}
