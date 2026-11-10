import type { RelationLine } from './radial-graph';

type Point = { x: number; y: number };
export type GraphBox = Point & { id: string; width: number; height: number; ellipse?: boolean };
type Size = { width: number; height: number };

// Minimize the angular distance between connected branches. Fix the first
// topic at the top and preserve catalog order when two arrangements tie.
function ringOrder(ids: string[], lines: RelationLine[]) {
  const chords = lines.filter(line => ids.includes(line.from) && ids.includes(line.to));
  if (ids.length < 4 || ids.length > 7 || !chords.length) return ids;
  let best = ids, bestScore = Infinity;
  function visit(order: string[], remaining: string[]) {
    if (remaining.length) {
      for (const id of remaining) visit([...order, id], remaining.filter(other => other !== id));
      return;
    }
    const score = chords.reduce((sum, line) => {
      const gap = Math.abs(order.indexOf(line.from) - order.indexOf(line.to));
      return sum + Math.min(gap, order.length - gap);
    }, 0);
    if (score < bestScore) { best = order; bestScore = score; }
  }
  visit([ids[0]], ids.slice(1));
  return best;
}

export function radialLayout(hub: string, ids: string[], lines: RelationLine[], viewport: Size) {
  const compact = viewport.width < 600;
  const nodeWidth = compact ? 106 : 178, nodeHeight = compact ? 70 : 72;
  const hubWidth = compact ? 116 : 150, hubHeight = compact ? 80 : 90;
  const padding = compact ? 12 : 28;
  const width = Math.max(280, Math.min(viewport.width, 1020));
  const height = Math.max(360, Math.min(viewport.height, 560));
  const rx = (width - nodeWidth) / 2 - padding, ry = (height - nodeHeight) / 2 - padding;
  const order = ringOrder(ids, lines);
  const start = order.length === 4 ? -3 * Math.PI / 4 : order.length === 2 && !compact ? 0 : -Math.PI / 2;
  const boxes: GraphBox[] = [{ id: hub, x: 0, y: 0, width: hubWidth, height: hubHeight, ellipse: true }];
  order.forEach((id, index) => {
    const angle = start + 2 * Math.PI * index / order.length;
    boxes.push({ id, x: rx * Math.cos(angle), y: ry * Math.sin(angle), width: nodeWidth, height: nodeHeight });
  });

  // Preserve the shape of the ring when a small viewport needs extra spacing.
  let stretch = 1;
  for (let i = 0; i < boxes.length; i++) {
    for (const b of boxes.slice(i + 1)) {
      const a = boxes[i], gap = compact ? 12 : 24;
      const sx = ((a.width + b.width) / 2 + gap) / Math.max(.01, Math.abs(a.x - b.x));
      const sy = ((a.height + b.height) / 2 + gap) / Math.max(.01, Math.abs(a.y - b.y));
      stretch = Math.max(stretch, Math.min(sx, sy));
    }
  }
  const world = { width: Math.ceil(2 * (rx * stretch + padding) + nodeWidth), height: Math.ceil(2 * (ry * stretch + padding) + nodeHeight) };
  for (const box of boxes) {
    box.x = world.width / 2 + box.x * stretch;
    box.y = world.height / 2 + box.y * stretch;
  }
  return { ...world, boxes, byId: new Map(boxes.map(box => [box.id, box])) };
}

function port(box: GraphBox, toward: Point) {
  const dx = toward.x - box.x, dy = toward.y - box.y;
  const scale = box.ellipse
    ? .5 / Math.hypot(dx / box.width, dy / box.height)
    : Math.min(box.width / (2 * Math.abs(dx)), box.height / (2 * Math.abs(dy)));
  return { x: box.x + dx * scale, y: box.y + dy * scale };
}

export function spokePath(a: GraphBox, b: GraphBox) {
  const p = port(a, b), q = port(b, a);
  return `M ${p.x} ${p.y} L ${q.x} ${q.y}`;
}

type Bounds = { left: number; top: number; right: number; bottom: number };

function crossesBox(p: Point, q: Point, box: Bounds) {
  let enter = 0, exit = 1;
  for (const [start, delta, low, high] of [
    [p.x, q.x - p.x, box.left, box.right],
    [p.y, q.y - p.y, box.top, box.bottom],
  ]) {
    if (Math.abs(delta) < .001) {
      if (start <= low || start >= high) return false;
    } else {
      const left = (low - start) / delta, right = (high - start) / delta;
      enter = Math.max(enter, Math.min(left, right));
      exit = Math.min(exit, Math.max(left, right));
    }
  }
  return enter < exit - .00001;
}

