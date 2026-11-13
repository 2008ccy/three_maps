export type Motion = { x: number; y: number; vx: number; vy: number };
export const stillMotion = (): Motion => ({ x: 0, y: 0, vx: 0, vy: 0 });
export const dragThreshold = 6;
type ViewportSize = { width: number; height: number };
type Offset = { x: number; y: number };
export type Camera = Offset & { scale: number };
export const cameraTransitionDuration = 560;

// Ease the visible center and zoom together, keeping a shared focal point still
// during a pure zoom. Exact endpoints also make interrupted flights continuous.
export function interpolateCamera(from: Camera, to: Camera, progress: number, size: ViewportSize): Camera {
  if (progress <= 0) return { ...from };
  if (progress >= 1) return { ...to };
  const t = progress * progress * progress * (10 + progress * (-15 + 6 * progress));
  const scale = from.scale * Math.pow(to.scale / from.scale, t);
  const position = (axis: 'x' | 'y', center: number) => {
    const start = (center-from[axis])/from.scale, end = (center-to[axis])/to.scale;
    return center - (start+(end-start)*t)*scale;
  };
  return { x: position('x', size.width/2), y: position('y', size.height/2), scale };
}

// Resist a whole-map drag more strongly as it moves away from the current
// fitted/focused view. Screen-space limits stay the same at every zoom level.
export function panRadius(size: ViewportSize) {
  return Math.max(24, Math.min(300, Math.min(size.width, size.height) * .38));
}
export function elasticPan(input: Offset, size: ViewportSize): Offset {
  const distance = Math.hypot(input.x, input.y), radius = panRadius(size), free = radius * .55;
  if (distance <= free) return { ...input };
  const span = radius-free, excess = distance-free;
  const ratio = (free + excess / (1 + excess/span)) / distance;
  return { x: input.x * ratio, y: input.y * ratio };
}
// Re-grabbing a returning map must start exactly where it currently appears.
export function panInput(offset: Offset, size: ViewportSize): Offset {
  const distance = Math.hypot(offset.x, offset.y), radius = panRadius(size), free = radius * .55;
  if (distance <= free) return { ...offset };
  const span = radius-free, excess = distance-free;
  const ratio = (free + excess / Math.max(.001, 1-excess/span)) / distance;
  return { x: offset.x * ratio, y: offset.y * ratio };
}
export function stepPanGravity(state: Motion, elapsed: number) {
  const duration = Math.max(0, Math.min(elapsed, .04));
  const steps = Math.max(1, Math.ceil(duration * 120)), dt = duration / steps;
  for (let step = 0; step < steps; step++) {
    state.vx += (-14 * state.x - 5.8 * state.vx) * dt;
    state.vy += (-14 * state.y - 5.8 * state.vy) * dt;
    state.x += state.vx * dt; state.y += state.vy * dt;
  }
  const moving = Math.hypot(state.x, state.y) > .08 || Math.hypot(state.vx, state.vy) > .35;
  if (!moving) Object.assign(state, stillMotion());
  return moving;
}

export function stepGraphMotion(states: Map<string, Motion>, neighbors: Map<string, string[]>, elapsed: number, pinned?: string) {
  const steps = Math.max(1, Math.ceil(Math.min(elapsed, .04) / (1 / 120)));
  const dt = Math.min(elapsed, .04) / steps;
  for (let step = 0; step < steps; step++) {
    const accelerations = new Map<string, { x: number; y: number }>();
    for (const [id, state] of states) {
      const linked = neighbors.get(id) ?? [];
      const force = { x: -110 * state.x - 15 * state.vx, y: -110 * state.y - 15 * state.vy };
      for (const key of linked) {
        const other = states.get(key);
        if (other) { force.x += 62 * (other.x-state.x) / Math.max(1, linked.length); force.y += 62 * (other.y-state.y) / Math.max(1, linked.length); }
      }
      accelerations.set(id, force);
    }
    for (const [id, state] of states) {
      if (id === pinned) continue;
      const force = accelerations.get(id)!;
      state.vx += force.x * dt; state.vy += force.y * dt;
      state.x += state.vx * dt; state.y += state.vy * dt;
    }
  }
  const moving = [...states.values()].some(state => Math.hypot(state.x, state.y) > .08 || Math.hypot(state.vx, state.vy) > .35);
  if (!moving && !pinned) states.forEach(state => Object.assign(state, stillMotion()));
  return moving;
}

// Warp an existing obstacle-avoiding route with its moving endpoints instead of rerouting every frame.
export function movingPath(path: string, from: Motion, to: Motion) {
  const numbers = path.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi) ?? [];
  const pairs = numbers.length / 2;
  let index = 0;
  return path.replace(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi, value => {
    const pair = Math.floor(index / 2), axis = index++ % 2 === 0 ? 'x' : 'y';
    const ratio = pairs <= 1 ? 0 : pair / (pairs - 1);
    return String(Number(value) + from[axis]*(1-ratio) + to[axis]*ratio);
  });
}
