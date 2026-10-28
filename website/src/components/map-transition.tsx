'use client';

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { isHomeRoute } from '@/lib/home-scene';
import { useHomeScene } from './home-scene-state';
import { TRANSITION_TIMEOUT_MS, mapTransitionColors, mapTransitionNames, transitionTiming, titleFrame, mapAtPath, mapTransitionTarget, plainLinkActivation, type MapTransitionPhase, type TransitionMap, type TransitionDestination, type TitleAnchor } from '@/lib/map-transition';
import styles from './map-transition.module.css';

type TransitionContext = {
  begin: (map: TransitionMap, anchor: HTMLAnchorElement, event: MouseEvent<HTMLAnchorElement>) => boolean;
  prefetch: (href: string) => void;
  arrive: (destination: TransitionDestination) => void;
};
const Context = createContext<TransitionContext | null>(null);
type Run = {
  map: TransitionMap; destination: TransitionDestination; phase: MapTransitionPhase; start: number; created: number; frame: number;
  timeout?: ReturnType<typeof setTimeout>; canvas: HTMLCanvasElement; context: CanvasRenderingContext2D; ghost: HTMLDivElement | null;
  from: TitleAnchor | null; to: TitleAnchor | null; arrivalFrom: TitleAnchor | null; current: TitleAnchor | null; hidden: Map<HTMLElement, string>;
  href: string; route: string; navigated: boolean; width: number; height: number; returnOverflow: string; navBottom: number;
};
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

function mapHeading() {
  return Array.from(document.querySelectorAll('[data-map-arrival]')).map((marker) => marker.nextElementSibling?.querySelector<HTMLElement>('h1')).find((title) => title && title.getClientRects().length > 0) ?? null;
}
function titleAnchor(element: HTMLElement | null, navBottom: number): TitleAnchor | null {
  if (!element) return null;
  const box = element.getBoundingClientRect();
  // An offscreen heading should not suddenly materialize as a floating label.
  if (box.width < 1 || box.height < 1 || box.top < navBottom || box.bottom > window.innerHeight) return null;
  const style = getComputedStyle(element), fontSize = parseFloat(style.fontSize);
  return { x: box.left, y: box.top, fontSize, lineHeight: parseFloat(style.lineHeight) || fontSize * 1.3, letterSpacing: parseFloat(style.letterSpacing) || 0, weight: parseFloat(style.fontWeight) || 600 };
}
function hideTitle(current: Run, element: HTMLElement) {
  if (!current.hidden.has(element)) current.hidden.set(element, element.style.visibility);
  element.style.visibility = 'hidden';
}
function paintTitle(current: Run, anchor: TitleAnchor) {
  current.current = anchor;
  if (!current.ghost) return;
  Object.assign(current.ghost.style, { transform: `translate3d(${anchor.x}px,${anchor.y}px,0)`, fontSize: `${anchor.fontSize}px`, lineHeight: `${anchor.lineHeight}px`, letterSpacing: `${anchor.letterSpacing}px`, fontWeight: String(anchor.weight) });
}

