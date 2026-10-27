'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Check, ChevronDown, Grid2X2, Network, Search, SlidersHorizontal, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MapDefinition, MapLinks } from '@/lib/maps/types';
import { buildCatalog, buildEdges, catalogQuery, emptyFilters, filterCatalog, readCatalogQuery, understandingOptions, verificationOptions, type CatalogFilters, type CatalogNode } from '@/lib/maps/catalog';
import { CatalogGraph } from './catalog-graph';
import styles from './maps.module.css';

const keyOf = (ref: { id: string; anchor?: string }) => `${ref.id}${ref.anchor ? `#${ref.anchor}` : ''}`;
const journeys = { domain: '任务 → 数据 → 模型 → 训练 → 可用的系统', ecosystem: '研究与成果 → 开源工具与平台 → 应用与资源 → 使用反馈', cognition: '认识视角 → 分析方法 → 案例检验 → 认识修正 → 成长习惯' };

export function MapExplorer({ map, links, statuses = {}, sourceTitles = {} }: { map: MapDefinition; links: MapLinks; statuses?: Record<string, string>; sourceTitles?: Record<string, string> }) {
  const nodes = useMemo(() => buildCatalog(map, statuses), [map, statuses]);
  const edges = useMemo(() => buildEdges(map), [map]);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<'cards' | 'graph'>('cards');
  const [filters, setFilters] = useState<CatalogFilters>(emptyFilters);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const panel = useRef<HTMLElement>(null), panelTitle = useRef<HTMLHeadingElement>(null), background = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const selected = nodes.find((node) => node.id === selectedId);
  const matches = filterCatalog(nodes, filters);
  const outside = !!selected && !matches.some((node) => node.id === selected.id);
  const visible = outside ? [selected, ...matches] : matches;
  const localEdges = edges.filter((edge) => edge.targetMap === map.id);
  const storageKey = `three-maps-browse:${map.id}`;

  useEffect(() => {
    const read = () => {
      const query = readCatalogQuery(window.location.search);
      setView(query.view); setFilters(query.filters);
      const id = window.location.hash.startsWith('#node-') ? window.location.hash.slice(6) : '';
      setSelectedId(nodes.some((node) => node.id === id) ? id : null);
    };
    const media = window.matchMedia('(max-width: 1000px)');
    const resize = () => setMobile(media.matches);
    read(); resize(); setReady(true);
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null');
      if (saved?.url === window.location.pathname + window.location.search + window.location.hash) requestAnimationFrame(() => window.scrollTo(0, saved.scroll));
    } catch { /* Storage can be unavailable in private browsing. */ }
    window.addEventListener('popstate', read); window.addEventListener('hashchange', read); media.addEventListener('change', resize);
    return () => { window.removeEventListener('popstate', read); window.removeEventListener('hashchange', read); media.removeEventListener('change', resize); };
  }, [nodes, storageKey]);

  const navigate = useCallback((nextView: typeof view, nextFilters: CatalogFilters, id: string | null, replace = false) => {
    setView(nextView); setFilters(nextFilters); setSelectedId(id);
    const url = `${window.location.pathname}${catalogQuery(nextView, nextFilters)}${id ? `#node-${id}` : ''}`;
    if (url !== window.location.pathname + window.location.search + window.location.hash) window.history[replace ? 'replaceState' : 'pushState'](window.history.state, '', url);
  }, []);
  const open = (id: string) => { previousFocus.current = document.activeElement as HTMLElement; navigate(view, filters, id); };
  const close = useCallback(() => {
    navigate(view, filters, null);
    requestAnimationFrame(() => { const target = document.getElementById(`node-${selectedId}`) ?? previousFocus.current; if (target?.isConnected) (target.querySelector<HTMLElement>('button') ?? target).focus({ preventScroll: true }); });
  }, [navigate, view, filters, selectedId]);
  const remember = () => { try { sessionStorage.setItem(storageKey, JSON.stringify({ url: window.location.pathname + window.location.search + window.location.hash, scroll: window.scrollY })); } catch {} };
  useEffect(() => {
    if (!selected) return;
    panelTitle.current?.focus({ preventScroll: true }); if (panel.current) panel.current.scrollTop = 0;
    if (view === 'cards') {
      const frame = requestAnimationFrame(() => document.getElementById(`node-${selected.id}`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
      return () => cancelAnimationFrame(frame);
    }
  }, [selected, view]);
  useEffect(() => {
    if (!selected) return;
    const prior = document.body.style.overflow;
    if (mobile) { document.body.style.overflow = 'hidden'; if (background.current) background.current.inert = true; }
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.key !== 'Tab' || !mobile) return;
      const focusable = Array.from(panel.current?.querySelectorAll<HTMLElement>('a[href],button') ?? []);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panelTitle.current)) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', key);
    const element = background.current;
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = prior; if (element) element.inert = false; };
  }, [selected, mobile, close]);
  const changeFilter = (key: keyof CatalogFilters, value: string) => navigate(view, { ...filters, [key]: value }, selectedId, key === 'q');

  function reading(node: CatalogNode, interactive = true) {
    const relatedEdges = edges.filter((edge) => edge.from === node.id || edge.targetMap === map.id && edge.to === node.id);
    return <>
      <p className={styles.readingSummary}>{node.summary}</p>
      {node.detail !== node.summary && <p className={styles.readingText}>{node.detail}</p>}
      {node.boundary && <div className={styles.boundary}><span>理解与使用边界</span><p>{node.boundary}</p></div>}
      <div className={styles.badges}><span>{node.type}</span><span>{node.understanding}</span><span className={styles.pending}>{node.verification}</span></div>
      <section className={styles.sources} aria-label="内容来源"><h3>来源与依据</h3>{node.sources.map((id) => <Link key={id} href={`/docs/sources/#${id.toLowerCase()}`} onClick={remember}><span>{sourceTitles[id] ?? id}</span><small>{id}<ArrowUpRight size={12} /></small></Link>)}</section>
      {!!relatedEdges.length && <section className={styles.relations} aria-label="相关知识"><h3>沿着关系继续看</h3>{relatedEdges.map((edge) => {
        const outgoing = edge.from === node.id;
        const targetId = outgoing ? edge.to : edge.from;
        const targetMap = outgoing ? edge.targetMap : map.id;
        const target = nodes.find((item) => item.id === targetId && targetMap === map.id);
        const resolved = links[`relation:${targetMap}:${targetId}`];
        const href = targetMap === map.id ? `/docs/${map.id}/#node-${targetId}` : resolved?.href;
        if (!href) return null;
        return <Link href={href} key={`${edge.id}:${outgoing}`} onClick={(event) => { if (interactive && targetMap === map.id && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); open(targetId); } else remember(); }}><span>{outgoing ? edge.label : `来自「${target?.title}」：${edge.label}`}</span><strong>{target?.title ?? resolved?.title}<ArrowRight size={14} /></strong></Link>;
      })}</section>}
      <section className={styles.documents} aria-label="完整正文"><h3><BookOpen size={15} />完整正文</h3>{node.documents.map((ref) => <Link key={keyOf(ref)} href={links[keyOf(ref)].href} onClick={remember}>{links[keyOf(ref)].title}<ArrowUpRight size={15} /></Link>)}</section>
    </>;
  }

  function outline(items: MapDefinition['branches']) {
    return <div className={styles.outline}>{items.map((item) => <details id={`node-${item.id}`} key={item.id}><summary>{item.title}<span>{item.summary}</span></summary>{reading(nodes.find((node) => node.id === item.id)!, false)}{item.children && outline(item.children)}</details>)}</div>;
  }

  return <div className={styles.map} data-map={map.id}>
    <div className={styles.workspace} data-reading={!!selected} data-view={view}>
      <div className={styles.explorer} ref={background}>
        <nav className={styles.breadcrumb} aria-label="面包屑"><Link href="/">首页</Link><span>/</span><span>{map.title}</span></nav>
        <header className={styles.intro}><p className={styles.eyebrow}><Network size={15} /> THREE LIVING MAPS <span>/ {map.number}</span></p><h1 id="map-title">{map.title}</h1><p className={styles.description}>{map.question} {map.description}</p><p className={styles.journey}>{journeys[map.id]}</p></header>
        <div className={styles.stats} aria-label="地图统计"><div><strong>{nodes.length}</strong><span>知识节点</span></div><div><strong>{localEdges.length}</strong><span>图内关系</span></div><div><strong>{edges.length - localEdges.length}</strong><span>跨图关系</span></div><p>先找到感兴趣的条目，<br />再沿着关系深入理解。</p></div>
        {ready ? <>
          <section className={styles.filters} aria-label="筛选知识节点"><div className={styles.filterTitle}><SlidersHorizontal size={15} /><span>筛选与查找</span><button type="button" onClick={() => navigate(view, emptyFilters, selectedId)}>重置筛选</button></div><div className={styles.filterFields}>
            <label>类型<select value={filters.type} onChange={(event) => changeFilter('type', event.target.value)}><option value="">全部类型</option>{[...new Set(nodes.map((node) => node.type))].map((type) => <option key={type}>{type}</option>)}</select></label>
            <label>理解程度<select value={filters.understanding} onChange={(event) => changeFilter('understanding', event.target.value)}><option value="">全部程度</option>{understandingOptions.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label>核实状态<select value={filters.verification} onChange={(event) => changeFilter('verification', event.target.value)}><option value="">全部状态</option>{verificationOptions.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label className={styles.searchLabel}>关键词<span><Search size={16} /><input type="search" placeholder="搜索名称、解释或关键词…" value={filters.q} onChange={(event) => changeFilter('q', event.target.value)} /></span></label>
          </div></section>
          <div className={styles.viewBar}><div className={styles.viewTabs} role="group" aria-label="地图视图"><button type="button" aria-pressed={view === 'cards'} onClick={() => navigate('cards', filters, selectedId)}><Grid2X2 size={16} />卡片</button><button type="button" aria-pressed={view === 'graph'} onClick={() => navigate('graph', filters, selectedId)}><Network size={16} />关系图</button></div><p aria-live="polite">显示 <strong>{matches.length}</strong> / {nodes.length} 个节点</p></div>
          {outside && <p className={styles.notice}>当前节点不在筛选结果内，已临时显示。<button type="button" onClick={() => navigate(view, emptyFilters, selectedId)}>清除筛选查看全部</button></p>}
          {!visible.length ? <div className={styles.empty}><Search size={28} /><h2>没有找到匹配的知识点</h2><p>试试其他关键词，或清除筛选后继续探索。</p><button type="button" onClick={() => navigate(view, emptyFilters, null)}>清除筛选</button></div> : view === 'cards' ? <div className={styles.cardGrid}>{visible.map((node) => <article tabIndex={-1} id={`node-${node.id}`} key={node.id} className={styles.card} data-selected={selectedId === node.id}><div className={styles.cardTop}><span>{node.group}</span><code>{node.id}</code></div><h2>{node.title}</h2><p>{node.detail === node.summary ? node.summary : node.detail}</p><div className={styles.badges}><span>{node.type}</span><span>{node.understanding}</span><span className={styles.pending}>{node.verification}</span></div><button type="button" onClick={() => open(node.id)} aria-label={`查看详情：${node.title}`} aria-haspopup="dialog" aria-expanded={selectedId === node.id}>查看详情<ArrowRight size={16} /></button></article>)}</div> : <CatalogGraph nodes={visible} edges={localEdges} selected={selectedId} onSelect={open} />}
        </> : <section aria-label="地图层级内容"><p className={styles.notice}>展开条目阅读解释、关系和来源。</p>{outline(map.branches)}</section>}
        <footer className={styles.footer}><div><Check size={14} /><span>理解程度与核实状态分别记录，未知的地方继续保留。</span></div><details><summary><BookOpen size={16} />完整主题与学习入口<ChevronDown size={14} /></summary><nav aria-label="辅助阅读入口">{map.auxiliary.map((ref) => <Link key={keyOf(ref)} href={links[keyOf(ref)].href} onClick={remember}>{links[keyOf(ref)].title}<ArrowUpRight size={13} /></Link>)}</nav></details><Link href="/docs/project/connections/" onClick={remember}>查看完整跨图关系<ArrowUpRight size={14} /></Link></footer>
      </div>
      {selected && <>{mobile && <div className={styles.scrim} onClick={close} aria-hidden="true" />}<aside ref={panel} id="map-reading-panel" className={styles.panel} role="dialog" aria-modal={mobile || undefined} aria-labelledby="reading-title"><div className={styles.panelTop}><span>{map.title}{selected.path.length > 0 && ` / ${selected.path.join(' / ')}`}</span><button type="button" aria-label="关闭阅读面板" onClick={close}><X size={19} /></button></div><div className={styles.panelIdentity}><span>{selected.type}</span><code>{selected.id}</code></div><h2 ref={panelTitle} id="reading-title" tabIndex={-1}>{selected.title}</h2>{reading(selected)}<p className={styles.panelHint}>按 Esc 关闭，继续探索地图</p></aside></>}
    </div>
  </div>;
}
