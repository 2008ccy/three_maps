'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import type { CatalogNode, MapEdge } from '@/lib/maps/catalog';
import { buildRadialGraph } from '@/lib/maps/radial-graph';
import { RadialCanvas } from './radial-canvas';
import { GraphRelations, RelationList } from './graph-relations';
import styles from './maps.module.css';
import radial from './radial-graph.module.css';

type Scope = 'core' | 'all';
type Props = {
  title: string; nodes: CatalogNode[]; allNodes: CatalogNode[]; edges: MapEdge[];
  focusId: string; scope: Scope; onScope: (scope: Scope) => void;
  onSelect: (id: string) => void; onExplore: (id: string) => void;
};

export function RadialGraph({ title, nodes, allNodes, edges, focusId, scope, onScope, onSelect, onExplore }: Props) {
  const graph = useMemo(() => buildRadialGraph(nodes, allNodes, edges, focusId, scope), [nodes, allNodes, edges, focusId, scope]);
  const [pinnedKey, setPinnedKey] = useState('');
  const keyFor = (from: string, to: string) => JSON.stringify([graph.hub, from, to]);
  const pinned = graph.lines.find(line => keyFor(line.from, line.to) === pinnedKey);
  const point = !!graph.focus?.parent;
  const parent = graph.focus?.parent ? graph.byId.get(graph.focus.parent) : undefined;
  const section = useRef<HTMLElement>(null), details = useRef<HTMLElement>(null);
  const moveFocus = useRef(false);
  const explore = (id: string) => {
    setPinnedKey('');
    moveFocus.current = true;
    onExplore(id);
  };
  useEffect(() => {
    if (moveFocus.current) {
      section.current?.querySelector<HTMLElement>('[data-graph-hub]')?.focus({ preventScroll: true });
      moveFocus.current = false;
    }
  }, [graph.hub]);
  useEffect(() => {
    if (pinnedKey) details.current?.scrollIntoView({ block: 'nearest' });
  }, [pinnedKey]);
  return <section ref={section} className={`${styles.graph} ${radial.graph}`} aria-label={title.replace('地图', '关系图')}>
    <header className={radial.header}>
      <div className={radial.location}>
        {graph.focus && <button type="button" onClick={() => explore(parent?.id ?? '')} aria-label={`返回${parent?.title ?? '全图总览'}`}><ArrowLeft size={16} /></button>}
        <strong>{graph.focus?.title ?? '全图总览'}</strong>
      </div>
      <label className={radial.picker}>
        <span>查看主题</span>
        <select aria-label="关系图主题" value={graph.focus?.groupId ?? ''} onChange={event => explore(event.target.value)}>
          <option value="">全图总览</option>
          {allNodes.filter(node => !node.parent && (graph.themes.includes(node) || node.id === graph.focus?.groupId)).map(node => <option key={node.id} value={node.id}>{node.title}</option>)}
        </select>
      </label>
      {!point && <div className={radial.scopes} role="group" aria-label="关系范围">
        <button type="button" aria-pressed={scope === 'core'} onClick={() => onScope('core')}>核心联系</button>
        <button type="button" aria-pressed={scope === 'all'} onClick={() => onScope('all')}>全部联系</button>
      </div>}
    </header>
    <RadialCanvas key={graph.hub} graph={graph} title={title} pinned={pinned} onSelect={onSelect} onExplore={explore}
      onPin={line => setPinnedKey(pinned === line ? '' : keyFor(line.from, line.to))} />
    <div className={radial.caption}>
      <span>{point ? `${graph.displayed.length} 条直接联系` : `${graph.displayed.length} 条${graph.focus ? '主题内' : '跨主题'}联系`}</span>
      <span>{graph.lines.length ? '点连线查看关系说明。' : '本层暂无符合条件的联系。'}{!graph.focus && '线上的数字表示合并的联系数。'}</span>
    </div>
    {pinned && <section ref={details} className={`${styles.graphTextList} ${radial.lineDetail}`} aria-label="所选连线">
      <div><strong>{graph.byId.get(pinned.from)?.title} 与 {graph.byId.get(pinned.to)?.title}</strong>
        <button type="button" onClick={() => setPinnedKey('')} aria-label="收起连线说明"><X size={16} /></button></div>
      <GraphRelations edges={pinned.edges} byId={graph.byId} onSelect={onSelect} />
    </section>}
    <RelationList edges={graph.displayed} byId={graph.byId} onSelect={onSelect} />
  </section>;
}
