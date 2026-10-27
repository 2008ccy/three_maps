'use client';

import Link from 'next/link';
import { ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Check, ChevronDown, Layers3, Minus, Plus, RotateCcw, X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import { findPath, nodeSide, stateForNode, stateFromHash, stateHash, toggleBranch } from '@/lib/maps/state';
import type { DocumentRef, MapDefinition, MapKey, MapLinks, MapNode, MapState } from '@/lib/maps/types';
import styles from './maps.module.css';

const keyOf = (ref: DocumentRef) => `${ref.id}${ref.anchor ? `#${ref.anchor}` : ''}`;
const overview: MapState = { expanded: [], selected: null };
const mapTabs = [{ id: 'domain', title: '领域' }, { id: 'ecosystem', title: '生态' }, { id: 'cognition', title: '认知' }];

function NodeReading({ node, links, mapId, onNavigate }: { node: MapNode; links: MapLinks; mapId?: MapKey; onNavigate?: (id: string) => void }) {
  return <>
    <p className={styles.readingSummary}>{node.summary}</p>
    <p className={styles.readingText}>{node.detail}</p>
    {node.boundary && <div className={styles.boundary}><span>理解与使用边界</span><p>{node.boundary}</p></div>}
    <div className={styles.sources} aria-label="内容来源"><span>依据</span>{node.sources.map((id) => <Link key={id} href={`/docs/sources/#${id.toLowerCase()}`}>{id}<ArrowUpRight size={11} aria-hidden /></Link>)}</div>
    {!!node.relations?.length && <section className={styles.relations} aria-label="跨图关联">
      <h3>沿着关系继续看</h3>
      {node.relations.map((relation) => {
        const link = links[`relation:${relation.map}:${relation.node}`];
        return <Link href={link.href} key={link.href} onClick={onNavigate && relation.map === mapId ? (event) => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault(); onNavigate(relation.node);
        } : undefined}><span>{relation.label}</span><strong>{link.title}<ArrowUpRight size={14} aria-hidden /></strong></Link>;
      })}
    </section>}
    <section className={styles.documents} aria-label="完整正文">
      <h3><BookOpen size={15} aria-hidden />查看完整正文</h3>
      {node.documents.map((ref) => { const link = links[keyOf(ref)]; return <Link key={keyOf(ref)} href={link.href}>{link.title}<ArrowUpRight size={14} aria-hidden /></Link>; })}
    </section>
  </>;
}

// 首次服务端输出的层级内容也能在没有 JavaScript 的环境中展开、阅读和跳转。
function Outline({ nodes, links }: { nodes: MapNode[]; links: MapLinks }) {
  return <div className={styles.outline}>{nodes.map((node) => <details key={node.id} id={`node-${node.id}`}>
    <summary>{node.title}<span>{node.summary}</span></summary>
    {node.children ? <><p>{node.detail}</p><Outline nodes={node.children} links={links} /><Link href={links[keyOf(node.documents[0])].href}>查看本主题正文 ↗</Link></> : <NodeReading node={node} links={links} />}
  </details>)}</div>;
}

type Connector = { id: string; d: string; x: number; y: number };

