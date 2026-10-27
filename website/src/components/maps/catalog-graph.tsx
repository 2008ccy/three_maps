'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Focus, Minus, Plus, RotateCcw } from 'lucide-react';
import type { CatalogNode, MapEdge } from '@/lib/maps/catalog';
import styles from './maps.module.css';

export function CatalogGraph({ nodes, edges, selected, onSelect }: { nodes: CatalogNode[]; edges: MapEdge[]; selected: string | null; onSelect: (id: string) => void }) {
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(null);
  const [size, setSize] = useState({ width: 1000, height: 600 });
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: 1 });
  const marker = useId().replace(/:/g, '');
  const layout = useMemo(() => {
    const groups = [...new Set(nodes.map((node) => node.groupId))];
    const columns = [64, 64, 64];
    const positioned = nodes.map((node) => {
      const groupIndex = groups.indexOf(node.groupId);
      const column = groupIndex % 3;
      const preceding = nodes.filter((item) => item.groupId === node.groupId);
      const index = preceding.findIndex((item) => item.id === node.id);
      const start = columns[column];
      const y = start + index * 82;
      if (index === preceding.length - 1) columns[column] += preceding.length * 82 + 90;
      return { ...node, x: 32 + column * 356 + Math.min(node.depth, 2) * 22, y };
    });
    return { nodes: positioned, height: Math.max(...columns, 600), width: Math.min(groups.length, 3) * 356 + 40 };
  }, [nodes]);
  const visibleEdges = edges.filter((edge) => layout.nodes.some((node) => node.id === edge.from) && layout.nodes.some((node) => node.id === edge.to));
  const neighbors = new Set([selected, ...visibleEdges.filter((edge) => edge.from === selected || edge.to === selected).flatMap((edge) => [edge.from, edge.to])]);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setSize({ width: element.clientWidth, height: element.clientHeight }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const reset = () => {
    const scale = Math.min(1, size.width / layout.width, size.height / layout.height);
    setCamera({ x: (size.width - layout.width * scale) / 2, y: 0, scale });
  };
  useEffect(() => { setCamera({ x: 0, y: 0, scale: 1 }); }, [layout.width, nodes, size.width]);
  const focus = () => {
    const node = layout.nodes.find((item) => item.id === selected);
    if (node) setCamera({ x: size.width / 2 - (node.x + 118), y: size.height / 2 - (node.y + 26), scale: 1 });
  };
  useEffect(() => { if (selected) focus(); }, [selected, size.width]); // eslint-disable-line react-hooks/exhaustive-deps
  const zoom = (factor: number) => setCamera((current) => {
    const scale = Math.min(2, Math.max(.35, current.scale * factor));
    const ratio = scale / current.scale;
    return { scale, x: size.width / 2 - (size.width / 2 - current.x) * ratio, y: size.height / 2 - (size.height / 2 - current.y) * ratio };
  });
  return <section className={styles.graph} aria-label="知识关系图">
    <div className={styles.graphHeader}><div><strong>沿着关系，理解知识</strong><span>实线：包含与关联　虚线箭头：指导与反馈</span></div><div className={styles.graphControls}>
      <button type="button" aria-label="缩小关系图" onClick={() => zoom(1 / 1.2)}><Minus size={16} /></button><output>{Math.round(camera.scale * 100)}%</output><button type="button" aria-label="放大关系图" onClick={() => zoom(1.2)}><Plus size={16} /></button>
      <button type="button" aria-label="聚焦所选节点" disabled={!selected} onClick={focus}><Focus size={16} /></button><button type="button" aria-label="恢复关系图总览" onClick={reset}><RotateCcw size={16} /></button>
    </div></div>
    <div ref={viewport} className={styles.graphViewport} tabIndex={0} aria-label="可拖动关系画布，方向键平移，使用上方按钮缩放" onKeyDown={(event) => {
      const moves: Record<string, [number, number]> = { ArrowLeft: [60, 0], ArrowRight: [-60, 0], ArrowUp: [0, 60], ArrowDown: [0, -60] };
      if (event.target !== event.currentTarget || !moves[event.key]) return;
      event.preventDefault(); const [x, y] = moves[event.key]; setCamera((current) => ({ ...current, x: current.x + x, y: current.y + y }));
    }} onPointerDown={(event) => {
      if ((event.target as Element).closest('button')) return;
      drag.current = { x: event.clientX, y: event.clientY, tx: camera.x, ty: camera.y, moved: false };
      event.currentTarget.setPointerCapture(event.pointerId);
    }} onPointerMove={(event) => {
      if (!drag.current) return;
      const dx = event.clientX - drag.current.x, dy = event.clientY - drag.current.y;
      drag.current.moved = Math.abs(dx) + Math.abs(dy) > 4;
      setCamera((current) => ({ ...current, x: drag.current!.tx + dx, y: drag.current!.ty + dy }));
    }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      <div className={styles.graphWorld} style={{ width: layout.width, height: layout.height, transform: `translate(${camera.x}px,${camera.y}px) scale(${camera.scale})` }}>
        <svg className={styles.graphLines} width={layout.width} height={layout.height} aria-label={`${visibleEdges.length} 条图内关系`}>
          <defs><marker id={marker} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M1 1 L7 4 L1 7" fill="none" stroke="currentColor" /></marker></defs>
          {visibleEdges.map((edge, index) => {
            const from = layout.nodes.find((node) => node.id === edge.from)!, to = layout.nodes.find((node) => node.id === edge.to)!;
            const sameGroup = from.groupId === to.groupId;
            const x1 = sameGroup ? from.x + 12 : from.x + 124, y1 = from.y + 49, x2 = sameGroup ? to.x + 12 : to.x + 124, y2 = to.y - 3;
            const bend = sameGroup ? Math.min(x1, x2) - 18 - index % 3 * 6 : (x1 + x2) / 2;
            const d = sameGroup ? `M${x1},${y1} C${bend},${y1} ${bend},${y2} ${x2},${y2}` : `M${x1},${y1} C${x1},${(y1+y2)/2} ${x2},${(y1+y2)/2} ${x2},${y2}`;
            return <g key={edge.id} data-edge-kind={edge.kind} opacity={selected && edge.from !== selected && edge.to !== selected ? .15 : 1}>
              <title>{from.title} → {to.title}：{edge.label}；依据待核实</title><path d={d} markerEnd={`url(#${marker})`} />
              <text x={sameGroup ? Math.max(12, bend + 5) : bend} y={(y1+y2)/2} textAnchor={sameGroup ? 'start' : 'middle'}>{edge.label}</text>
            </g>;
          })}
        </svg>
        {layout.nodes.map((node) => <button type="button" id={`node-${node.id}`} key={node.id} className={styles.graphNode} data-root={node.depth === 0} data-selected={selected === node.id} data-muted={!!selected && !neighbors.has(node.id)} style={{ left: node.x, top: node.y }} aria-pressed={selected === node.id} onClick={() => onSelect(node.id)}><span className={styles.nodeDot} /><span><strong>{node.title}</strong><small>{node.depth === 0 ? node.type : node.group}</small></span></button>)}
      </div>
    </div>
    <p className={styles.graphNote}>拖动画布或用方向键平移 · 点击节点阅读 · 关系含义与核实状态分别展示，附有来源不代表已核实</p>
  </section>;
}