// A chord across a crowded ring can have no clear quadratic curve. In that
// case, take the shortest unobstructed path around the other cards' corners.
function detour(a: GraphBox, b: GraphBox, obstacles: GraphBox[]) {
  const boxes = obstacles.map(box => ({
    left: box.x - box.width / 2 - 7, right: box.x + box.width / 2 + 7,
    top: box.y - box.height / 2 - 7, bottom: box.y + box.height / 2 + 7,
  }));
  const points: Point[] = [a, b, ...boxes.flatMap(box => [
    { x: box.left, y: box.top }, { x: box.right, y: box.top },
    { x: box.right, y: box.bottom }, { x: box.left, y: box.bottom },
  ])];
  const remaining = new Set(points.keys()), distance = points.map(() => Infinity), previous = points.map(() => -1);
  distance[0] = 0;
  while (remaining.size) {
    let nearest = -1;
    for (const i of remaining) if (nearest === -1 || distance[i] < distance[nearest]) nearest = i;
    if (nearest === 1 || !Number.isFinite(distance[nearest])) break;
    remaining.delete(nearest);
    for (const i of remaining) {
      const p = points[nearest], q = points[i];
      const next = distance[nearest] + Math.hypot(q.x - p.x, q.y - p.y);
      if (next < distance[i] && !boxes.some(box => crossesBox(p, q, box))) {
        distance[i] = next;
        previous[i] = nearest;
      }
    }
  }
  if (previous[1] === -1) return;
  const path: Point[] = [];
  for (let i = 1; i !== -1; i = previous[i]) path.unshift(points[i]);
  path[0] = port(a, path[1]);
  path[path.length - 1] = port(b, path[path.length - 2]);
  const lengths = path.slice(1).map((q, i) => Math.hypot(q.x - path[i].x, q.y - path[i].y));
  let half = lengths.reduce((sum, length) => sum + length, 0) / 2;
  let label = path[0];
  for (const [i, length] of lengths.entries()) {
    if (half <= length) {
      const t = half / length;
      label = { x: path[i].x * (1-t) + path[i+1].x * t, y: path[i].y * (1-t) + path[i+1].y * t };
      break;
    }
    half -= length;
  }
  return { d: path.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' '), label, penalty: 0 };
}

export function relationPath(a: GraphBox, b: GraphBox, layout: ReturnType<typeof radialLayout>) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const cx = layout.width / 2, cy = layout.height / 2;
  const outward = (mid.x - cx) * -dy + (mid.y - cy) * dx >= 0 ? 1 : -1;
  const radial = a === layout.boxes[0] || b === layout.boxes[0];
  const bends = radial ? [0, .18, -.18] : [.17, -.17, .32, -.32, .52, -.52, .75, -.75, 1, -1, 1.2, -1.2, 0];
  const obstacles = layout.boxes.filter(box => box !== a && box !== b);
  let best: { d: string; label: Point; penalty: number } | undefined;
  for (const bend of bends) {
    const c = { x: mid.x - dy * bend * outward, y: mid.y + dx * bend * outward };
    const p = port(a, c), q = port(b, c);
    const at = (t: number) => ({
      x: (1-t)**2 * p.x + 2*(1-t)*t * c.x + t*t * q.x,
      y: (1-t)**2 * p.y + 2*(1-t)*t * c.y + t*t * q.y,
    });
    let penalty = 0;
    for (let i = 1; i < 32; i++) {
      const s = at(i / 32);
      if (s.x < 4 || s.y < 4 || s.x > layout.width - 4 || s.y > layout.height - 4) penalty++;
      for (const box of obstacles) {
        if (Math.abs(s.x - box.x) < box.width / 2 + 8 && Math.abs(s.y - box.y) < box.height / 2 + 8) penalty++;
      }
    }
    const route = { d: `M ${p.x} ${p.y} Q ${c.x} ${c.y} ${q.x} ${q.y}`, label: at(.5), penalty };
    if (!penalty) return route;
    if (!best || penalty < best.penalty) best = route;
  }
  return detour(a, b, obstacles) ?? best!;
}
