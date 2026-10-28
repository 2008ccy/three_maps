'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { HOME_REVEAL_MS, isHomeRoute, rememberHomeExpanded, restoreHomePhase, type HomePhase } from '@/lib/home-scene';

type HomeSceneState = { phase: HomePhase; ready: boolean; reducedMotion: boolean; activated: boolean; isHome: boolean; activate: () => void; showExpanded: () => void };
const HomeSceneContext = createContext<HomeSceneState | null>(null);

export function HomeSceneProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isHome = isHomeRoute(pathname, process.env.NEXT_PUBLIC_BASE_PATH ?? '');
  const [phase, setPhase] = useState<HomePhase>('intro');
  const [ready, setReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [activated, setActivated] = useState(false);
  const phaseRef = useRef<HomePhase>('intro');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const finish = useCallback(() => {
    clearTimeout(timer.current);
    phaseRef.current = 'expanded';
    setPhase('expanded');
  }, []);

  useEffect(() => {
    let restored: HomePhase = 'intro';
    try { restored = restoreHomePhase(window.sessionStorage); } catch { /* Storage getter may be blocked. */ }
    phaseRef.current = restored;
    setPhase(restored);
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => {
      setReducedMotion(media.matches);
      if (media.matches && phaseRef.current === 'revealing') finish();
    };
    updateMotion();
    setReady(true);
    media.addEventListener('change', updateMotion);
    return () => { clearTimeout(timer.current); media.removeEventListener('change', updateMotion); };
  }, [finish]);

  useEffect(() => {
    // 导航中途离开首页时，回来直接显示已展开的状态。
    if (!isHome && phaseRef.current === 'revealing') finish();
  }, [isHome, finish]);

  const activate = useCallback(() => {
    if (!ready || phaseRef.current !== 'intro') return;
    setActivated(true);
    try { rememberHomeExpanded(window.sessionStorage); } catch { /* 内存状态不依赖存储成功。 */ }
    if (reducedMotion) { finish(); return; }
    phaseRef.current = 'revealing';
    setPhase('revealing');
    timer.current = setTimeout(finish, HOME_REVEAL_MS);
  }, [ready, reducedMotion, finish]);

  const showExpanded = useCallback(() => {
    setActivated(false);
    try { rememberHomeExpanded(window.sessionStorage); } catch { /* Return remains usable with blocked storage. */ }
    finish();
  }, [finish]);

  return <HomeSceneContext value={{ phase, ready, reducedMotion, activated, isHome, activate, showExpanded }}>{children}</HomeSceneContext>;
}

export function useHomeScene() {
  const value = useContext(HomeSceneContext);
  if (!value) throw new Error('HomeSceneProvider is required');
  return value;
}
