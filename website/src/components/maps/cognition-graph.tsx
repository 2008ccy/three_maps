'use client';

import { useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { buildCognitionDiagram, type DiagramEdge } from '@/lib/maps/cognition-diagram';
import type { MapDefinition } from '@/lib/maps/types';
import styles from './cognition-graph.module.css';

type Box = { left: number; right: number; top: number; bottom: number; x: number; y: number };
type Line = DiagramEdge & { d: string; labelX?: number; labelY?: number };

export function CognitionGraph({ map, selected, onOpen, stageClassName }: {
  map: MapDefinition; selected: string | null; onOpen: (id: string) => void; stageClassName: string;
}) {
  const graph = useMemo(() => buildCognitionDiagram(map), [map]);
  const canvas = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const marker = useId().replace(/:/g, '');

  useLayoutEffect(() => {
    const root = canvas.current;
    if (!root) return;
    let frame = 0;
    const measure = () => {
      const bounds = root.getBoundingClientRect();
      const boxes = new Map<string, Box>();
      root.querySelectorAll<HTMLElement>('[data-relationship-node]').forEach((node) => {
        const box = node.getBoundingClientRect();
        boxes.set(node.dataset.relationshipNode!, {
          left: box.left - bounds.left, right: box.right - bounds.left,
          top: box.top - bounds.top, bottom: box.bottom - bounds.top,
          x: box.left + box.width / 2 - bounds.left, y: box.top + box.height / 2 - bounds.top,
        });
      });
      const mobile = window.matchMedia('(max-width: 760px)').matches;
      setLines(graph.edges.map((edge) => {
        const from = boxes.get(edge.from)!, to = boxes.get(edge.to)!;
        let d: string, labelX: number | undefined, labelY: number | undefined;
        if (edge.kind === 'feedback') {
          if (mobile) {
            const lane = bounds.width - 8 - (edge.from === 'loss-test' ? 0 : edge.from === 'ranking-task' ? 7 : edge.from === 'cost-api' ? 14 : 21);
            // 手机将反馈线放在右侧留白，文字放在源节点下方的独立间隔内。
            const startY = from.bottom + 22;
            const endY = to.top - 16;
            d = `M ${from.x} ${from.bottom} V ${startY} H ${lane} V ${endY} H ${to.x} V ${to.top - 3}`;
            labelX = (from.left + from.right) / 2; labelY = startY;
          } else if (edge.to === 'revision') {
            const lane = to.left + 32 + ['loss-test', 'ranking-task', 'cost-api'].indexOf(edge.from) * 27;
            d = `M ${from.right} ${from.y} H ${lane} V ${to.bottom + 3}`;
            labelX = lane; labelY = from.y - 12;
          } else {
            const y = Math.min(from.top, to.top) - 22;
            const startX = edge.from === 'perspectives' ? from.right - 24 : from.left + 24;
            const endX = edge.from === 'perspectives' ? to.left + 24 : to.right - 24;
            d = `M ${startX} ${from.top} V ${y} H ${endX} V ${to.top - 3}`;
            labelX = (startX + endX) / 2; labelY = y;
          }
        } else if (mobile) {
          const lane = edge.from === 'root' ? 8 : Math.min(from.left, to.left) - 14;
          d = `M ${from.left} ${from.y} H ${lane} V ${to.y} H ${to.left - 3}`;
        } else if (edge.from === 'root') {
          const y = from.bottom + 20;
          d = `M ${from.x} ${from.bottom} V ${y} H ${to.x} V ${to.top - 3}`;
        } else if (edge.from === 'perspectives' || edge.from === 'analysis-methods') {
          const lane = to.left - 18;
          d = `M ${from.left + 14} ${from.bottom} V ${from.bottom + 16} H ${lane} V ${to.y} H ${to.left - 3}`;
        } else {
          d = `M ${from.right} ${from.y} H ${to.left - 3}`;
        }
        return { ...edge, d, labelX, labelY };
      }));
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(schedule);
    observer.observe(root);
    root.querySelectorAll('[data-relationship-node]').forEach((node) => observer.observe(node));
    window.addEventListener('resize', schedule);
    schedule();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('resize', schedule); };
  }, [graph]);

  return <div ref={canvas} className={`${stageClassName} ${styles.canvas}`} data-cognition-diagram>
    <svg className={styles.edges} role="img" aria-label="13 条实线表示内容归属，5 条虚线表示指导与反馈；箭头指向关系的目标">
      <defs><marker id={marker} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 1 1 L 7 4 L 1 7" /></marker></defs>
      {lines.map((edge) => <g key={`${edge.from}:${edge.to}`} data-edge-from={edge.from} data-edge-to={edge.to} data-edge-kind={edge.kind}
        data-active={[selected, active].some((id) => id === edge.from || id === edge.to)}>
        <title>{graph.nodes.find((node) => node.id === edge.from)?.title} → {graph.nodes.find((node) => node.id === edge.to)?.title}{edge.label && `：${edge.label}`}</title>
        <path d={edge.d} markerEnd={`url(#${marker})`} />
        {edge.label && <g className={styles.edgeLabel} transform={`translate(${edge.labelX},${edge.labelY})`}><rect x="-39" y="-9" width="78" height="18" rx="5" /><text textAnchor="middle" dominantBaseline="central">{edge.label}</text></g>}
      </g>)}
    </svg>
    {graph.nodes.map((node) => node.kind === 'root' ? <div key={node.id} className={styles.root} data-relationship-node={node.id}>
      <span>COGNITION / 探索和判断的方法</span><h1 id="map-title" tabIndex={-1}>{node.title}</h1><p>怎样理解 · 比较 · 检验</p>
    </div> : <button key={node.id} id={`node-${node.id}`} type="button" className={styles.node} data-relationship-node={node.id} data-diagram-kind={node.kind}
      style={{ '--column': node.column, '--row': node.row } as CSSProperties}
      aria-pressed={selected === node.id} aria-haspopup="dialog" aria-controls={selected === node.id ? 'map-reading-panel' : undefined}
      onClick={() => onOpen(node.id)} onMouseEnter={() => setActive(node.id)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(node.id)} onBlur={() => setActive(null)}>
      <strong>{node.title}</strong><span>{node.kind === 'branch' || node.kind === 'view' ? node.summary : node.kind === 'method' ? '分析方法组合' : '检验 · 解释 · 适用边界'}<ArrowUpRight size={12} aria-hidden /></span>
    </button>)}
    <p className={styles.note}>实线：内容归属　虚线：指导与反馈<br />从三个观选择方法 → 用案例检验 → 修正认识 → 反哺习惯。点击节点查看解释与依据。</p>
  </div>;
}
