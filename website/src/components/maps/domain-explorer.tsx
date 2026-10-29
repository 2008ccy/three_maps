'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowRight, ArrowUpRight, Grid2X2, Network, Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MapDefinition, MapLinks } from '@/lib/maps/types';
import { buildCatalog, buildEdges, resolveCatalogNode, catalogChildren, catalogQuery, emptyFilters, filterCatalog, groupCatalog, readCatalogQuery, understandingOptions, verificationOptions, type CatalogFilters, type CatalogNode } from '@/lib/maps/catalog';
import { DomainLesson, DomainAdvanced } from './domain-lesson';
import { DomainGraph } from './domain-graph';
import { EcosystemGraph } from './ecosystem-graph';
import { teachingCase } from '@/lib/maps/teaching-case';
import styles from './maps.module.css';

type Props = { map: MapDefinition; links: MapLinks; statuses: Record<string, string>; sourceTitles: Record<string, string> };
function KnowledgeStatus({ node }: { node: CatalogNode }) {
  return <span className={styles.knowledgeStatus}>
    <span data-status="learning" title="来自原资料记录，不代表当前访问者的学习进度">学习状态：{node.understanding}</span>
    <span data-status="verification" data-verified={node.verification === '已核实'}>核实状态：{node.verification}</span>
  </span>;
}
export function LearningExplorer({ map, links, statuses, sourceTitles }: Props) {
  const ecosystem = map.id === 'ecosystem';
  const nodes = useMemo(() => buildCatalog(map, statuses), [map, statuses]);
  const edges = useMemo(() => buildEdges(map), [map]);
  const points = nodes.filter((node) => node.parent);
  const concepts = edges.filter((edge) => edge.targetMap === map.id && edge.kind === 'relation');
  const [ready, setReady] = useState(false), [view, setView] = useState<'cards' | 'graph'>('cards');
  const [stage, setStage] = useState('');
  const [scope, setScope] = useState<'core' | 'all'>('core');
  const [filters, setFilters] = useState<CatalogFilters>(emptyFilters), [advanced, setAdvanced] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const background = useRef<HTMLDivElement>(null), panel = useRef<HTMLElement>(null), body = useRef<HTMLDivElement>(null), heading = useRef<HTMLHeadingElement>(null);
  const scrolls = useRef<Record<string, number>>({});
  const selected = resolveCatalogNode(map, nodes, selectedId ?? '');
  const matches = filterCatalog(nodes, filters, ecosystem ? edges : []), filtersActive = Object.values(filters).some(Boolean);
  const outside = !!selected && !selected.collection && !matches.some((node) => node.id === selected.id);
  const visible = outside ? [selected, ...matches] : matches;
  const groups = groupCatalog(nodes, matches);
  if (selected && !selected.collection && !groups.some(({ root }) => root.id === selected.groupId)) {
    const context = groupCatalog(nodes, [selected])[0]; if (context) groups.unshift({ ...context, matches: [] });
  }
  const tone = (node: CatalogNode) => map.branches.findIndex((root) => root.id === node.groupId);
  const path = map.learningPath ?? [];
  const position = selected ? path.indexOf(selected.id) : -1;
  const storageKey = 'three-maps-browse:' + map.id;

  useEffect(() => {
    const read = () => {
      const query = readCatalogQuery(window.location.search);
      setView(query.view); setScope(query.relations); setFilters(query.filters);
      setStage(ecosystem && map.branches.some((node) => node.id === query.stage) ? query.stage! : '');
      setAdvanced(!!(query.filters.type || query.filters.understanding || query.filters.verification));
      const id = window.location.hash.startsWith('#node-') ? window.location.hash.slice(6) : '';
      setSelectedId(resolveCatalogNode(map, nodes, id) ? id : null);
    };
    read(); setReady(true);
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null');
      if (saved?.panels && typeof saved.panels === 'object') scrolls.current = saved.panels;
      if (saved?.url === window.location.pathname + window.location.search + window.location.hash && Number.isFinite(saved.scroll)) requestAnimationFrame(() => window.scrollTo(0, saved.scroll));
    } catch { /* Reading remains usable without storage. */ }
    window.addEventListener('popstate', read); window.addEventListener('hashchange', read);
    return () => { window.removeEventListener('popstate', read); window.removeEventListener('hashchange', read); };
  }, [nodes, map, ecosystem, storageKey]);

  const navigate = useCallback((nextView: typeof view, nextFilters: CatalogFilters, id: string | null, nextScope = scope, replace = false, nextStage = stage) => {
    const target = nodes.find((node) => node.id === id);
    const graphStage = ecosystem ? nextView === 'graph' && target?.parent ? target.groupId : nextStage : '';
    setView(nextView); setFilters(nextFilters); setSelectedId(id); setScope(nextScope); setStage(graphStage);
    const url = `${window.location.pathname}${catalogQuery(nextView, nextFilters, nextScope, graphStage)}${id ? `#node-${id}` : ''}`;
    if (url !== window.location.pathname + window.location.search + window.location.hash) window.history[replace ? 'replaceState' : 'pushState'](window.history.state, '', url);
  }, [scope, stage, ecosystem, nodes]);
  const remember = useCallback(() => {
    try { sessionStorage.setItem(storageKey, JSON.stringify({ url: window.location.pathname + window.location.search + window.location.hash, scroll: window.scrollY, panels: scrolls.current })); } catch { /* Optional browse memory. */ }
  }, [storageKey]);
  useEffect(() => {
    window.addEventListener('pagehide', remember);
    return () => window.removeEventListener('pagehide', remember);
  }, [remember]);
  const open = (id: string) => {
    // Explicitly opening a knowledge point starts its text at the top; returning to a topic restores it.
    if (nodes.find((node) => node.id === id)?.parent) scrolls.current[id] = 0;
    navigate(view, filters, id);
  };
  const close = useCallback(() => {
    const targetId = view === 'cards' ? selected?.groupId : selected?.id;
    navigate(view, filters, null);
    requestAnimationFrame(() => (document.getElementById(`node-${targetId}`) ?? document.querySelector<HTMLElement>('input[type="search"]'))?.focus({ preventScroll: true }));
  }, [navigate, view, filters, selected]);
  useEffect(() => {
    if (!selected) return;
    heading.current?.focus({ preventScroll: true });
    if (body.current) body.current.scrollTop = scrolls.current[selected.id] ?? 0;
  }, [selected, view]);
  useEffect(() => {
    if (!selected) return;
    const prior = document.body.style.overflow, element = background.current;
    document.body.style.overflow = 'hidden'; if (element) element.inert = true;
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(panel.current?.querySelectorAll<HTMLElement>('a[href],button,summary,[tabindex="0"]') ?? []).filter((item) => !item.hasAttribute('disabled') && item.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === heading.current)) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = prior; if (element) element.inert = false; };
  }, [selected, close]);
  const changeFilter = (key: keyof CatalogFilters, value: string) => navigate(view, { ...filters, [key]: value }, selectedId, scope, key === 'q');

  function reading(node: CatalogNode, interactive = true) {
    const children = node.collection ? node.children as CatalogNode[] : catalogChildren(nodes, node.id);
    const related = edges.filter((edge) => (edge.from === node.id || edge.targetMap === map.id && edge.to === node.id) && edge.kind !== 'hierarchy');
    const local = related.filter((edge) => edge.targetMap === map.id), cross = related.filter((edge) => edge.targetMap !== map.id);
    const sourceIds = [...new Set([...node.sources, ...related.flatMap((edge) => edge.sources), ...(node.lesson?.example.materials.flatMap((id) => teachingCase.materials.find((item) => item.id === id)?.sources ?? []) ?? [])])];
    const renderRelations = (items: typeof related, label: string) => !!items.length && <section className={styles.lessonRelations} aria-label={label}><h3>{label} <span>（{items.length} 条）</span></h3>{items.map((edge) => {
      const outgoing = edge.from === node.id, targetId = outgoing ? edge.to : edge.from;
      const target = edge.targetMap === map.id ? nodes.find((item) => item.id === targetId) : undefined;
      const resolved = links[`relation:${edge.targetMap}:${targetId}`];
      const href = target ? `/docs/${map.id}/#node-${target.id}` : resolved?.href;
      if (!href) return null;
      const from = nodes.find((item) => item.id === edge.from)?.title ?? edge.from;
      const to = edge.targetMap === map.id ? nodes.find((item) => item.id === edge.to)?.title ?? edge.to : resolved?.title.replace(/^[^·]+·\s*/, '') ?? edge.to;
      return <article key={edge.id} data-direction={edge.direction ?? 'directed'}><Link href={href} onClick={(event) => {
        if (interactive && target && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); open(targetId); } else remember();
      }}><strong>{edge.direction === 'undirected' ? `${from} 与 ${to}：${edge.label}` : `${from} ${edge.label} · ${to}`}</strong><ArrowUpRight size={16} /></Link>
        {edge.description && <p>{edge.description}</p>}<small>{edge.targetMap === map.id ? edge.basis === 'editorial' ? '编辑建议' : '材料关系' : '跨图背景'} · 依据 {edge.sources.join('、')} · {edge.verification}</small>
      </article>;
    })}</section>;
    return <>
      {node.parent && <KnowledgeStatus node={node} />}
      {node.collection && <section className={styles.topicTeaching}><p>{node.detail}</p><strong>原分类：{node.title} · {children.length} 个原有条目</strong></section>}
      {node.topic && <section className={styles.topicTeaching}><p className={styles.readingSummary}>{node.topic.question}</p><p>{node.detail}</p>{ecosystem && node.boundary && <p className={styles.topicHandoff}>{node.boundary}</p>}<p className={styles.classification}>{node.topic.classification}</p><strong>学完这个主题：{node.topic.outcome}</strong></section>}
      {node.lesson && <DomainLesson key={node.id} lesson={node.lesson} ecosystem={ecosystem} profile={node.teamProfile} />}
      {interactive && !!node.children?.length && <section className={styles.childrenSection} aria-label="主题下的知识点"><div className={styles.sectionHeading}><h3>从这里继续探索</h3><span>{node.children.length} 个知识点</span></div><div className={styles.childCards}>{children.map((child) => <button type="button" className={styles.childCard} key={child.id} data-tone={tone(child)} data-outside={filtersActive && !matches.some((item) => item.id === child.id)} onClick={() => open(child.id)} aria-label={`打开知识点：${child.title}`}>
        <span className={styles.childCardMeta}>{ecosystem && child.type + ' · '}{child.lesson?.role}</span><strong>{child.title}</strong><KnowledgeStatus node={child} /><span className={styles.childCardSummary}>{child.summary}</span><span className={styles.childGoal}>学完能：{child.lesson?.goal}</span><span className={styles.childCardFooter}>{filtersActive && !matches.some((item) => item.id === child.id) ? '筛选范围外 · 仍可阅读' : '阅读示例与知识联系'}<ArrowRight size={16} /></span>
      </button>)}</div></section>}
      {ecosystem && node.lesson && node.boundary && <div className={styles.boundary}><span>理解与使用边界</span><p>{node.boundary}</p></div>}
      {renderRelations(local, ecosystem ? '本图生态联系' : '本图知识联系')}{renderRelations(cross, '跨图背景')}
      <details key={`sources-${node.id}`} className={styles.lessonSources}><summary>资料状态、使用边界与来源（{sourceIds.length}）</summary><p>原资料学习状态：{node.understanding}；核实状态：{node.verification}。这不是当前访问者的学习进度，附有来源也不代表已经核实。</p><p>节点 ID：<code>{node.id}</code>。本页包含教学编排与自编示例，不将学习建议写成已完成的实践成果。</p><nav aria-label="内容来源">{sourceIds.map((id) => <Link key={id} href={`/docs/sources/#${id.toLowerCase()}`} onClick={remember}><span>{sourceTitles[id] ?? id}</span><small>{id}<ArrowUpRight size={13} /></small></Link>)}</nav></details>
      {!!node.records?.length && <details className={styles.lessonSources}><summary>历史记录与材料范围（{node.records.length}）</summary>{node.records.map((record, index) => <section className={styles.evidenceRecord} key={index}><h3>{record.title}</h3><p>{record.date} · <Link href={`/docs/sources/#${record.source.toLowerCase()}`} onClick={remember}>{record.source}</Link> · {record.locator}</p><p>{record.text}</p></section>)}</details>}
      {node.lesson && <DomainAdvanced key={`advanced-${node.id}`} lesson={node.lesson} />}
    </>;
  }
  function outline(items: MapDefinition['branches']) { return <div className={styles.outline}>{items.map((item) => <details id={`node-${item.id}`} key={item.id}><summary>{item.title}<span>{item.summary}</span></summary>{reading(nodes.find((node) => node.id === item.id)!, false)}{item.children && outline(item.children)}</details>)}</div>; }

  return <div className={styles.map} data-map={map.id} data-learning=""><div ref={background}>
    <nav className={styles.breadcrumb} aria-label="面包屑"><Link href="/">首页</Link><span>/</span><span>{map.title}</span></nav>
    <header className={styles.domainIntro}><div><p className={styles.eyebrow}>THREE LIVING MAPS / {map.number}</p><h1 id="map-title">{map.title}</h1><p>{map.question} {map.description}</p></div>{ready && <button type="button" className={styles.startLearning} onClick={() => open(map.branches[0].id)}>从{map.branches[0].title}开始<ArrowRight size={17} /></button>}</header>
    <div className={styles.compactStats} aria-label="地图统计"><span><strong>{map.branches.length}</strong> 个主题</span><span><strong>{points.length}</strong> 个知识点</span><span><strong>{concepts.length}</strong> 条{ecosystem ? '生态' : '概念'}联系</span><details><summary>分类与跨图说明</summary><p>{edges.filter((edge) => edge.kind === 'hierarchy').length} 条主题归属关系 · {edges.filter((edge) => edge.targetMap !== map.id).length} 条跨图关系。{ecosystem ? '七环节用于观察与交接，适配按需、评测贯穿；10个旧分类仅保留兼容入口，不计入统计。' : '五主题为本网站的学习组织方式，新增节点不冒充原讲解稿的原始知识树。'}建议学习顺序不等于技术依赖。</p></details></div>
    {ready ? <>
      <section className={styles.domainToolbar} aria-label="筛选知识节点"><label className={styles.domainSearch}><Search size={17} /><span className={styles.srOnly}>关键词</span><input type="search" placeholder="搜索概念、解释或教学示例…" value={filters.q} onChange={(event) => changeFilter('q', event.target.value)} /></label><details open={advanced} onToggle={(event) => setAdvanced(event.currentTarget.open)} className={styles.advancedFilters}><summary>高级筛选{filters.type || filters.understanding || filters.verification ? ' · 已启用' : ''}</summary><div className={styles.filterFields}>
        <label>类型<select aria-label="类型" value={filters.type} onChange={(event) => changeFilter('type', event.target.value)}><option value="">全部类型</option>{[...new Set(nodes.map((node) => node.type))].map((type) => <option key={type}>{type}</option>)}</select></label>
        <label>学习状态<select aria-label="学习状态" value={filters.understanding} onChange={(event) => changeFilter('understanding', event.target.value)}><option value="">全部学习状态</option>{understandingOptions.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>核实状态<select aria-label="核实状态" value={filters.verification} onChange={(event) => changeFilter('verification', event.target.value)}><option value="">全部状态</option>{verificationOptions.map((value) => <option key={value}>{value}</option>)}</select></label>
        <p>学习状态来自原资料记录，不代表你的个人学习进度。可按学习状态、核实状态筛选，也可直接搜索标签文字。</p></div></details><button type="button" className={styles.resetDomain} onClick={() => navigate(view, emptyFilters, selectedId)}>重置筛选</button></section>
      <div className={styles.viewBar}><div className={styles.viewTabs} role="group" aria-label="地图视图"><button type="button" aria-pressed={view === 'cards'} onClick={() => navigate('cards', filters, selectedId)}><Grid2X2 size={16} />主题卡片</button><button type="button" aria-pressed={view === 'graph'} onClick={() => navigate('graph', filters, selectedId)}><Network size={16} />关系图</button></div><p aria-live="polite">{groups.length} 个主题 · 匹配 {matches.filter((node) => node.parent).length} / {points.length} 个知识点</p></div>
      {!visible.length ? <div className={styles.empty}><Search size={28} /><h2>没有找到匹配的知识点</h2><p>换个关键词，或清除筛选继续探索。</p><button type="button" onClick={() => navigate(view, emptyFilters, null)}>清除筛选</button></div> : view === 'cards' ? <div className={styles.groupGrid}>{groups.map(({ root, members }) => <button key={root.id} id={`node-${root.id}`} type="button" className={styles.groupCard} data-tone={tone(root)} onClick={() => open(root.id)} aria-haspopup="dialog" aria-label={`展开主题：${root.title}`}>
        <span className={styles.groupCardTop}><span>主题 {String(tone(root) + 1).padStart(2, '0')}</span><span>{members.length} 个知识点</span></span><strong className={styles.groupTitle}>{root.title}</strong><span className={styles.groupSummary}>{root.topic?.question}</span><span className={styles.topicPreview}>{root.topic?.overview[0]}</span><span className={styles.groupCardBottom}><span>{ecosystem && root.boundary && <span className={styles.groupHandoff}>{root.boundary}</span>}{root.topic?.outcome}</span><ArrowUpRight size={18} /></span>
      </button>)}</div> : ecosystem ? <EcosystemGraph nodes={visible} allNodes={nodes} edges={concepts} selected={selected?.collection ? null : selectedId} stage={stage} scope={scope} onStage={(value) => navigate(view, filters, null, scope, false, value)} onScope={(value) => navigate(view, filters, selectedId, value)} onSelect={open} /> : <DomainGraph nodes={visible} allNodes={nodes} edges={concepts} selected={selectedId} scope={scope} onScope={(value) => navigate(view, filters, selectedId, value)} onSelect={open} />}
    </> : <section aria-label="地图层级内容"><p className={styles.notice}>展开主题和知识点，阅读解释、教学示例、关系与来源。</p>{outline(map.branches)}{!!map.legacyCollections?.length && <section className={styles.legacyOutline} aria-label="旧分类专题"><h2>旧分类专题</h2>{map.legacyCollections.map((collection) => <details id={`node-${collection.id}`} key={collection.id}><summary>{collection.title}</summary><p>旧分类内容现分布于七个协作环节，本入口不计入统计。</p><ul>{collection.members.map((id) => <li key={id}><Link href={`/docs/${map.id}/#node-${id}`}>{nodes.find((node) => node.id === id)?.title}</Link></li>)}</ul></details>)}</section>}</section>}
  </div>
    {selected && <><div className={styles.scrim} onClick={close} aria-hidden="true" /><aside ref={panel} id="map-reading-panel" className={`${styles.floating} ${styles.domainDialog}`} data-tone={tone(selected)} data-topic={!!selected.children?.length} role="dialog" aria-modal="true" aria-labelledby="reading-title">
      <header className={styles.domainPanelTop}><div>{selected.parent && <button type="button" onClick={() => open(selected.parent!)} aria-label="返回上一层"><ArrowLeft size={16} />返回{nodes.find((node) => node.id === selected.parent)?.title}</button>}<span>{map.title}{selected.path.length > 0 && ` / ${selected.path.join(' / ')}`}</span><button type="button" className={styles.lessonViewSwitch} onClick={() => navigate(view === 'cards' ? 'graph' : 'cards', filters, selected.collection ? null : selectedId, scope, false, selected.collection ? '' : stage)}>{selected.collection ? '查看新协作链' : view === 'cards' ? '在关系图定位' : '切回主题卡片'}</button></div><button type="button" aria-label="关闭阅读面板" onClick={close}><X size={22} /></button></header>
      <div ref={body} className={styles.domainPanelBody} onScroll={(event) => { scrolls.current[selected.id] = event.currentTarget.scrollTop; }}><div className={styles.domainReadingColumn}><p className={styles.lessonRole}>{ecosystem && selected.parent && selected.type + ' · '}{selected.lesson?.role ?? '主题导读'}{position >= 0 && ` · 学习路线 ${position + 1} / ${path.length}`}</p><h2 ref={heading} id="reading-title" tabIndex={-1}>{selected.title}</h2>
        {outside && <p className={styles.notice}>当前节点不在筛选结果内，已临时显示。<button type="button" onClick={() => navigate(view, emptyFilters, selectedId)}>清除筛选查看全部</button></p>}
        {reading(selected)}
      </div></div>
      <footer className={styles.lessonNavigation}>{position >= 0 ? <><button type="button" disabled={position === 0} onClick={() => open(path[position - 1])}><ArrowLeft size={16} /><span>上一知识点<small>{nodes.find((node) => node.id === path[position - 1])?.title ?? '学习起点'}</small></span></button><span>{position + 1} / {path.length}</span><button type="button" disabled={position === path.length - 1} onClick={() => open(path[position + 1])}><span>下一知识点<small>{nodes.find((node) => node.id === path[position + 1])?.title ?? '路线结束'}</small></span><ArrowRight size={16} /></button></> : <><span>{ecosystem ? selected.collection ? '旧分类专题 · 可继续进入所属协作环节' : '条目按角色排列，阅读顺序不等于技术依赖。' : '建议顺序 · ' + selected.children?.map((node) => node.title).join(' → ')}</span><button type="button" onClick={() => open(selected.children![0].id)}>从{selected.children?.[0].title}开始<ArrowRight size={16} /></button></>}</footer>
    </aside></>}
  </div>;
}

// Existing domain import remains valid while both teaching maps use the shared reader.
export const DomainExplorer = LearningExplorer;