function useConnectors(stage: React.RefObject<HTMLDivElement | null>, ready: boolean) {
  const [lines, setLines] = useState<Connector[]>([]);
  useLayoutEffect(() => {
    const root = stage.current;
    if (!ready || !root) return;
    let frame = 0;
    const measure = () => {
      const bounds = root.getBoundingClientRect();
      const center = root.querySelector<HTMLElement>('[data-map-center]')!.getBoundingClientRect();
      const mobile = window.matchMedia('(max-width: 760px)').matches;
      setLines(Array.from(root.querySelectorAll<HTMLElement>('[data-map-branch]')).map((element) => {
        const box = element.getBoundingClientRect();
        if (mobile) {
          const x1 = center.left + 10 - bounds.left;
          const y1 = center.bottom - bounds.top;
          const x2 = box.left - bounds.left;
          const y2 = box.top + box.height / 2 - bounds.top;
          return { id: element.dataset.mapBranch!, d: `M ${x1} ${y1} V ${y2 - 8} Q ${x1} ${y2}, ${x1 + 8} ${y2} H ${x2}`, x: x2, y: y2 };
        }
        const left = box.left < center.left;
        const x1 = (left ? center.left : center.right) - bounds.left;
        const y1 = center.top + center.height / 2 - bounds.top;
        const x2 = (left ? box.right : box.left) - bounds.left;
        const y2 = box.top + box.height / 2 - bounds.top;
        const middle = (x1 + x2) / 2;
        return { id: element.dataset.mapBranch!, d: `M ${x1} ${y1} C ${middle} ${y1}, ${middle} ${y2}, ${x2} ${y2}`, x: x2, y: y2 };
      }));
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(schedule);
    observer.observe(root);
    // 字体放大、内容展开、面板改变可用宽度时按实际节点边界重算。
    root.querySelectorAll('[data-map-column], [data-map-center], [data-map-branch]').forEach((node) => observer.observe(node));
    window.addEventListener('resize', schedule);
    schedule();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); window.removeEventListener('resize', schedule); };
  }, [ready, stage]);
  return lines;
}

