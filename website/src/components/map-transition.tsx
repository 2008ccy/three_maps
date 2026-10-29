'use client';

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { isHomeRoute } from '@/lib/home-scene';
import { useHomeScene } from './home-scene-state';
import { TRANSITION_TIMEOUT_MS, mapTransitionColors, mapTransitionNames, transitionTiming, handoffProgress, titleFrame, homeMapLink, mapAtPath, isTransitionPage, mapTransitionTarget, plainLinkActivation, type MapTransitionPhase, type TransitionMap, type TransitionDestination, type TitleAnchor } from '@/lib/map-transition';
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
  snapshot: HTMLDivElement | null; chrome: HTMLElement | null; content: HTMLElement | null; contentOpacity: string;
  entryBounds: { x: number; y: number; width: number; height: number } | null;
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
// A short-lived copy of the actual outgoing content, never a painted curtain.
// Freeze computed geometry so floating cards and responsive styles do not jump.
function frozenCopy(element: HTMLElement): HTMLElement {
  const copy = element.cloneNode(true) as HTMLElement;
  const original = [element, ...element.querySelectorAll<HTMLElement>('*')];
  const cloned = [copy, ...copy.querySelectorAll<HTMLElement>('*')];
  original.forEach((item, index) => {
    const clone = cloned[index], computed = getComputedStyle(item);
    for (let i = 0; i < computed.length; i++) { const property = computed[i]; clone.style.setProperty(property, computed.getPropertyValue(property)); }
    clone.style.setProperty('animation', 'none', 'important'); clone.style.setProperty('transition', 'none', 'important');
    clone.removeAttribute('id'); clone.removeAttribute('autofocus');
  });
  copy.inert = true; return copy;
}
function snapshotNavigation(): HTMLElement | null {
  const nav = document.querySelector<HTMLElement>('#nd-nav');
  if (!nav) return null;
  try {
    const box = nav.getBoundingClientRect(), copy = frozenCopy(nav);
    // The copied header must not refract the simultaneously fading page below it.
    for (const item of [copy, ...copy.querySelectorAll<HTMLElement>('*')]) {
      item.style.setProperty('backdrop-filter', 'none'); item.style.setProperty('-webkit-backdrop-filter', 'none');
    }
    Object.assign(copy.style, { position: 'absolute', left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px`, margin: '0', transform: 'none', zIndex: '2', backgroundColor: 'var(--color-fd-background)' });
    copy.dataset.transitionNavigation = ''; return copy;
  } catch { return null; }
}
function snapshotHome(navBottom: number): HTMLDivElement | null {
  const home = document.querySelector<HTMLElement>('[data-home-hero]')?.parentElement;
  if (!home) return null;
  try {
    const box = home.getBoundingClientRect(), snapshot = document.createElement('div');
    snapshot.className = styles.snapshot; snapshot.dataset.transitionSnapshot = '';
    snapshot.style.top = `${navBottom}px`; snapshot.inert = true;
    const background = document.querySelector<HTMLCanvasElement>('[data-home-phase] canvas');
    if (background) {
      const pixels = document.createElement('canvas'); pixels.width = background.width; pixels.height = background.height;
      pixels.getContext('2d')?.drawImage(background, 0, 0);
      Object.assign(pixels.style, { position: 'absolute', top: `${-navBottom}px`, left: '0', width: `${window.innerWidth}px`, height: `${window.innerHeight}px` });
      snapshot.appendChild(pixels);
    }
    const copy = frozenCopy(home);
    Object.assign(copy.style, { position: 'absolute', left: `${box.left}px`, top: `${box.top - navBottom}px`, width: `${box.width}px`, height: `${box.height}px`, margin: '0' });
    snapshot.appendChild(copy); return snapshot;
  } catch { return null; }
}

export function MapTransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter(), pathname = usePathname();
  const { showExpanded } = useHomeScene();
  const [state, setState] = useState<{ map: TransitionMap; destination: TransitionDestination; phase: MapTransitionPhase } | null>(null);
  const run = useRef<Run | null>(null), host = useRef<HTMLDivElement>(null), surface = useRef<HTMLDivElement>(null);

  const finish = useCallback((focus = false) => {
    const current = run.current; if (!current) return;
    cancelAnimationFrame(current.frame); clearTimeout(current.timeout);
    current.snapshot?.remove(); current.chrome?.remove();
    if (current.content) current.content.style.setProperty('opacity', current.contentOpacity);
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
    // Local digital fragments stay outside the letters; no page-sized paint.
    ctx.clearRect(0, 0, width, height);
    if (!current.current) return;
    const timing = transitionTiming(current.destination), progress = Math.min(1, elapsed / timing.arrival);
    const forward = current.destination !== 'home';
    const alpha = current.phase === 'arriving' ? forward ? 1 - progress ** 3 : Math.max(0, 1 - progress / .7) : Math.min(1, elapsed / 70);
    const anchor = current.current, textWidth = anchor.fontSize * mapTransitionNames[current.map].length;
    const count = width < 768 ? Math.ceil(timing.particles * .6) : timing.particles;
    ctx.save(); ctx.beginPath(); ctx.rect(0, current.navBottom + 1, width, height); ctx.clip();
    for (let i = 0; i < count; i++) {
      const seed = ((i * 37 + 17) % 97) / 97;
      const side = i % 2 ? -1 : 1;
      const flow = forward ? ((seed + (performance.now() - current.created) / 1500) % 1) : seed;
      const x = anchor.x - 14 + flow * (textWidth + 28);
      const y = anchor.y + (side < 0 ? -9 : anchor.lineHeight + 9) + Math.sin((performance.now() - current.created) / 750 + i) * 1.5;
      const color = forward ? i % 3 === 0 ? '176,168,255' : mapTransitionColors[current.map] : i % 5 === 0 ? mapTransitionColors[current.map] : '176,168,255';
      const size = forward ? seed > .75 ? 3 : 2 : seed > .8 ? 2 : 1.5;
      const opacity = alpha * timing.particleAlpha * (forward ? .65 + seed * .35 : .5 + seed * .5);
      if (forward && i % 3 === 0) { ctx.fillStyle = `rgba(${color},${opacity * .12})`; ctx.fillRect(x - 2, y - 2, size + 4, size + 4); }
      ctx.fillStyle = `rgba(${color},${opacity})`; ctx.fillRect(x, y, size, size);
    }
    if (forward && current.entryBounds) {
      const box = current.entryBounds, perimeter = (box.width + box.height) * 2;
      const cue = current.phase === 'arriving' ? Math.max(0, 1 - elapsed / 180) : current.phase === 'waiting' ? .35 : Math.min(1, elapsed / 60);
      for (let i = 0; i < 24; i++) {
        const offset = ((i / 24 + (performance.now() - current.created) / 5000) % 1) * perimeter;
        let x = box.x, y = box.y;
        if (offset < box.width) x += offset;
        else if (offset < box.width + box.height) { x += box.width; y += offset - box.width; }
        else if (offset < box.width * 2 + box.height) { x += box.width * 2 + box.height - offset; y += box.height; }
        else y += perimeter - offset;
        ctx.fillStyle = `rgba(${mapTransitionColors[current.map]},${cue * .5})`; ctx.fillRect(x - 1, y - 1, 2, 2);
      }
    }
    ctx.restore();
  }, []);

  const animate = useCallback(function tick(now: number) {
    const current = run.current; if (!current) return;
    try {
      const elapsed = now - current.start, timing = transitionTiming(current.destination);
      if (current.ghost && current.from) {
        if (current.phase === 'departing') {
          paintTitle(current, current.snapshot ? current.from : titleFrame(current.from, { ...current.from, y: current.from.y - 3 }, elapsed / timing.departure));
          current.ghost.style.opacity = current.snapshot ? '1' : String(Math.max(.6, 1 - .4 * elapsed / timing.departure));
        } else if (current.phase === 'waiting') current.ghost.style.opacity = current.snapshot ? '1' : '.6';
        else if (current.arrivalFrom && current.to) {
          if (current.snapshot) {
            const progress = handoffProgress(elapsed);
            paintTitle(current, titleFrame(current.arrivalFrom, current.to, progress.title, true));
            current.ghost.style.opacity = '1'; current.snapshot.style.opacity = String(progress.source);
            current.snapshot.querySelector<HTMLElement>('[data-home-core]')?.style.setProperty('opacity', String(Math.max(0, 1 - elapsed / 100)));
            current.content?.style.setProperty('opacity', String(progress.content));
          } else {
            paintTitle(current, titleFrame(current.arrivalFrom, current.to, elapsed / timing.arrival));
            current.ghost.style.opacity = String(Math.min(1, elapsed / (current.destination === 'home' ? 60 : 100)));
          }
        }
      }
      draw(current, elapsed);
      if (current.phase === 'departing' && elapsed >= timing.departure) {
        current.phase = 'waiting'; if (current.ghost) current.ghost.style.opacity = current.snapshot ? '1' : '.6'; setState({ map: current.map, destination: current.destination, phase: 'waiting' });
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
    const entry = destination === 'home' ? null : anchor.matches('[data-home-map]') ? anchor : document.querySelector<HTMLElement>(`[data-home-map="${map}"]`);
    const source = destination === 'home' ? mapHeading() : entry?.querySelector<HTMLElement>('h2') ?? null;
    const from = titleAnchor(source, navBottom);
    const entryBounds = from && entry ? entry.getBoundingClientRect() : null;
    const snapshot = destination !== 'home' && from ? snapshotHome(navBottom) : null;
    if (snapshot) snapshot.querySelector<HTMLElement>(`[data-home-map="${map}"] h2`)?.style.setProperty('visibility', 'hidden');
    let ghost: HTMLDivElement | null = null;
    if (from && source) {
      ghost = document.createElement('div'); ghost.className = styles.flyingTitle; ghost.textContent = mapTransitionNames[map]; ghost.dataset.transitionTitle = map;
      const font = getComputedStyle(source); ghost.style.fontFamily = font.fontFamily; ghost.style.color = font.color;
    }
    const chrome = snapshot ? snapshotNavigation() : null;
    const current: Run = { map, destination, phase: 'departing', start: now, created: now, frame: 0, canvas, context, ghost, from, to: null, arrivalFrom: null, current: from, hidden: new Map(), snapshot, chrome, content: null, contentOpacity: '', entryBounds, ...target, navigated: false, width: 0, height: 0, returnOverflow: document.body.style.overflow, navBottom };
    try {
      if (snapshot) host.current.appendChild(snapshot);
      draw(current, 0); host.current.appendChild(canvas);
      if (ghost && source && from) { host.current.appendChild(ghost); paintTitle(current, from); hideTitle(current, source); }
      if (chrome) host.current.appendChild(chrome);
      if (snapshot) {
        const home = document.querySelector<HTMLElement>('[data-home-hero]')?.parentElement;
        const field = document.querySelector<HTMLElement>('[data-home-phase] canvas');
        if (home) hideTitle(current, home);
        if (field) hideTitle(current, field);
      }
      run.current = current; document.body.style.overflow = 'hidden'; if (surface.current) surface.current.inert = true;
      current.start = performance.now();
      setState({ map, destination, phase: 'departing' });
      current.frame = requestAnimationFrame(animate);
      return true;
    } catch { run.current = current; finish(); return false; }
  }, [animate, draw, finish, router, showExpanded]);
  const begin = useCallback((map: TransitionMap, anchor: HTMLAnchorElement, event: MouseEvent<HTMLAnchorElement>) => start(map, anchor, event), [start]);
  const captureNavigation = (event: MouseEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Element)) return;
    const anchor = event.target.closest<HTMLAnchorElement>('a[href]');
    if (!anchor) return;
    if (mapTransitionTarget('home', anchor.href, window.location.origin, basePath) && start('home', anchor, event)) { event.preventDefault(); return; }
    // Both homepage cards and header links enter through this capture handler.
    if (isHomeRoute(window.location.pathname, basePath)) {
      const map = homeMapLink(anchor.href, window.location.origin, basePath);
      if (map && start(map, anchor, event)) event.preventDefault();
    }
  };

  const arrive = useCallback((destination: TransitionDestination) => {
    const current = run.current;
    if (!current || !current.navigated || current.destination !== destination || current.phase !== 'waiting') return;
    const arrivingTitle = destination === 'home' ? document.querySelector<HTMLElement>(`[data-home-map="${current.map}"] h2`) : mapHeading();
    if (current.snapshot && current.ghost && current.from && arrivingTitle) {
      // Keep the outgoing page and label visible through the route commit.
      // Measure before paint; the target content then crossfades below the label.
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      const to = titleAnchor(arrivingTitle, current.navBottom);
      if (to) {
        cancelAnimationFrame(current.frame); clearTimeout(current.timeout);
        current.to = to; current.arrivalFrom = current.current ?? current.from;
        current.content = arrivingTitle.closest<HTMLElement>('[data-map]');
        if (current.content) { current.contentOpacity = current.content.style.opacity; current.content.style.setProperty('opacity', '0'); }
        hideTitle(current, arrivingTitle);
        current.phase = 'arriving'; current.start = performance.now();
        setState({ map: current.map, destination, phase: 'arriving' }); current.frame = requestAnimationFrame(animate);
        return;
      }
    }
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
    if (!isTransitionPage(pathname, basePath)) finish();
  }, [pathname, finish]);

  return <Context value={{ begin, arrive, prefetch }}>
    <div ref={surface} className={styles.surface} inert={!!state} aria-busy={!!state} data-transition-shared={state && run.current?.snapshot ? '' : undefined} data-transition-phase={state?.phase} data-transition-map={state?.map} data-transition-destination={state?.destination} onClickCapture={captureNavigation}>{children}</div>
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
