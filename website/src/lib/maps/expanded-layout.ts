import type { ExpandedGraph } from './expanded-graph';
import { relationPath, spokePath, type GraphBox } from './radial-layout.ts';
import { movingPath } from './graph-motion.ts';

export function expandedLayout(graph: ExpandedGraph, compact = false) {
  // World coordinates stay fixed across expansion; opening another branch never recenters the map.
  const center = 1600;
  const boxes: GraphBox[] = [{ id: graph.hub, x: center, y: center, width: compact ? 120 : 144, height: compact ? 92 : 112, ellipse: true }];
  for (const [index, branch] of graph.map.branches.entries()) {
    const theme = graph.nodes.find(node => node.kind === 'theme' && node.group === branch.id);
    if (!theme) continue;
    const angle = -Math.PI / 2 + index * 2 * Math.PI / graph.map.branches.length;
    const place = (id: string, theta: number, radius: number, width: number, height: number) => {
      boxes.push({ id, x: center + Math.cos(theta) * radius * (compact ? .6 : 1), y: center + Math.sin(theta) * radius, width, height, ellipse: true });
    };
    place(theme.key, angle, 225, compact ? 124 : 154, 66);
    const children = graph.nodes.filter(node => node.kind === 'point' && node.group === branch.id);
    children.forEach((node, i) => {
      const theta = angle + (i - (children.length - 1) / 2) * .38;
      place(node.key, theta, 415, 160, 58);
    });
    const external = graph.nodes.filter(node => node.kind === 'external' && node.group === branch.id);
    external.forEach((node, i) => {
      const row = Math.floor(i / 4), count = Math.min(4, external.length - row * 4);
      const theta = angle + (i % 4 - (count - 1) / 2) * .27;
      place(node.key, theta, 620 + row * 136, 158, 62);
    });
  }
  // Deterministic collision relaxation only moves outer nodes; theme locations stay stable.
  for (let pass = 0; pass < 24; pass++) for (let i = 1; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    const dx = b.x - a.x, dy = b.y - a.y;
    const overlapX = (a.width + b.width) / 2 + 20 - Math.abs(dx);
    const overlapY = (a.height + b.height) / 2 + 20 - Math.abs(dy);
    if (overlapX <= 0 || overlapY <= 0) continue;
    const movableA = graph.nodes.find(node => node.key === a.id)?.kind !== 'theme';
    const movableB = graph.nodes.find(node => node.key === b.id)?.kind !== 'theme';
    const count = Number(movableA) + Number(movableB);
    if (!count) continue;
    const horizontal = overlapX < overlapY;
    const shift = ((horizontal ? overlapX : overlapY) + 1) / count;
    const direction = (horizontal ? dx : dy) >= 0 ? 1 : -1;
    if (movableA) a[horizontal ? 'x' : 'y'] -= shift * direction;
    if (movableB) b[horizontal ? 'x' : 'y'] += shift * direction;
  }
  const byId = new Map(boxes.map(box => [box.id, box]));
  const layout = { boxes, byId, width: center * 2, height: center * 2 };
  const bounds = graphBounds(boxes);
  const routingBoxes = boxes.map(box => ({ ...box, x: box.x-bounds.left, y: box.y-bounds.top }));
  const routing = { boxes: routingBoxes, byId: new Map(routingBoxes.map(box => [box.id, box])), width: bounds.right-bounds.left, height: bounds.bottom-bounds.top };
  const offset = { x: bounds.left, y: bounds.top, vx: 0, vy: 0 };
  const routes = graph.lines.map(line => {
    const a = byId.get(line.from)!, b = byId.get(line.to)!;
    const relative = line.kind === 'hierarchy' ? undefined : relationPath(routing.byId.get(line.from)!, routing.byId.get(line.to)!, routing);
    const path = relative ? { d: movingPath(relative.d, offset, offset), label: { x: relative.label.x+bounds.left, y: relative.label.y+bounds.top } } : { d: spokePath(a, b), label: { x: (a.x+b.x)/2, y: (a.y+b.y)/2 } };
    return { line, ...path };
  });
  return { ...layout, routes };
}

export function graphBounds(boxes: GraphBox[]) {
  return { left: Math.min(...boxes.map(b => b.x-b.width/2))-36, right: Math.max(...boxes.map(b => b.x+b.width/2))+36,
    top: Math.min(...boxes.map(b => b.y-b.height/2))-36, bottom: Math.max(...boxes.map(b => b.y+b.height/2))+36 };
}
