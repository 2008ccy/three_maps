'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Focus, Minus, Plus, RotateCcw } from 'lucide-react';
import type { CatalogNode, MapEdge } from '@/lib/maps/catalog';
import { cognitionLearningGraph } from '@/lib/maps/cognition-learning-graph';
import styles from './maps.module.css';

type Props = { nodes: CatalogNode[]; allNodes: CatalogNode[]; edges: MapEdge[]; selected: string | null; scope: 'core' | 'all'; onScope: (scope: 'core' | 'all') => void; onSelect: (id: string) => void };
export function CognitionLearningGraph({ nodes, allNodes, edges, selected, scope, onScope, onSelect }: Props) {
  const graph = useMemo(() => cognitionLearningGraph(nodes, allNodes, edges, selected, scope), [nodes, allNodes, edges, selected, scope]);
  const viewport = useRef<HTMLDivElement>(null), drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const [size, setSize] = useState({ width: 1200, height: 720 }), [camera, setCamera] = useState({ x: 0, y: 8, scale: 1 });
  const marker = useId().replace(/:/g, '');
  const neighbors = new Set([selected, ...edges.filter((edge) => edge.from === selected || edge.to === selected).flatMap((edge) => [edge.from, edge.to])]);
  const reset = () => setCamera({ x: Math.max(12, (size.width - graph.width) / 2), y: 8, scale: 1 });
  const focus = () => { const node = graph.nodes.find((node) => node.id === selected); if (node) setCamera({ x: size.width / 2 - (node.x + 114), y: size.height / 2 - (node.y + 39), scale: 1 }); };
  useEffect(() => { const element = viewport.current; if (!element) return; const observer = new ResizeObserver(() => setSize({ width: element.clientWidth, height: element.clientHeight })); observer.observe(element); return () => observer.disconnect(); }, []);
  useEffect(() => { if (selected) focus(); else reset(); }, [selected, graph.width, graph.height, size.width, size.height]); // eslint-disable-line react-hooks/exhaustive-deps
  const zoom = (factor: number) => setCamera((current) => { const scale = Math.max(.5, Math.min(1.8, current.scale * factor)), ratio = scale / current.scale; return { scale, x: size.width / 2 - (size.width / 2 - current.x) * ratio, y: size.height / 2 - (size.height / 2 - current.y) * ratio }; });
  return <section className={`${styles.graph} ${styles.domainGraph} ${styles.cognitionLearningGraph}`} aria-label="认知关系图">
    <header className={styles.graphHeader}><div><strong>把判断、检验与修正接起来</strong><span>四主题分区表示归属；建议阅读顺序不是因果链，也不表示案例已经执行。</span></div><div className={styles.graphControls}>
      <button type="button" aria-label="缩小关系图" onClick={() => zoom(1 / 1.2)}><Minus size={16} /></button><output>{Math.round(camera.scale * 100)}%</output><button type="button" aria-label="放大关系图" onClick={() => zoom(1.2)}><Plus size={16} /></button><button type="button" aria-label="聚焦所选节点" disabled={!selected} onClick={focus}><Focus size={16} /></button><button type="button" aria-label="恢复关系图总览" onClick={reset}><RotateCcw size={16} /></button>
    </div></header>
    <div className={styles.relationScope} role="group" aria-label="认知关系范围"><button type="button" aria-pressed={scope === 'core'} onClick={() => onScope('core')}>核心联系 · {edges.filter((edge) => edge.core).length}</button><button type="button" aria-pressed={scope === 'all'} onClick={() => onScope('all')}>全部联系 · {edges.length}</button><span>当前 {graph.edges.length} 条 · 选中时补全直接联系</span></div>
    <p className={styles.cognitionLegend}><span>实线箭头：判断与检验</span><span>长虚线箭头：原指导与反馈方向</span><span>点虚线无箭头：互补或比较</span><span>核实状态单独见节点来源</span></p>
    <div ref={viewport} className={styles.graphViewport} tabIndex={0} aria-label="可拖动认知画布，方向键平移" onKeyDown={(event) => {
      const moves: Record<string, [number, number]> = { ArrowLeft: [60, 0], ArrowRight: [-60, 0], ArrowUp: [0, 60], ArrowDown: [0, -60] };
      if (event.target !== event.currentTarget || !moves[event.key]) return; event.preventDefault(); const [x, y] = moves[event.key]; setCamera((current) => ({ ...current, x: current.x + x, y: current.y + y }));
    }} onPointerDown={(event) => { if ((event.target as Element).closest('button,a')) return; drag.current = { x: event.clientX, y: event.clientY, tx: camera.x, ty: camera.y }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (drag.current) setCamera((current) => ({ ...current, x: drag.current!.tx + event.clientX - drag.current!.x, y: drag.current!.ty + event.clientY - drag.current!.y })); }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      <div className={styles.graphWorld} style={{ width: graph.width, height: graph.height, transform: `translate(${camera.x}px,${camera.y}px) scale(${camera.scale})` }}>
        <svg className={`${styles.graphLines} ${styles.domainGraphLines} ${styles.cognitionLearningLines}`} width={graph.width} height={graph.height} aria-label={`${graph.edges.length} 条认知联系`}>
          <defs><marker id={marker} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1 L7 4 L1 7" fill="none" stroke="currentColor" /></marker></defs>
          {graph.edges.map((edge, index) => {
            const from = graph.nodes.find((node) => node.id === edge.from)!, to = graph.nodes.find((node) => node.id === edge.to)!;
            const same = from.x === to.x, right = to.x > from.x;
            const x1 = from.x + (same || right ? 228 : 0), y1 = from.y + 39, x2 = to.x + (same || !right ? 228 : 0), y2 = to.y + 39;
            const bend = same ? 22 + index % 3 * 7 : Math.max(25, Math.abs(x2 - x1) / 2), sign = right ? 1 : -1;
            const d = same ? `M${x1},${y1} C${x1 + bend},${y1} ${x2 + bend},${y2} ${x2},${y2}` : `M${x1},${y1} C${x1 + sign * bend},${y1} ${x2 - sign * bend},${y2} ${x2},${y2}`;
            return <g key={edge.id} tabIndex={0} role="img" data-active={!selected || edge.from === selected || edge.to === selected} data-feedback={edge.kind === 'feedback'} data-comparison={edge.direction === 'undirected'} aria-label={`${from.title} ${edge.label} ${to.title}；${edge.description}；${edge.verification}`}><title>{from.title} {edge.label} {to.title}。{edge.description}</title><path d={d} markerEnd={edge.direction === 'undirected' ? undefined : `url(#${marker})`} /><text x={same ? x1 + bend : (x1 + x2) / 2} y={(y1 + y2) / 2 - 7} textAnchor="middle">{edge.label}</text></g>;
          })}
        </svg>
        {graph.nodes.map((node) => <button type="button" key={node.id} id={`node-${node.id}`} className={styles.graphNode} data-root={!node.parent} data-selected={node.id === selected} data-muted={!!selected && !neighbors.has(node.id) && node.id !== graph.nodes.find((item) => item.id === selected)?.groupId} style={{ left: node.x, top: node.y }} aria-pressed={node.id === selected} onClick={() => onSelect(node.id)}><span><strong>{node.title}</strong><small>{node.parent ? node.type : '主题导读 · 点击阅读'}</small></span></button>)}
      </div>
    </div>
    <details className={styles.graphTextList}><summary>用文字查看当前 {graph.edges.length} 条联系</summary>{graph.edges.map((edge) => <p key={edge.id}><button type="button" onClick={() => onSelect(edge.from)}>{allNodes.find((node) => node.id === edge.from)?.title}</button> {edge.label} · <button type="button" onClick={() => onSelect(edge.to)}>{allNodes.find((node) => node.id === edge.to)?.title}</button><span>{edge.kind === 'feedback' ? '原指导与反馈方向' : edge.basis === 'editorial' ? '教学联系' : '材料关系'} · {edge.description} 依据：{edge.sources.join('、')} · {edge.verification}</span></p>)}</details>
    <p className={styles.graphNote}>悬停或聚焦连线查看关系标签；选中节点显示全部直接联系，筛选外相邻点临时补入。虚线区分关系含义，不代表是否核实。窄屏可拖动或用方向键平移。</p>
  </section>;
}
