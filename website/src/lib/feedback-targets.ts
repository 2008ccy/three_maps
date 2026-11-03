import { maps } from './maps/content.ts';
import { buildCatalog } from './maps/catalog.ts';
import type { FeedbackTarget } from './feedback-contract.ts';
import { feedbackComposeHref as composeHref } from './feedback-contract.ts';

export const feedbackMaps = maps.map(({ id, title }) => ({ id, title }));
export const feedbackTargets = maps.flatMap((map) => [
  { value: `${map.id}:`, target: { mapId: map.id } as FeedbackTarget, label: `${map.title} · 整张地图`, href: `/docs/${map.id}/` },
  ...buildCatalog(map).map((node) => ({ value: `${map.id}:${node.id}`, target: { mapId: map.id, nodeId: node.id } as FeedbackTarget, label: `${map.title} · ${node.title}`, href: `/docs/${map.id}/#node-${node.id}` })),
]);
export function findFeedbackTarget(target: FeedbackTarget) {
  return feedbackTargets.find((item) => item.target.mapId === target.mapId && item.target.nodeId === target.nodeId);
}
export function feedbackTargetHref(target: FeedbackTarget) { return findFeedbackTarget(target)?.href ?? null; }
export function feedbackComposeHref(target: FeedbackTarget) {
  const current = findFeedbackTarget(target);
  if (!current) return '/feedback/';
  return composeHref(target);
}
