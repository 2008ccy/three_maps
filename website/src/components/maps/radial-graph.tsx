'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { CatalogNode } from '@/lib/maps/catalog';
import type { MapDefinition } from '@/lib/maps/types';
import { buildExpandedGraph, type Atlas, type AtlasEdge, type NodeRef } from '@/lib/maps/expanded-graph';
import { RadialCanvas } from './radial-canvas';
import styles from './maps.module.css';
import radial from './radial-graph.module.css';

type Props = {
  atlas: Atlas; map: MapDefinition; matches: CatalogNode[]; expanded: string[]; selected: NodeRef | null; focus: string;
  scope: 'core' | 'all'; onScope: (scope: 'core' | 'all') => void; onSelect: (ref: NodeRef) => void;
  onToggle: (id: string) => void; onCollapse: () => void;
};
export function RadialGraph({ atlas, map, matches, expanded, selected, focus, scope, onScope, onSelect, onToggle, onCollapse }: Props) {
  const graph = useMemo(() => buildExpandedGraph(atlas, map, matches, expanded, scope, selected), [atlas, map, matches, expanded, scope, selected]);
  const [pinnedKey, setPinnedKey] = useState('');
  const pinned = graph.lines.find(line => line.id === pinnedKey);
  const details = useRef<HTMLElement>(null);
  useEffect(() => { if (pinnedKey) details.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' }); }, [pinnedKey]);
  function relations(edges: AtlasEdge[]) {
    return edges.map(edge => {
      const from = atlas.byId.get(edge.from)!, to = atlas.byId.get(edge.to)!;
      return <div key={edge.id} className={radial.relationText}>
        <p><button type="button" onClick={() => onSelect({ mapId: from.mapId, nodeId: from.id })}>{from.title}</button> {edge.direction === 'undirected' ? '↔' : '→'} <button type="button" onClick={() => onSelect({ mapId: to.mapId, nodeId: to.id })}>{to.title}</button></p>
        <strong>{edge.label}</strong>{edge.description && <p>{edge.description}</p>}
        <small>{edge.sourceMap !== edge.targetMap ? '跨图联系' : edge.basis === 'editorial' ? '编辑建议' : '材料关系'} · 依据 {edge.sources.join('、')} · {edge.verification}</small>
      </div>;
    });
  }
  return <section className={radial.graph} aria-label={map.title.replace('地图', '关系图')}>
    <header className={radial.header}><div><strong>沿着联系，展开理解</strong><span>点击主题展开 · 点击知识点阅读 · 拖动节点或空白</span></div>
      <div className={radial.scopes} role="group" aria-label="本图关系范围"><button type="button" aria-pressed={scope === 'core'} onClick={() => onScope('core')}>核心联系</button><button type="button" aria-pressed={scope === 'all'} onClick={() => onScope('all')}>全部联系</button></div>
    </header>
    <RadialCanvas graph={graph} pinned={pinnedKey} selected={selected} focus={focus} onPin={key => setPinnedKey(key === pinnedKey ? '' : key)} onSelect={onSelect} onToggle={onToggle} onCollapse={onCollapse} />
    <div className={radial.caption}><span>{expanded.length} 个主题已展开 · {graph.relations.filter(edge => edge.sourceMap !== edge.targetMap).length} 条跨图联系</span><span>拖动后轻轻回摆 · 线上的数字表示联系数</span></div>
    {pinned && <section ref={details} className={`${styles.graphTextList} ${radial.lineDetail}`} aria-label="所选连线"><div className={radial.detailHeading}><strong>这条联系</strong><button type="button" aria-label="收起连线说明" onClick={() => setPinnedKey('')}><X size={16} /></button></div>{relations(pinned.edges)}</section>}
    <details className={styles.graphTextList}><summary>用文字查看当前 {graph.relations.length} 条联系</summary>{relations(graph.relations)}</details>
  </section>;
}