export function MapExplorer({ map, links }: { map: MapDefinition; links: MapLinks }) {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<MapState>(overview);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const background = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const panelTitle = useRef<HTMLHeadingElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const lines = useConnectors(stage, ready);
  const path = state.selected ? findPath(map.branches, state.selected) : undefined;
  const selected = path?.at(-1);
  const readingSide = selected ? nodeSide(map.branches, selected.id) : undefined;
  const split = Math.ceil(map.branches.length / 2);

  useEffect(() => {
    setReady(true);
    const read = () => setState(stateFromHash(map.branches, window.location.hash));
    const media = window.matchMedia('(max-width: 1100px)');
    const resize = () => setMobilePanel(media.matches);
    read(); resize();
    window.addEventListener('hashchange', read);
    window.addEventListener('popstate', read);
    media.addEventListener('change', resize);
    return () => { window.removeEventListener('hashchange', read); window.removeEventListener('popstate', read); media.removeEventListener('change', resize); };
  }, [map]);

  const update = useCallback((next: MapState) => {
    setState(next);
    const hash = stateHash(next);
    if (window.location.hash !== hash) window.history.pushState(null, '', `${window.location.pathname}${window.location.search}${hash}`);
  }, []);

  const close = useCallback(() => {
    update({ expanded: state.expanded, selected: null });
    requestAnimationFrame(() => {
      const target = returnFocus.current?.isConnected ? returnFocus.current : document.getElementById(`node-${state.selected}`);
      target?.focus({ preventScroll: true });
    });
  }, [state, update]);

  useEffect(() => {
    if (!selected) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById(`node-${selected.id}`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      panelTitle.current?.focus({ preventScroll: true });
      if (panel.current) panel.current.scrollTop = 0;
    });
    return () => cancelAnimationFrame(frame);
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    const previousOverflow = document.body.style.overflow;
    if (mobilePanel) {
      document.body.style.overflow = 'hidden';
      if (background.current) background.current.inert = true;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.key !== 'Tab' || !mobilePanel) return;
      const focusable = Array.from(panel.current?.querySelectorAll<HTMLElement>('a[href], button') ?? []);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panelTitle.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    const backgroundElement = background.current;
    return () => { document.removeEventListener('keydown', onKey); if (mobilePanel) document.body.style.overflow = previousOverflow; if (backgroundElement) backgroundElement.inert = false; };
  }, [selected, mobilePanel, close]);

  const visitNode = (id: string) => {
    const node = findPath(map.branches, id)?.at(-1);
    if (!node) return;
    returnFocus.current = document.getElementById(`node-${node.id}`);
    update(stateForNode(map.branches, node.id));
    if (node.children) requestAnimationFrame(() => document.getElementById(`node-${node.id}`)?.focus());
  };

  const openNode = (node: MapNode) => {
    if (node.children) update(toggleBranch(map.branches, state, node.id));
    else visitNode(node.id);
  };

  const followNode = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (!ready || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); visitNode(id);
  };

  function children(nodes: MapNode[]) {
    return <ul className={styles.children}>{nodes.map((node) => {
      const expanded = state.expanded.includes(node.id);
      return <li key={node.id}>
        <button type="button" id={`node-${node.id}`} data-node={node.id} className={styles.childNode}
          aria-expanded={node.children ? expanded : undefined} aria-controls={node.children ? `children-${node.id}` : selected?.id === node.id ? 'map-reading-panel' : undefined}
          aria-pressed={!node.children ? selected?.id === node.id : undefined} onClick={() => openNode(node)}>
          <span>{node.title}</span>{node.children ? expanded ? <Minus size={14} aria-hidden /> : <Plus size={14} aria-hidden /> : <ArrowDownRight size={14} aria-hidden />}
        </button>
        {node.children && <div id={`children-${node.id}`} className={styles.reveal} data-open={expanded} aria-hidden={!expanded} inert={!expanded}><div className={styles.revealInner}>{children(node.children)}</div></div>}
      </li>;
    })}</ul>;
  }

  function column(nodes: MapNode[], side: string) {
    return <div className={styles.column} data-map-column data-side={side}>{nodes.map((node) => {
      const expanded = state.expanded.includes(node.id);
      const number = String(map.branches.indexOf(node) + 1).padStart(2, '0');
      return <section key={node.id} className={styles.branch} data-open={expanded} aria-label={node.title}
        onMouseEnter={() => setHighlight(node.id)} onMouseLeave={() => setHighlight(null)} onFocus={() => setHighlight(node.id)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setHighlight(null); }}>
        <button type="button" className={styles.branchNode} id={`node-${node.id}`} data-node={node.id} data-map-branch={node.id}
          aria-expanded={expanded} aria-controls={`children-${node.id}`} onClick={() => openNode(node)}>
          <span className={styles.branchNumber}>{number}</span><span className={styles.branchCopy}><strong>{node.title}</strong><span>{node.summary}</span></span>
          <span className={styles.expandIcon}>{expanded ? <Minus size={17} aria-hidden /> : <Plus size={17} aria-hidden />}</span>
        </button>
        <div id={`children-${node.id}`} className={styles.reveal} data-open={expanded} aria-hidden={!expanded} inert={!expanded}><div className={styles.revealInner}><div className={styles.branchContents}>{children(node.children!)}<Link className={styles.branchDocument} href={links[keyOf(node.documents[0])].href}>本主题正文<ArrowUpRight size={12} aria-hidden /></Link></div></div></div>
      </section>;
    })}</div>;
  }

  return <div className={styles.map} data-map={map.id}>
    <div className={styles.workspace} data-reading={!!selected} data-reading-side={readingSide}>
      <div className={styles.explorer} ref={background}>
        <header className={styles.toolbar}>
          <Link href="/" className={styles.homeLink}><ArrowLeft size={15} aria-hidden />首页</Link>
          <nav className={styles.mapTabs} aria-label="切换地图">{mapTabs.map((tab) => <Link key={tab.id} href={`/docs/${tab.id}/`} aria-current={map.id === tab.id ? 'page' : undefined}>{tab.title}</Link>)}</nav>
          {ready && <button className={styles.reset} type="button" onClick={() => { update(overview); document.getElementById('map-title')?.focus(); }}><RotateCcw size={14} aria-hidden />回到总览</button>}
        </header>

        {ready ? <>
          <div className={styles.mapIntro}><span><Layers3 size={14} aria-hidden />三图探索 / {map.number}</span><p>点击分支展开 · 点击要点阅读</p></div>
          <div className={styles.viewport}><div className={styles.stage} ref={stage}>
            <svg className={styles.connectors} aria-hidden="true">{lines.map((line) => <g key={line.id} data-active={highlight === line.id || state.expanded[0] === line.id}><path d={line.d} /><circle cx={line.x} cy={line.y} r="2.5" /></g>)}</svg>
            <div className={styles.center} data-map-center>
              <span className={styles.centerLabel}><span />THREE LIVING MAPS</span>
              <h1 id="map-title" tabIndex={-1}>{map.title}</h1><p>{map.question}</p>
              <span className={styles.centerHint}>{map.branches.length} 条主干 · 逐层探索</span>
            </div>
            {column(map.branches.slice(0, split), 'left')}
            {column(map.branches.slice(split), 'right')}
          </div></div>
        </> : <section className={styles.fallback} aria-label="地图层级内容"><h1>{map.title}</h1><p>{map.description}</p><p>展开主题查看要点，沿正文与来源继续阅读。</p><Outline nodes={map.branches} links={links} /></section>}

        {!!map.connections?.length && <section className={styles.feedback} aria-label="指导与反馈闭环">
          <h2>从判断到修正，再回到行动</h2>
          <p>虚线连接方法选择、案例反馈与习惯更新</p>
          <ul>{map.connections.map((connection) => {
            const from = findPath(map.branches, connection.from)!.at(-1)!;
            const to = findPath(map.branches, connection.to)!.at(-1)!;
            return <li key={`${connection.from}-${connection.to}`} data-connection={`${connection.from}:${connection.to}`}>
              <Link href={`/docs/${map.id}/#node-${from.id}`} onClick={(event) => followNode(event, from.id)}>{from.title}</Link>
              <span className={styles.feedbackArrow}><span>{connection.label}</span><ArrowRight size={15} aria-hidden /></span>
              <Link href={`/docs/${map.id}/#node-${to.id}`} onClick={(event) => followNode(event, to.id)}>{to.title}</Link>
            </li>;
          })}</ul>
        </section>}

        <footer className={styles.mapFooter}>
          <div className={styles.legend}><span />连线表示内容归属<span className={styles.legendDivider}>/</span><Check size={12} aria-hidden />每个要点保留依据</div>
          <details className={styles.auxiliary}><summary><BookOpen size={15} aria-hidden />完整主题与学习入口<ChevronDown size={14} aria-hidden /></summary><nav aria-label="辅助阅读入口">{map.auxiliary.map((ref) => <Link key={keyOf(ref)} href={links[keyOf(ref)].href}>{links[keyOf(ref)].title}<ArrowUpRight size={13} aria-hidden /></Link>)}</nav></details>
          <Link className={styles.allConnections} href="/docs/project/connections/">查看完整跨图关系<ArrowUpRight size={13} aria-hidden /></Link>
        </footer>
      </div>
      {selected && <>
        {mobilePanel && <div className={styles.scrim} aria-hidden="true" onClick={close} />}
        <aside key={readingSide} ref={panel} className={styles.panel} data-side={readingSide} id="map-reading-panel" role="dialog" aria-modal={mobilePanel || undefined} aria-labelledby="reading-title">
          <div className={styles.panelTop}><span>{map.title} / {path?.slice(0, -1).map((node) => node.title).join(' / ')}</span><button type="button" onClick={close} aria-label="关闭阅读面板"><X size={19} aria-hidden /></button></div>
          <h2 id="reading-title" ref={panelTitle} tabIndex={-1}>{selected.title}</h2>
          <NodeReading node={selected} links={links} mapId={map.id} onNavigate={visitNode} />
          <p className={styles.panelHint}>按 Esc 关闭，回到刚才的要点</p>
        </aside>
      </>}
    </div>
  </div>;
}
