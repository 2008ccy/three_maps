import type { MapKey } from './maps/types';
export type { MapKey };
export const mapLabels = [
  { id: 'domain', title: '领域地图' },
  { id: 'ecosystem', title: '生态地图' },
  { id: 'cognition', title: '认知地图' },
] as const satisfies readonly { id: MapKey; title: string }[];
