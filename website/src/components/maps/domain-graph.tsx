'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Focus, Minus, Plus, RotateCcw } from 'lucide-react';
import type { CatalogNode, MapEdge } from '@/lib/maps/catalog';
import styles from './maps.module.css';

type Props = { nodes: CatalogNode[]; allNodes: CatalogNode[]; edges: MapEdge[]; selected: string | null; scope: 'core' | 'all'; onScope: (scope: 'core' | 'all') => void; onSelect: (id: string) => void };
export function DomainGraph({ nodes, allNodes, edges, selected, scope, onScope, onSelect }: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const [size, setSize] = useState({ width: 1204, height: 560 });
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: 1 });
  const marker = useId().replace(/:/g, '');
  const layout = useMemo(() => {
    const groups = allNodes.filter((node) => !node.parent && nodes.some((item) => item.groupId === node.id));
    const positioned = groups.flatMap((root, column) => [root, ...nodes.filter((node) => node.parent === root.id)].map((node, index) => ({ ...node, x: 24 + column * 236, y: index === 0 ? 18 : 92 + (index - 1) * 82 })));
    return { nodes: positioned, width: Math.max(1, groups.length) * 236 + 24, height: Math.max(480, ...positioned.map((node) => node.y + 92)) };
  }, [nodes, allNodes]);
  const displayed = edges.filter((edge) => layout.nodes.some((node) => node.id === edge.from) && layout.nodes.some((node) => node.id === edge.to) && (scope === 'all' || edge.core || edge.from === selected || edge.to === selected));
  const neighbors = new Set([selected, ...displayed.filter((edge) => edge.from === selected || edge.to === selected).flatMap((edge) => [edge.from, edge.to])]);
  useEffect(() => {
    const element = viewport.current; if (!element) return;
    const observer = new ResizeObserver(() => setSize({ width: element.clientWidth, height: element.clientHeight }));
    observer.observe(element); return () => observer.disconnect();
  }, []);
  const reset = () => {
    const scale = Math.min(1, size.width / layout.width, size.height / layout.height);
    setCamera({ x: (size.width - layout.width * scale) / 2, y: (size.height - layout.height * scale) / 2, scale });
  };
  useEffect(() => { if (selected) focus(); else reset(); }, [layout.width, layout.height, size.width, size.height]); // eslint-disable-line react-hooks/exhaustive-deps
  const focus = () => {
    const node = layout.nodes.find((item) => item.id === selected);
    if (node) setCamera({ x: size.width / 2 - (node.x + 100), y: size.height / 2 - (node.y + 30), scale: 1 });
  };
  useEffect(() => { if (selected) focus(); }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps
  const zoom = (factor: number) => setCamera((current) => { const scale = Math.min(1.8, Math.max(.4, current.scale * factor)), ratio = scale / current.scale; return { scale, x: size.width / 2 - (size.width / 2 - current.x) * ratio, y: size.height / 2 - (size.height / 2 - current.y) * ratio }; });
  return <section className={`${styles.graph} ${styles.domainGraph}`} aria-label="知识关系图">
    <header className={styles.graphHeader}><div><strong>看见知识之间的联系</strong><span>箭头：有向联系 · 无箭头：比较或互补 · 主题分区表示归属</span></div><div className={styles.graphControls}>
      <button type="button" aria-label="缩小关系图" onClick={() => zoom(1 / 1.2)}><Minus size={16} /></button><output>{Math.round(camera.scale * 100)}%</output><button type="button" aria-label="放大关系图" onClick={() => zoom(1.2)}><Plus size={16} /></button><button type="button" aria-label="聚焦所选节点" disabled={!selected} onClick={focus}><Focus size={16} /></button><button type="button" aria-label="恢复关系图总览" onClick={reset}><RotateCcw size={16} /></button>
    </div></header>
    <div className={styles.relationScope} role="group" aria-label="概念关系范围"><button type="button" aria-pressed={scope === 'core'} onClick={() => onScope('core')}>核心联系 · {edges.filter((edge) => edge.core).length}</button><button type="button" aria-pressed={scope === 'all'} onClick={() => onScope('all')}>全部联系 · {edges.length}</button><span>当前 {displayed.length} 条 · 核实状态见节点说明；编辑建议不是必然技术依赖</span></div>
    <div ref={viewport} className={styles.graphViewport} tabIndex={0} aria-label="可拖动关系画布，方向键平移，使用上方按钮缩放" onKeyDown={(event) => {
      const moves: Record<string, [number, number]> = { ArrowLeft: [60, 0], ArrowRight: [-60, 0], ArrowUp: [0, 60], ArrowDown: [0, -60] };
      if (event.target !== event.currentTarget || !moves[event.key]) return;
      event.preventDefault(); const [x, y] = moves[event.key]; setCamera((current) => ({ ...current, x: current.x + x, y: current.y + y }));
    }} onPointerDown={(event) => {
      if ((event.target as Element).closest('button,a')) return;
      drag.current = { x: event.clientX, y: event.clientY, tx: camera.x, ty: camera.y }; event.currentTarget.setPointerCapture(event.pointerId);
    }} onPointerMove={(event) => {
      if (drag.current) setCamera((current) => ({ ...current, x: drag.current!.tx + event.clientX - drag.current!.x, y: drag.current!.ty + event.clientY - drag.current!.y }));
    }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      <div className={styles.graphWorld} style={{ width: layout.width, height: layout.height, transform: `translate(${camera.x}px,${camera.y}px) scale(${camera.scale})` }}>
        <svg className={`${styles.graphLines} ${styles.domainGraphLines}`} width={layout.width} height={layout.height} aria-label={`${displayed.length} 条概念关系`}>
          <defs><marker id={marker} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1 L7 4 L1 7" fill="none" stroke="currentColor" /></marker></defs>
          {displayed.map((edge, index) => {
            const from = layout.nodes.find((node) => node.id === edge.from)!, to = layout.nodes.find((node) => node.id === edge.to)!;
            const same = from.x === to.x, sign = to.x > from.x ? 1 : -1;
            const x1 = same ? from.x + 5 : from.x + (sign > 0 ? 200 : 0), y1 = from.y + 30;
            const x2 = same ? to.x + 5 : to.x + (sign > 0 ? 0 : 200), y2 = to.y + 30;
            const lane = 77 + index % 5 * 82;
            const d = same ? `M${x1},${y1} C${x1 - 26},${y1} ${x2 - 26},${y2} ${x2},${y2}` : `M${x1},${y1} C${x1 + sign * 23},${y1} ${x1 + sign * 23},${lane} ${x1 + sign * 28},${lane} L${x2 - sign * 28},${lane} C${x2 - sign * 23},${lane} ${x2 - sign * 23},${y2} ${x2},${y2}`;
            return <g key={edge.id} tabIndex={0} role="img" aria-label={`${from.title} ${edge.label} ${to.title}；${edge.direction === 'undirected' ? '无向比较' : '有向联系'}；${edge.description}；${edge.verification}`} data-comparison={edge.direction === 'undirected'} data-active={!selected || edge.from === selected || edge.to === selected}><title>{from.title} {edge.label} {to.title}。{edge.description}</title><path d={d} markerEnd={edge.direction === 'undirected' ? undefined : `url(#${marker})`} /><text x={same ? x1 - 12 : (x1 + x2) / 2} y={same ? (y1 + y2) / 2 : lane - 5} textAnchor={same ? 'end' : 'middle'}>{edge.label}</text></g>;
          })}
        </svg>
        {layout.nodes.map((node) => <button type="button" id={`node-${node.id}`} key={node.id} className={styles.graphNode} data-root={!node.parent} data-selected={selected === node.id} data-muted={!!selected && !neighbors.has(node.id) && selected !== node.parent} style={{ left: node.x, top: node.y }} aria-pressed={selected === node.id} onClick={() => onSelect(node.id)}><span><strong>{node.title}</strong><small>{node.lesson?.role ?? '主题导读'}</small></span></button>)}
      </div>
    </div>
    <details className={styles.graphTextList}><summary>用文字查看当前 {displayed.length} 条联系</summary>{displayed.map((edge) => <p key={edge.id}><button type="button" onClick={() => onSelect(edge.from)}>{allNodes.find((node) => node.id === edge.from)?.title}</button> {edge.label} · <button type="button" onClick={() => onSelect(edge.to)}>{allNodes.find((node) => node.id === edge.to)?.title}</button><span>{edge.description} 依据：{edge.sources.join('、')} · 待核实</span></p>)}</details>
    <p className={styles.graphNote}>悬停或键盘聚焦连线查看标签；选择节点阅读全部直接联系。虚线表示比较，不表示核实状态。拖动画布或用方向键平移。</p>
  </section>;
}
