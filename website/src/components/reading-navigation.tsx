'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { BookOpen, ListTree, Menu } from 'lucide-react';
import { NavigationDrawer } from './navigation-drawer';
import { withBasePath } from '@/lib/shared';
import { mapLabels, type MapKey } from '@/lib/map-labels';

export type Heading = { url: string; title: ReactNode; depth: number };

function ResponsiveRail({ label, side, children }: { label: string; side: 'left' | 'right'; children: ReactNode }) {
  return <div className={`reader-rail reader-rail-${side}`}>
    <div className="rail-desktop">{children}</div>
    <NavigationDrawer label={label} className="rail-trigger"
      icon={<>{side === 'left' ? <Menu size={16} /> : <ListTree size={16} />}{label}</>}>{children}</NavigationDrawer>
  </div>;
}

export function MapNavigation({ current, topics = [] }: {
  current?: MapKey; topics?: { title: string; href: string }[];
}) {
  return <ResponsiveRail side="left" label="地图分类"><nav className="map-directory" aria-label="地图分类">
    <h2>地图分类</h2>{mapLabels.map(({ id, title }) => <div key={id}>
      <Link href={`/docs/${id}/`} data-map={id} aria-current={id === current ? 'location' : undefined}><BookOpen size={15} />{title}</Link>
      {id === current && topics.map((item) => <a key={item.href} href={item.href.startsWith('/') ? withBasePath(item.href) : item.href} className="rail-topic">{item.title}</a>)}
    </div>)}</nav></ResponsiveRail>;
}

export function ReadingToc({ headings, panelId }: { headings?: Heading[]; panelId?: string }) {
  const [sections, setSections] = useState<Heading[]>([]);
  const [active, setActive] = useState('');
  useEffect(() => {
    const root = panelId ? document.querySelector<HTMLElement>('[data-reader-scroll]') : null;
    const article = root?.querySelector('[data-reader-copy]');
    const elements = headings ? headings.flatMap((item) => {
      const element = document.getElementById(decodeURIComponent(item.url.slice(1)));
      return element ? [element] : [];
    }) : Array.from(article?.querySelectorAll<HTMLElement>('h3:not(details h3), details:not(details details) > summary') ?? []);
    if (!headings) {
      setSections(elements.map((el, i) => {
        el.id = `lesson-${panelId}-section-${i}`;
        return { url: '#'+el.id, title: el.textContent, depth: 2 };
      }));
    }
    if (!elements.length) { setActive(''); return; }
    const offset = root ? 12 : 88;
    const update = () => {
      const top = (root?.getBoundingClientRect().top ?? 0) + offset;
      const last = elements.filter((el) => el.getBoundingClientRect().top <= top + 2).at(-1);
      setActive('#'+(last ?? elements[0]).id);
    };
    update();
    const observer = new IntersectionObserver(update, { root, rootMargin: `-${offset}px 0px -55% 0px` });
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [headings, panelId]);
  const items = headings ?? sections;
  if (!items.length) return null;
  return <ResponsiveRail side="right" label="本页目录"><nav className="reading-toc" aria-label="本页目录"><h2>本页目录</h2>
    {items.map((item) => <a key={item.url} data-depth={item.depth} href={item.url} aria-current={decodeURIComponent(item.url) === active ? 'location' : undefined}
      onClick={panelId ? (event) => {
        event.preventDefault();
        const el = document.getElementById(item.url.slice(1));
        el?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
      } : undefined}>{item.title}</a>)}
  </nav></ResponsiveRail>;
}
