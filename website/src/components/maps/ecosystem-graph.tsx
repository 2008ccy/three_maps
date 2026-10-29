'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Focus, Minus, Plus, RotateCcw } from 'lucide-react';
import type { CatalogNode, MapEdge } from '@/lib/maps/catalog';
import { ecosystemGraphSlice } from '@/lib/maps/ecosystem-graph';
import styles from './maps.module.css';

type Props = { nodes: CatalogNode[]; allNodes: CatalogNode[]; edges: MapEdge[]; selected: string | null; stage: string; scope: 'core' | 'all'; onStage: (stage: string) => void; onScope: (scope: 'core' | 'all') => void; onSelect: (id: string) => void };
export function EcosystemGraph({ nodes, allNodes, edges, selected, stage, scope, onStage, onScope, onSelect }: Props) {
  const viewport = useRef<HTMLDivElement>(null), drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const [size, setSize] = useState({ width: 1200, height: 600 });
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: 1 });
  const marker = useId().replace(/:/g, ''), priorStage = useRef<string | null>(null);
  const graph = useMemo(() => ecosystemGraphSlice(nodes, allNodes, edges, stage, selected, scope), [nodes, allNodes, edges, stage, selected, scope]);
  const neighbors = new Set([selected, ...graph.edges.filter((edge) => edge.from === selected || edge.to === selected).flatMap((edge) => [edge.from, edge.to])]);
  useEffect(() => { const element = viewport.current; if (!element) return; const observer = new ResizeObserver(() => setSize({ width: element.clientWidth, height: element.clientHeight })); observer.observe(element); return () => observer.disconnect(); }, []);
  const resetCamera = () => setCamera({ x: Math.max(12, (size.width - graph.width) / 2), y: 8, scale: 1 });
  const focus = () => { const node = graph.nodes.find((node) => node.id === selected); if (node) setCamera({ x: size.width / 2 - (node.x + 110), y: size.height / 2 - (node.y + 40), scale: 1 }); };
  useEffect(() => { if (selected) focus(); else resetCamera(); }, [size.width, size.height]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (priorStage.current !== graph.stage) { priorStage.current = graph.stage; if (!selected) resetCamera(); } if (selected) focus(); }, [graph.stage, selected]); // eslint-disable-line react-hooks/exhaustive-deps
  const reset = () => { onStage(''); resetCamera(); };
  const zoom = (factor: number) => setCamera((current) => { const scale = Math.max(.5, Math.min(1.8, current.scale * factor)), ratio = scale / current.scale; return { scale, x: size.width / 2 - (size.width / 2 - current.x) * ratio, y: size.height / 2 - (size.height / 2 - current.y) * ratio }; });
  return <section className={`${styles.graph} ${styles.domainGraph} ${styles.ecosystemGraph}`} aria-label="生态关系图">
    <header className={styles.graphHeader}><div><strong>{graph.stage ? '展开环节，追到直接关联' : '七个环节，先看交接骨架'}</strong><span>七环节是观察方式；适配按需，评测贯穿，托管服务可以绕过本地权重获取。</span></div><div className={styles.graphControls}>
      <button type="button" aria-label="缩小关系图" onClick={() => zoom(1 / 1.2)}><Minus size={16} /></button><output>{Math.round(camera.scale * 100)}%</output><button type="button" aria-label="放大关系图" onClick={() => zoom(1.2)}><Plus size={16} /></button><button type="button" aria-label="聚焦所选节点" disabled={!graph.nodes.some((node) => node.id === selected)} onClick={focus}><Focus size={16} /></button><button type="button" aria-label="恢复关系图总览" onClick={reset}><RotateCcw size={16} /></button>
    </div></header>
    <div className={styles.ecosystemGraphToolbar}><label>查看环节<select aria-label="关系图环节" value={graph.stage} onChange={(event) => onStage(event.target.value)}><option value="">全链路总览</option>{allNodes.filter((node) => !node.parent).map((node) => <option value={node.id} key={node.id}>{node.title}</option>)}</select></label><p>点击节点打开阅读；用环节选择展开图层。标签按正常字号排布，窄屏可拖动。</p></div>
    <div className={styles.relationScope} role="group" aria-label="生态关系范围"><button type="button" aria-pressed={scope === 'core'} onClick={() => onScope('core')}>本层核心 · {graph.eligible.filter((edge) => edge.core).length}</button><button type="button" aria-pressed={scope === 'all'} onClick={() => onScope('all')}>本层全部 · {graph.eligible.length}</button><span>当前 {graph.edges.length} 条 · 全图 {edges.length} 条生态联系</span></div>
    <p className={styles.ecosystemLegend}><span data-category="贡献">贡献</span><span data-category="交接">交接</span><span data-category="资源与成本">资源与成本</span><span data-category="证据与修订">证据与修订</span><span>箭头：有向 · 无箭头虚线：比较 · 核实状态见节点来源</span></p>
    <div ref={viewport} className={styles.graphViewport} tabIndex={0} aria-label="可拖动关系画布，方向键平移" onKeyDown={(event) => {
      const moves: Record<string, [number, number]> = { ArrowLeft: [60, 0], ArrowRight: [-60, 0], ArrowUp: [0, 60], ArrowDown: [0, -60] };
      if (event.target !== event.currentTarget || !moves[event.key]) return; event.preventDefault(); const [x, y] = moves[event.key]; setCamera((current) => ({ ...current, x: current.x + x, y: current.y + y }));
    }} onPointerDown={(event) => { if ((event.target as Element).closest('button,a')) return; drag.current = { x: event.clientX, y: event.clientY, tx: camera.x, ty: camera.y }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (drag.current) setCamera((current) => ({ ...current, x: drag.current!.tx + event.clientX - drag.current!.x, y: drag.current!.ty + event.clientY - drag.current!.y })); }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      <div className={styles.graphWorld} style={{ width: graph.width, height: graph.height, transform: 'translate(' + camera.x + 'px,' + camera.y + 'px) scale(' + camera.scale + ')' }}>
        <svg className={`${styles.graphLines} ${styles.domainGraphLines} ${styles.ecosystemLines}`} data-overview={!graph.stage} width={graph.width} height={graph.height} aria-label={graph.edges.length + ' 条生态联系'}><defs><marker id={marker} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1 L7 4 L1 7" fill="none" stroke="currentColor" /></marker></defs>
          {graph.edges.map((edge, index) => {
            const from = graph.nodes.find((node) => node.id === edge.from)!, to = graph.nodes.find((node) => node.id === edge.to)!;
            const same = from.x === to.x, right = to.x > from.x;
            const x1 = from.x + (same ? 220 : right ? 220 : 0), y1 = from.y + 40;
            const x2 = to.x + (same ? 220 : right ? 0 : 220), y2 = to.y + 40;
            const bend = same ? 35 + index % 3 * 16 : Math.max(24, Math.abs(x2 - x1) * .35), sign = right ? 1 : -1;
            const d = same ? 'M' + x1 + ',' + y1 + ' C' + (x1 + bend) + ',' + y1 + ' ' + (x2 + bend) + ',' + y2 + ' ' + x2 + ',' + y2 : 'M' + x1 + ',' + y1 + ' C' + (x1 + sign * bend) + ',' + y1 + ' ' + (x2 - sign * bend) + ',' + y2 + ' ' + x2 + ',' + y2;
            const labelY = !graph.stage && from.y === to.y ? from.y - 16 : (y1 + y2) / 2 - 9;
            return <g key={edge.id} tabIndex={0} role="img" aria-label={from.title + ' ' + edge.label + ' ' + to.title + '；' + edge.description + '；' + edge.verification} data-category={edge.category} data-comparison={edge.direction === 'undirected'} data-active={!selected || edge.from === selected || edge.to === selected}><title>{from.title} {edge.label} {to.title}。{edge.description}</title><path d={d} markerEnd={edge.direction === 'undirected' ? undefined : 'url(#' + marker + ')'} /><text x={same ? x1 + (graph.stage ? bend : 20) : (x1 + x2) / 2} y={labelY} textAnchor="middle">{edge.label}</text></g>;
          })}
        </svg>
        {graph.nodes.map((node) => <button type="button" key={node.id} id={'node-' + node.id} className={styles.graphNode} data-root={!node.parent} data-selected={selected === node.id} data-muted={!!selected && !neighbors.has(node.id) && node.id !== graph.stage} style={{ left: node.x, top: node.y }} aria-pressed={selected === node.id} onClick={() => onSelect(node.id)}><span><strong>{node.title}</strong><small>{node.parent ? node.lesson?.role : '环节导读 · 点击阅读'}</small></span></button>)}
      </div>
    </div>
    <details className={styles.graphTextList}><summary>用文字查看当前 {graph.edges.length} 条联系</summary>{graph.edges.map((edge) => <p key={edge.id}><button type="button" onClick={() => onSelect(edge.from)}>{allNodes.find((node) => node.id === edge.from)?.title}</button> {edge.label} · <button type="button" onClick={() => onSelect(edge.to)}>{allNodes.find((node) => node.id === edge.to)?.title}</button><span>{edge.category} · {edge.description} 依据：{edge.sources.join('、')} · {edge.verification}</span></p>)}</details>
    <p className={styles.graphNote}>展开环节后查看条目；选中条目显示其全部直接联系，其他内容降低强调。悬停或聚焦连线看标签；虚线不表示待核实。</p>
  </section>;
}
