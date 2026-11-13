'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ArrowLeft, ArrowRight, ArrowUpRight, Network, Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MapDefinition } from '@/lib/maps/types';
import { emptyFilters, filterCatalog, understandingOptions, verificationOptions, type CatalogFilters } from '@/lib/maps/catalog';
import { buildAtlas, resolveRef, type NodeRef } from '@/lib/maps/expanded-graph';
import { explorerUrl, initialExplorerState, readExplorerState, type ExplorerState } from '@/lib/maps/explorer-state';
import { feedbackComposeHref } from '@/lib/feedback-contract';
import { appLocationChangeEvent } from '@/lib/document-navigation';
import { ReadingToc } from '@/components/reading-navigation';
import { MapReading } from './map-reading';
import learningOverrides from '../../../card-editor/overrides.json';
import styles from './maps.module.css';
import radial from './radial-graph.module.css';

const RadialGraph = dynamic(() => import('./radial-graph').then(module => module.RadialGraph), { loading: () => <p role="status">正在加载关系图…</p> });
type Props = { map: MapDefinition; maps: MapDefinition[]; statuses: Record<string, string>; sourceTitles: Record<string, string> };

export function LearningExplorer({ map, maps, statuses, sourceTitles }: Props) {
  const atlas = useMemo(() => buildAtlas(maps, statuses, learningOverrides), [maps, statuses]);
  const nodes = atlas.catalogs.get(map.id)!;
  const localEdges = useMemo(() => atlas.edges.filter(edge => edge.sourceMap === map.id).map(edge => ({ ...edge, from: edge.from.slice(map.id.length + 1), to: edge.to.slice(edge.targetMap.length + 1) })), [atlas, map.id]);
  const [state, setState] = useState<ExplorerState>(initialExplorerState);
  const current = useRef(state); current.current = state;
  const [ready, setReady] = useState(false), [advanced, setAdvanced] = useState(false), [mobile, setMobile] = useState(false);
  const [mergedFrom, setMergedFrom] = useState(false);
  const background = useRef<HTMLDivElement>(null), panel = useRef<HTMLElement>(null), body = useRef<HTMLDivElement>(null), heading = useRef<HTMLHeadingElement>(null);
  const returnTarget = useRef<HTMLElement | null>(null), handledUrl = useRef('');
  const scrolls = useRef<Record<string, number>>({});
  const storageKey = 'three-maps-browse:' + map.id;
  const selected = resolveRef(atlas, state.selected);
  const selectedKey = selected ? `${selected.mapId}:${selected.id}` : '';
  const readingMap = selected ? maps.find(item => item.id === selected.mapId)! : map;
  const readingNodes = atlas.catalogs.get(readingMap.id)!;
  const path = readingMap.learningPath ?? [], position = selected ? path.indexOf(selected.id) : -1;
  const matches = useMemo(() => filterCatalog(nodes, state.filters, localEdges), [nodes, state.filters, localEdges]);
  const outside = selected?.mapId === map.id && !selected.collection && !matches.some(node => node.id === selected.id);
  const points = nodes.filter(node => node.parent);
  const concepts = localEdges.filter(edge => edge.targetMap === map.id && edge.kind !== 'hierarchy');
  const ecosystem = map.id === 'ecosystem', cognition = map.id === 'cognition';

  const navigate = useCallback((next: ExplorerState, replace = false) => {
    current.current = next; setState(next); setMergedFrom(false);
    const url = window.location.pathname + explorerUrl(next, map);
    handledUrl.current = url;
    if (url !== window.location.pathname + window.location.search + window.location.hash) window.history[replace ? 'replaceState' : 'pushState'](null, '', url);
  }, [map]);
  const remember = useCallback(() => {
    try { sessionStorage.setItem(storageKey, JSON.stringify({ url: window.location.pathname + window.location.search + window.location.hash, scroll: window.scrollY, panels: scrolls.current })); } catch { /* Optional browse memory. */ }
  }, [storageKey]);
  useEffect(() => {
    const read = () => {
      const url = window.location.pathname + window.location.search + window.location.hash;
      if (handledUrl.current === url) return;
      handledUrl.current = url;
      const next = readExplorerState(window.location.search, window.location.hash, map, atlas);
      if (Object.values(next.filters).some(Boolean)) next.expanded = [...new Set([...next.expanded, ...filterCatalog(nodes, next.filters, localEdges).map(node => node.groupId)])];
      const oldId = window.location.hash.startsWith('#node-') ? window.location.hash.slice(6) : '';
      setMergedFrom(!!oldId && !!next.selected && oldId !== next.selected.nodeId);
      current.current = next; setState(next);
      setAdvanced(!!(next.filters.type || next.filters.understanding || next.filters.verification));
    };
    const sync = () => {
      if (window.location.pathname.replace(/\/$/, '') === `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/docs/${map.id}`) read();
    };
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null');
      if (saved?.panels && typeof saved.panels === 'object') scrolls.current = saved.panels;
      if (saved?.url === window.location.pathname + window.location.search + window.location.hash && Number.isFinite(saved.scroll)) requestAnimationFrame(() => window.scrollTo(0, saved.scroll));
    } catch { /* Reading remains usable without storage. */ }
    read(); setReady(true);
    const media = matchMedia('(max-width: 1023px)');
    const resize = () => setMobile(media.matches); resize();
    media.addEventListener('change', resize);
    window.addEventListener('popstate', sync); window.addEventListener('hashchange', sync); window.addEventListener(appLocationChangeEvent, sync); window.addEventListener('pagehide', remember);
    return () => { media.removeEventListener('change', resize); window.removeEventListener('popstate', sync); window.removeEventListener('hashchange', sync); window.removeEventListener(appLocationChangeEvent, sync); window.removeEventListener('pagehide', remember); };
  }, [atlas, map, nodes, localEdges, storageKey, remember]);

  const open = useCallback((ref: NodeRef) => {
    const node = resolveRef(atlas, ref); if (!node) return;
    returnTarget.current = document.activeElement as HTMLElement;
    const next = current.current;
    const expanded = node.mapId === map.id && !node.collection ? [...new Set([...next.expanded, node.groupId])] : next.expanded;
    scrolls.current[`${node.mapId}:${node.id}`] = 0;
    if (body.current) body.current.scrollTop = 0;
    navigate({ ...next, expanded, selected: { mapId: node.mapId, nodeId: node.id }, focus: `${node.mapId}:${node.id}` });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (matchMedia('(min-width: 1024px)').matches) background.current?.querySelector('[data-graph-viewport]')?.scrollIntoView({ block: 'center', behavior: 'instant' });
    }));
  }, [atlas, map.id, navigate]);
  const close = useCallback(() => {
    const ref = current.current.selected;
    navigate({ ...current.current, selected: null });
    requestAnimationFrame(() => {
      const original = returnTarget.current;
      const fallback = ref && document.getElementById(ref.mapId === map.id ? `node-${ref.nodeId}` : `node-${ref.mapId}-${ref.nodeId}`);
      (original?.isConnected && !panel.current?.contains(original) ? original : fallback ?? background.current?.querySelector<HTMLElement>('[data-graph-viewport]'))?.focus({ preventScroll: true });
    });
  }, [navigate, map.id]);
  const toggle = (id: string) => {
    const next = current.current, closing = next.expanded.includes(id);
    const selection = resolveRef(atlas, next.selected);
    navigate({ ...next, expanded: closing ? next.expanded.filter(value => value !== id) : [...next.expanded, id],
      selected: closing && selection?.mapId === map.id && selection.groupId === id ? null : next.selected, focus: closing ? '' : `${map.id}:${id}` });
  };
  const changeFilter = (key: keyof CatalogFilters, value: string) => {
    const filters = { ...current.current.filters, [key]: value };
    const expanded = [...new Set([...current.current.expanded, ...filterCatalog(nodes, filters, localEdges).map(node => node.groupId)])];
    navigate({ ...current.current, filters, expanded, focus: '' }, key === 'q');
  };
  useEffect(() => {
    if (!selectedKey) return;
    heading.current?.focus({ preventScroll: true });
    if (body.current) body.current.scrollTop = scrolls.current[selectedKey] ?? scrolls.current[selected?.id ?? ''] ?? 0;
  }, [selectedKey, selected?.id]);
  useEffect(() => {
    if (!selectedKey) return;
    const element = background.current, prior = document.body.style.overflow;
    if (mobile) { document.body.style.overflow = 'hidden'; if (element) element.inert = true; }
    const key = (event: KeyboardEvent) => {
      if (document.querySelector('dialog[open], [data-fd-search-dialog-input]')) return;
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (!mobile || event.key !== 'Tab') return;
      const focusable = Array.from(panel.current?.querySelectorAll<HTMLElement>('a[href],button,summary,[tabindex="0"]') ?? []).filter(item => !item.hasAttribute('disabled') && item.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === heading.current)) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); if (mobile) document.body.style.overflow = prior; if (element) element.inert = false; };
  }, [selectedKey, mobile, close]);

  function outline(items: MapDefinition['branches']) {
    return <div className={styles.outline}>{items.map(item => <details id={`node-${item.id}`} key={item.id}><summary>{item.title}<span>{item.summary}</span></summary><MapReading node={nodes.find(node => node.id === item.id)!} atlas={atlas} sourceTitles={sourceTitles} remember={remember} />{item.children && outline(item.children)}</details>)}</div>;
  }
  return <div className={`${styles.map} ${radial.workspace}`} data-map={map.id} data-learning="" data-reading={!!selected}>
    <div ref={background} className={radial.background}>
      <nav className={styles.breadcrumb} aria-label="面包屑"><Link href="/">首页</Link><span>/</span><span data-map={map.id} className="map-badge">{map.title}</span></nav>
      <header className={styles.domainIntro}><div><p className={styles.eyebrow}>模型构建 / 学习地图 <span>{map.number}</span></p><h1 id="map-title">{map.title}</h1><p>{map.question} {map.description}</p></div>{ready && <button type="button" className={styles.startLearning} onClick={() => { if (!state.expanded.includes(map.branches[0].id)) toggle(map.branches[0].id); background.current?.querySelector('[data-graph-viewport]')?.scrollIntoView({ block: 'center', behavior: 'instant' }); }}>从{map.branches[0].title}开始<ArrowRight size={17} /></button>}</header>
      <div className={styles.compactStats} aria-label="地图统计"><span><strong>{map.branches.length}</strong> 个主题</span><span><strong>{points.length}</strong> 个知识点</span><span><strong>{concepts.length}</strong> 条{ecosystem ? '生态' : cognition ? '知识与反馈' : '概念'}联系</span><details><summary>分类与跨图说明</summary><p>{localEdges.filter(edge => edge.kind === 'hierarchy').length} 条归属关系 · {localEdges.filter(edge => edge.targetMap !== map.id).length} 条跨图关系。{ecosystem ? '五主题保留课程助手的核心协作链：成果、运行、资料、验收与维护。适配按需、评测贯穿；旧地址定位到合并后的内容。' : cognition ? '四主题各保留三个核心条目，方法已融入案例；原有5条指导反馈保留，旧地址进入合并内容。求真观课堂正式名称仍待课件核验。' : '五主题为本网站的学习组织方式，新增节点不冒充原讲解稿的原始知识树。'}建议学习顺序不等于技术依赖。</p></details></div>
      <nav className={styles.mapFeedback} aria-label="整图反馈"><Link href={feedbackComposeHref({ mapId: map.id })} onClick={remember}>反馈这张地图<ArrowUpRight size={14} aria-hidden="true" /></Link></nav>
      {ready ? <>
        <section className={styles.domainToolbar} aria-label="筛选知识节点"><label className={styles.domainSearch}><Search size={17} /><span className={styles.srOnly}>关键词</span><input type="search" placeholder="搜索概念、解释或教学示例…" value={state.filters.q} onChange={event => changeFilter('q', event.target.value)} /></label><details open={advanced} onToggle={event => setAdvanced(event.currentTarget.open)} className={styles.advancedFilters}><summary>高级筛选{state.filters.type || state.filters.understanding || state.filters.verification ? ' · 已启用' : ''}</summary><div className={styles.filterFields}>
          <label>类型<select aria-label="类型" value={state.filters.type} onChange={event => changeFilter('type', event.target.value)}><option value="">全部类型</option>{[...new Set(nodes.map(node => node.type))].map(type => <option key={type}>{type}</option>)}</select></label>
          <label>学习状态<select aria-label="学习状态" value={state.filters.understanding} onChange={event => changeFilter('understanding', event.target.value)}><option value="">全部学习状态</option>{understandingOptions.map(value => <option key={value}>{value}</option>)}</select></label>
          <label>核实状态<select aria-label="核实状态" value={state.filters.verification} onChange={event => changeFilter('verification', event.target.value)}><option value="">全部状态</option>{verificationOptions.map(value => <option key={value}>{value}</option>)}</select></label>
          <p>学习状态由项目维护者记录。可按学习状态、核实状态筛选，也可直接搜索标签文字。</p></div></details><button type="button" className={styles.resetDomain} onClick={() => navigate({ ...state, filters: emptyFilters })}>重置筛选</button></section>
        <div className={styles.viewBar}><span className={radial.viewLabel}><Network size={16} />关系图<span>由中心向外，沿联系探索</span></span><p aria-live="polite">{new Set(matches.map(node => node.groupId)).size} 个主题 · 匹配 {matches.filter(node => node.parent).length} / {points.length} 个知识点</p></div>
        {!matches.length && !outside ? <div className={styles.empty}><Search size={28} /><h2>没有找到匹配的知识点</h2><p>换个关键词，或清除筛选继续探索。</p><button type="button" onClick={() => navigate({ ...state, filters: emptyFilters })}>清除筛选</button></div> : <RadialGraph atlas={atlas} map={map} matches={matches} expanded={state.expanded} selected={state.selected} focus={state.focus} scope={state.scope}
          onScope={scope => navigate({ ...state, scope })} onSelect={open} onToggle={toggle} onCollapse={() => navigate({ ...state, expanded: [], selected: null, focus: '', filters: emptyFilters })} />}
      </> : <section aria-label="地图层级内容"><p className={styles.notice}>展开主题和知识点，阅读解释、教学示例、关系与来源。</p>{outline(map.branches)}{!!map.legacyCollections?.length && <section className={styles.legacyOutline} aria-label="旧分类专题"><h2>旧分类专题</h2>{map.legacyCollections.map(collection => <details id={`node-${collection.id}`} key={collection.id}><summary>{collection.title}</summary><p>旧分类内容已并入核心主题，本入口不计入统计。</p><ul>{collection.members.map(id => <li key={id}><Link href={`/docs/${map.id}/#node-${id}`}>{nodes.find(node => node.id === id)?.title}</Link></li>)}</ul></details>)}</section>}{!!map.nodeAliases && <details className={styles.legacyOutline}><summary>旧条目与合并位置</summary><ul>{Object.entries(map.nodeAliases).map(([oldId, targetId]) => <li id={`node-${oldId}`} key={oldId}><Link href={`/docs/${map.id}/#node-${targetId}`}>{oldId} → {nodes.find(node => node.id === targetId)?.title}</Link></li>)}</ul></details>}</section>}
    </div>
    {selected && <>{mobile && <div className={radial.scrim} onClick={close} aria-hidden="true" />}<aside ref={panel} id="map-reading-panel" className={radial.reader} data-map={selected.mapId} role={mobile ? 'dialog' : 'complementary'} aria-modal={mobile || undefined} aria-labelledby="reading-title">
      <header className={styles.domainPanelTop}><div><span>{readingMap.title}{selected.path.length > 0 && ` / ${selected.path.join(' / ')}`}</span>{selected.parent && <button type="button" onClick={() => open({ mapId: selected.mapId, nodeId: selected.parent! })} aria-label="返回上一层"><ArrowLeft size={14} />返回主题</button>}</div><button type="button" aria-label="关闭阅读面板" onClick={close}><X size={21} /></button></header>
      <div ref={body} data-reader-scroll="" className={`${styles.domainPanelBody} ${radial.readerBody}`} onScroll={event => { scrolls.current[selectedKey] = event.currentTarget.scrollTop; }}>
        <div className={styles.domainReadingColumn}><p className={styles.lessonRole}>{selected.mapId === 'ecosystem' && selected.parent && selected.type + ' · '}{selected.lesson?.role ?? '主题导读'}{position >= 0 && ` · 学习路线 ${position + 1} / ${path.length}`}</p><h2 ref={heading} id="reading-title" tabIndex={-1}>{selected.title}</h2>
          {selected.mapId !== map.id && <div className={radial.crossNotice}><span>正在查看跨图关联内容</span><Link href={`/docs/${selected.mapId}/#node-${selected.id}`} onClick={remember}>进入{readingMap.title}<ArrowUpRight size={14} /></Link></div>}
          {outside && <p className={styles.notice}>当前节点不在筛选结果内，已临时显示。<button type="button" onClick={() => navigate({ ...state, filters: emptyFilters })}>清除筛选查看全部</button></p>}
          {mergedFrom && <p className={styles.notice}>此旧条目已精简或合并，以下为当前保留的主题。扩展原稿已存入后续更新储备。</p>}
          {selected.lesson && <details className={radial.readerDirectory}><summary>本页目录</summary><ReadingToc key={selectedKey} panelId={selectedKey.replace(':', '-')} /></details>}
          <div data-reader-copy=""><MapReading key={selectedKey} node={selected} atlas={atlas} sourceTitles={sourceTitles} onOpen={open} remember={remember} /></div>
        </div>
      </div>
      <footer className={`${styles.lessonNavigation} ${radial.readerFooter}`}>{position >= 0 ? <><button type="button" disabled={position === 0} onClick={() => open({ mapId: selected.mapId, nodeId: path[position - 1] })}><ArrowLeft size={16} /><span>上一知识点<small>{readingNodes.find(node => node.id === path[position - 1])?.title ?? '学习起点'}</small></span></button><span>{position + 1}/{path.length}</span><button type="button" disabled={position === path.length - 1} onClick={() => open({ mapId: selected.mapId, nodeId: path[position + 1] })}><span>下一知识点<small>{readingNodes.find(node => node.id === path[position + 1])?.title ?? '路线结束'}</small></span><ArrowRight size={16} /></button></> : selected.children?.[0] ? <button type="button" onClick={() => open({ mapId: selected.mapId, nodeId: selected.children![0].id })}>从{selected.children[0].title}开始<ArrowRight size={16} /></button> : <span>按 Esc 关闭，继续探索地图</span>}</footer>
    </aside></>}
  </div>;
}
export const DomainExplorer = LearningExplorer;
