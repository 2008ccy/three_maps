'use client';

import { useEffect, useRef, type ReactNode, type MouseEvent } from 'react';
import { ArrowDown } from 'lucide-react';
import styles from './home.module.css';

export function HomeExperience({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = root.current;
    if (!element) return;

    const header = document.getElementById('nd-nav');
    const updateHeader = () => {
      if (header) element.style.setProperty('--home-nav-height', `${header.getBoundingClientRect().height}px`);
    };
    updateHeader();
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateHeader) : null;
    if (header) resizeObserver?.observe(header);

    // 默认全部可见：JS 或观察器不可用时，静态页面仍能直接阅读。
    const items = Array.from(element.querySelectorAll<HTMLElement>('[data-reveal]'));
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let observer: IntersectionObserver | undefined;
    const configureReveal = () => {
      observer?.disconnect();
      items.forEach((item) => item.removeAttribute('data-reveal-state'));
      if (reducedMotion.matches || typeof IntersectionObserver === 'undefined') return;

      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          (entry.target as HTMLElement).dataset.revealState = 'visible';
          observer?.unobserve(entry.target);
        });
      }, { threshold: 0.08 });

      items.forEach((item) => {
        // 只隐藏还没进入视口的内容，避免刷新或锚点跳转时闪烁。
        if (item.getBoundingClientRect().top >= window.innerHeight) {
          item.dataset.revealState = 'pending';
          observer?.observe(item);
        }
      });
    };
    configureReveal();
    reducedMotion.addEventListener('change', configureReveal);
    return () => {
      observer?.disconnect();
      resizeObserver?.disconnect();
      reducedMotion.removeEventListener('change', configureReveal);
      items.forEach((item) => item.removeAttribute('data-reveal-state'));
    };
  }, []);

  return <div ref={root} className={styles.home}>{children}</div>;
}

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
