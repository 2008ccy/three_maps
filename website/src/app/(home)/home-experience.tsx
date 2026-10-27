'use client';

import { useLayoutEffect, useRef, type ReactNode, type MouseEvent } from 'react';
import { ArrowDown, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';
import { useHomeScene } from '@/components/home-scene-state';
import { DigitalParticleField } from './home-particles';
import { maps } from './home-content';
import styles from './home.module.css';

export function HomeSceneLayout({ children }: { children: ReactNode }) {
  const { phase } = useHomeScene();
  const shell = useRef<HTMLDivElement>(null);
  const options = baseOptions();
  useLayoutEffect(() => {
    const header = shell.current?.querySelector<HTMLElement>('#nd-nav');
    if (header) { header.inert = phase !== 'expanded'; header.setAttribute('aria-hidden', String(phase !== 'expanded')); }
  }, [phase]);
  return <div ref={shell} className={styles.shell} data-home-phase={phase}>
    <DigitalParticleField phase={phase} />
    <HomeLayout {...options} nav={{ ...options.nav, enabled: phase !== 'intro' }}>{children}</HomeLayout>
  </div>;
}

export function HomeExperience({ children }: { children: ReactNode }) {
  const { phase, activated } = useHomeScene();
  return <div className={styles.home} data-phase={phase}>
    {children}
    <p className={styles.srOnly} role="status" aria-live="polite">{phase === 'expanded' && activated ? '三张地图已展开' : ''}</p>
  </div>;
}

export function HomeCore({ children }: { children: ReactNode }) {
  const { phase, ready, reducedMotion, activate } = useHomeScene();
  const core = useRef<HTMLDivElement>(null);
  const origin = useRef<DOMRect | null>(null);
  const requested = useRef(false);
  const motion = useRef<Animation | undefined>(undefined);

  useLayoutEffect(() => {
    if (phase === 'revealing' && origin.current && core.current && !reducedMotion) {
      const destination = core.current.getBoundingClientRect();
      try {
        motion.current = core.current.animate([
          { transform: `translate(${origin.current.left - destination.left}px, ${origin.current.top - destination.top}px)` },
          { transform: 'translate(0, 0)' },
        ], { duration: 500, delay: 100, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'backwards' });
      } catch { /* 无 Web Animations API 时直接使用最终布局。 */ }
      origin.current = null;
    }
    if (phase === 'expanded') {
      motion.current?.cancel();
      if (requested.current) {
        document.querySelector<HTMLAnchorElement>('[data-home-map="domain"]')?.focus({ preventScroll: true });
        requested.current = false;
      }
    }
    return () => { motion.current?.cancel(); };
  }, [phase, reducedMotion]);

  function awaken() {
    if (phase !== 'intro' || !ready) return;
    origin.current = core.current?.getBoundingClientRect() ?? null;
    requested.current = true;
    activate();
  }

  return <div ref={core} className={styles.frame} data-home-core>
    {children}
    {phase === 'intro' && <>
      <span id="home-activation-hint" className={styles.activationHint}><span aria-hidden="true" />点击展开三张地图<ArrowUpRight size={14} aria-hidden="true" /></span>
      <button type="button" className={styles.activate} aria-label="展开三张地图" aria-describedby="home-title home-activation-hint" disabled={!ready} onClick={awaken} />
    </>}
    <noscript><nav className={styles.noScript} aria-label="直接进入地图">{maps.map((map) => <Link href={map.href} key={map.id}>{map.name}<ArrowUpRight size={13} aria-hidden="true" /></Link>)}</nav><style>{`.${styles.activate}, .${styles.activationHint} { display: none !important; }`}</style></noscript>
  </div>;
}

// 探索路线仍暂停展示，保留组件供后续新版使用。
export function ScrollCue() {
  function scrollToExplore(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    const section = document.getElementById('explore');
    if (!section) return;
    event.preventDefault();
    section.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    section.focus({ preventScroll: true });
  }
  return <a href="#explore" className={styles.scrollCue} onClick={scrollToExplore}>从一个问题，继续探索 <ArrowDown size={15} aria-hidden="true" /></a>;
}
