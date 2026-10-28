export type TransitionMap = 'domain' | 'ecosystem' | 'cognition';
export type TransitionDestination = TransitionMap | 'home';
export type MapTransitionPhase = 'departing' | 'waiting' | 'arriving';
export const TRANSITION_TIMEOUT_MS = 1500;
export const mapTransitionColors: Record<TransitionMap, string> = { domain: '181,169,255', ecosystem: '139,216,195', cognition: '148,202,250' };
export const mapTransitionNames: Record<TransitionMap, string> = { domain: '领域地图', ecosystem: '生态地图', cognition: '认知地图' };

export function transitionTiming(destination: TransitionDestination) {
  return destination === 'home' ? { departure: 40, arrival: 220, particles: 6, particleAlpha: .12 } : { departure: 80, arrival: 400, particles: 18, particleAlpha: .2 };
}

export type TitleAnchor = { x: number; y: number; fontSize: number; lineHeight: number; letterSpacing: number; weight: number };
export function titleFrame(from: TitleAnchor, to: TitleAnchor, progress: number): TitleAnchor {
  const t = Math.max(0, Math.min(1, progress));
  const ease = t * t * t * (t * (t * 6 - 15) + 10);
  return Object.fromEntries(Object.entries(from).map(([key, value]) => [key, value + (to[key as keyof TitleAnchor] - value) * ease])) as TitleAnchor;
}

export function plainLinkActivation(event: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; defaultPrevented: boolean }, target = '', download = false) {
  return !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && (!target || target === '_self') && !download;
}

export function mapAtPath(pathname: string, basePath = ''): TransitionMap | null {
  return (Object.keys(mapTransitionColors) as TransitionMap[]).find((map) => pathname.replace(/\/$/, '') === `${basePath}/docs/${map}`) ?? null;
}

export function mapTransitionTarget(map: TransitionDestination, href: string, origin: string, basePath = '') {
  try {
    if (map !== 'home' && !Object.hasOwn(mapTransitionColors, map)) return null;
    const url = new URL(href, origin);
    const expected = map === 'home' ? basePath : `${basePath}/docs/${map}`;
    if (url.origin !== origin || url.pathname.replace(/\/$/, '') !== expected) return null;
    return { href: url.href, route: `${map === 'home' ? '/' : `/docs/${map}/`}${url.search}${url.hash}` };
  } catch { return null; }
}