export function MapTransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter(), pathname = usePathname();
  const { showExpanded } = useHomeScene();
  const [state, setState] = useState<{ map: TransitionMap; destination: TransitionDestination; phase: MapTransitionPhase } | null>(null);
  const run = useRef<Run | null>(null), host = useRef<HTMLDivElement>(null), surface = useRef<HTMLDivElement>(null);

  const finish = useCallback((focus = false) => {
    const current = run.current; if (!current) return;
    cancelAnimationFrame(current.frame); clearTimeout(current.timeout);
    for (const [element, visibility] of current.hidden) element.style.visibility = visibility;
    current.canvas.remove(); current.ghost?.remove(); run.current = null;
    document.body.style.overflow = current.destination === 'home' && current.navigated && current.returnOverflow === 'hidden' ? '' : current.returnOverflow;
    if (surface.current) surface.current.inert = false;
    setState(null);
    if (focus) {
      const target = current.destination === 'home' ? document.querySelector<HTMLElement>(`[data-home-map="${current.map}"]`) ?? document.getElementById('home-title') : mapHeading();
      if (target) { if (target.tagName === 'H1') target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }
    }
  }, []);

  const draw = useCallback((current: Run, elapsed: number) => {
    const { canvas, context: ctx } = current;
    const width = window.innerWidth, height = window.innerHeight;
    if (current.width !== width || current.height !== height) {
      current.width = width; current.height = height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.ceil(width * dpr); canvas.height = Math.ceil(height * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    // Entire canvas remains transparent; only a handful of points sit OUTSIDE the moving text.
    ctx.clearRect(0, 0, width, height);
    if (!current.current) return;
    const timing = transitionTiming(current.destination), progress = Math.min(1, elapsed / timing.arrival);
    const alpha = current.phase === 'arriving' ? Math.max(0, 1 - progress / .7) : Math.min(1, elapsed / 70);
    const anchor = current.current, textWidth = anchor.fontSize * mapTransitionNames[current.map].length;
    const count = width < 768 ? Math.ceil(timing.particles * .6) : timing.particles;
    ctx.save(); ctx.beginPath(); ctx.rect(0, current.navBottom + 1, width, height); ctx.clip();
    for (let i = 0; i < count; i++) {
      const seed = ((i * 37 + 17) % 97) / 97;
      const side = i % 2 ? -1 : 1;
      const x = anchor.x - 14 + seed * (textWidth + 28);
      const y = anchor.y + (side < 0 ? -9 : anchor.lineHeight + 9) + Math.sin((performance.now() - current.created) / 750 + i) * 1.5;
      ctx.fillStyle = `rgba(${i % 5 === 0 ? mapTransitionColors[current.map] : '176,168,255'},${alpha * timing.particleAlpha * (.5 + seed * .5)})`;
      ctx.fillRect(x, y, seed > .8 ? 2 : 1.5, seed > .8 ? 2 : 1.5);
    }
    ctx.restore();
  }, []);

  const animate = useCallback(function tick(now: number) {
    const current = run.current; if (!current) return;
    try {
      const elapsed = now - current.start, timing = transitionTiming(current.destination);
      if (current.ghost && current.from) {
        if (current.phase === 'departing') {
          paintTitle(current, titleFrame(current.from, { ...current.from, y: current.from.y - 3 }, elapsed / timing.departure));
          current.ghost.style.opacity = String(Math.max(.6, 1 - .4 * elapsed / timing.departure));
        } else if (current.phase === 'waiting') current.ghost.style.opacity = '.6';
        else if (current.arrivalFrom && current.to) {
          paintTitle(current, titleFrame(current.arrivalFrom, current.to, elapsed / timing.arrival));
          current.ghost.style.opacity = String(Math.min(1, elapsed / (current.destination === 'home' ? 60 : 100)));
        }
      }
      draw(current, elapsed);
      if (current.phase === 'departing' && elapsed >= timing.departure) {
        current.phase = 'waiting'; if (current.ghost) current.ghost.style.opacity = '.6'; setState({ map: current.map, destination: current.destination, phase: 'waiting' });
        current.navigated = true;
        current.timeout = setTimeout(() => { if (run.current === current) { const href = current.href; finish(); window.location.assign(href); } }, TRANSITION_TIMEOUT_MS);
        router.push(current.route, { scroll: false });
      } else if (current.phase === 'arriving' && elapsed >= timing.arrival) { finish(true); return; }
      current.frame = requestAnimationFrame(tick);
    } catch { const href = current.href; finish(); window.location.assign(href); }
  }, [draw, finish, router]);

  const start = useCallback((destination: TransitionDestination, anchor: HTMLAnchorElement, event: MouseEvent) => {
    if (!plainLinkActivation(event, anchor.target, anchor.hasAttribute('download'))) return false;
    if (run.current) return true;
    const fromMap = mapAtPath(window.location.pathname, basePath);
    if (destination === 'home' ? !fromMap : !isHomeRoute(window.location.pathname, basePath)) return false;
    const target = mapTransitionTarget(destination, anchor.href, window.location.origin, basePath);
    if (!target || !host.current) return false;
    if (destination === 'home') showExpanded();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    const map = destination === 'home' ? fromMap! : destination;
    let canvas: HTMLCanvasElement, context: CanvasRenderingContext2D | null;
    try { canvas = document.createElement('canvas'); context = canvas.getContext('2d', { alpha: true }); } catch { return false; }
    if (!context) return false;
    const now = performance.now(), navBottom = document.querySelector('#nd-nav')?.getBoundingClientRect().bottom ?? 56;
    const source = destination === 'home' ? mapHeading() : anchor.querySelector<HTMLElement>('h2');
    const from = titleAnchor(source, navBottom);
    let ghost: HTMLDivElement | null = null;
    if (from && source) {
      ghost = document.createElement('div'); ghost.className = styles.flyingTitle; ghost.textContent = mapTransitionNames[map]; ghost.dataset.transitionTitle = map;
      const font = getComputedStyle(source); ghost.style.fontFamily = font.fontFamily; ghost.style.color = font.color;
    }
    const current: Run = { map, destination, phase: 'departing', start: now, created: now, frame: 0, canvas, context, ghost, from, to: null, arrivalFrom: null, current: from, hidden: new Map(), ...target, navigated: false, width: 0, height: 0, returnOverflow: document.body.style.overflow, navBottom };
    try {
      draw(current, 0); host.current.appendChild(canvas);
      if (ghost && source && from) { host.current.appendChild(ghost); paintTitle(current, from); hideTitle(current, source); }
      run.current = current; document.body.style.overflow = 'hidden'; if (surface.current) surface.current.inert = true;
      setState({ map, destination, phase: 'departing' }); current.frame = requestAnimationFrame(animate); return true;
    } catch { run.current = current; finish(); return false; }
  }, [animate, draw, finish, showExpanded]);
  const begin = useCallback((map: TransitionMap, anchor: HTMLAnchorElement, event: MouseEvent<HTMLAnchorElement>) => start(map, anchor, event), [start]);
  const captureHomeLink = (event: MouseEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Element)) return;
    const anchor = event.target.closest<HTMLAnchorElement>('a[href]');
    if (anchor && mapTransitionTarget('home', anchor.href, window.location.origin, basePath) && start('home', anchor, event)) event.preventDefault();
  };

  const arrive = useCallback((destination: TransitionDestination) => {
    const current = run.current;
    if (!current || !current.navigated || current.destination !== destination || current.phase !== 'waiting') return;
    const arrivingTitle = destination === 'home' ? document.querySelector<HTMLElement>(`[data-home-map="${current.map}"] h2`) : mapHeading();
    if (current.ghost) current.ghost.style.opacity = '0';
    if (arrivingTitle && current.ghost && current.from) hideTitle(current, arrivingTitle);
    cancelAnimationFrame(current.frame);
    current.frame = requestAnimationFrame(() => {
      current.frame = requestAnimationFrame(() => {
        if (run.current !== current) return;
        try {
          window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
          const target = destination === 'home' ? document.querySelector<HTMLElement>(`[data-home-map="${current.map}"] h2`) : mapHeading();
          const to = titleAnchor(target, current.navBottom);
          if (to && target && current.ghost && current.from) {
            current.to = to; current.arrivalFrom = { ...to, y: to.y + (destination === 'home' ? 3 : 6) };
            current.ghost.style.fontFamily = getComputedStyle(target).fontFamily;
            current.ghost.style.color = getComputedStyle(target).color;
            paintTitle(current, current.arrivalFrom); current.ghost.style.opacity = '0'; hideTitle(current, target);
          }
          else { for (const [element, visibility] of current.hidden) element.style.visibility = visibility; current.ghost?.remove(); current.ghost = null; current.current = null; }
          clearTimeout(current.timeout); current.phase = 'arriving'; current.start = performance.now();
          setState({ map: current.map, destination, phase: 'arriving' }); current.frame = requestAnimationFrame(animate);
        } catch { finish(true); }
      });
    });
  }, [animate, finish]);
  const prefetch = useCallback((href: string) => { try { router.prefetch(href); } catch { /* Native navigation still works. */ } }, [router]);

  useEffect(() => {
    const cancel = () => finish();
    const blockKeys = (event: KeyboardEvent) => { if (run.current) { event.preventDefault(); event.stopPropagation(); } };
    const resize = () => { const current = run.current; if (current?.phase === 'arriving') finish(true); };
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const reduce = () => { const current = run.current; if (motion.matches && current) { const { navigated, route } = current; finish(); if (!navigated) router.push(route); } };
    window.addEventListener('popstate', cancel); window.addEventListener('pagehide', cancel); window.addEventListener('resize', resize); window.addEventListener('keydown', blockKeys, true); motion.addEventListener('change', reduce);
    return () => { window.removeEventListener('popstate', cancel); window.removeEventListener('pagehide', cancel); window.removeEventListener('resize', resize); window.removeEventListener('keydown', blockKeys, true); motion.removeEventListener('change', reduce); finish(); };
  }, [finish, router]);
  useEffect(() => {
    const current = run.current; if (!current?.navigated) return;
    if (!isHomeRoute(pathname, basePath) && !mapAtPath(pathname, basePath)) finish();
  }, [pathname, finish]);

  return <Context value={{ begin, arrive, prefetch }}>
    <div ref={surface} className={styles.surface} inert={!!state} aria-busy={!!state} data-transition-phase={state?.phase} data-transition-map={state?.map} data-transition-destination={state?.destination} onClickCapture={captureHomeLink}>{children}</div>
    <div ref={host} className={styles.overlay} hidden={!state} aria-hidden="true" data-map-transition={state?.phase ?? 'idle'} data-transition-destination={state?.destination} />
    <p className={styles.status} role="status" aria-live="polite">{state ? state.destination === 'home' ? '正在返回首页' : `正在进入${mapTransitionNames[state.map]}` : ''}</p>
  </Context>;
}

export function useMapTransition() {
  const context = useContext(Context); if (!context) throw new Error('MapTransitionProvider is required'); return context;
}
export function MapArrival({ map }: { map: TransitionMap }) {
  const { arrive } = useMapTransition(); useLayoutEffect(() => { arrive(map); }, [arrive, map]); return <span data-map-arrival={map} hidden />;
}
