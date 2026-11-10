'use client';

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ArrowUpRight, ChevronRight, Focus, Minus, Plus, RotateCcw } from 'lucide-react';
import type { RadialGraphModel, RelationLine } from '@/lib/maps/radial-graph';
import { radialLayout, relationPath, spokePath } from '@/lib/maps/radial-layout';
import { zoomGraphCamera } from '@/lib/maps/graph-camera';
import styles from './maps.module.css';
import radial from './radial-graph.module.css';

type Props = {
  graph: RadialGraphModel; title: string; pinned: RelationLine | undefined;
  onPin: (line: RelationLine) => void; onSelect: (id: string) => void; onExplore: (id: string) => void;
};

export function RadialCanvas({ graph, title, pinned, onPin, onSelect, onExplore }: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const [size, setSize] = useState({ width: 900, height: 480 });
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: 1 });
  const [highlight, setHighlight] = useState('');
  const marker = useId();
  const layout = useMemo(() => radialLayout(graph.hub, graph.satellites.map(node => node.id), graph.lines, size), [graph, size]);
  const { width, height } = layout;
  const scale = Math.min(1, size.width / width, size.height / height);
  const fitX = (size.width - width * scale) / 2, fitY = (size.height - height * scale) / 2;
  const fit = () => setCamera({ x: fitX, y: fitY, scale });
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth && element.clientHeight) setSize({ width: element.clientWidth, height: element.clientHeight });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { setCamera({ x: fitX, y: fitY, scale }); }, [graph.hub, fitX, fitY, scale]);
  const zoom = (factor: number) => setCamera(current => zoomGraphCamera(current, factor, size, layout));
  const center = layout.boxes[0];
  const isPoint = !!graph.focus?.parent;
  const routes = useMemo(() => graph.lines.map(line => ({
    line, ...relationPath(layout.byId.get(line.from)!, layout.byId.get(line.to)!, layout),
  })), [graph.lines, layout]);
  const related = new Set([highlight, ...graph.lines.filter(line => line.from === highlight || line.to === highlight).flatMap(line => [line.from, line.to])]);
  function position(box: typeof center): CSSProperties {
    return { left: box.x - box.width / 2, top: box.y - box.height / 2, width: box.width, height: box.height };
  }
  function lineLabel(line: RelationLine) {
    const pair = `${graph.byId.get(line.from)!.title}、${graph.byId.get(line.to)!.title}`;
    return `${pair} · ${line.edges.length === 1 ? line.edges[0].label : line.edges.length + ' 条联系'}`;
  }
  return <>
    <div className={radial.canvasBar}>
      <div className={radial.legend}>
        {!isPoint && <span><i className={radial.spokeKey} />主题归属</span>}
        <span><i className={radial.arrowKey} />有向联系</span>
        {graph.lines.some(line => line.edges.every(edge => edge.direction === 'undirected')) && <span><i className={radial.dashKey} />比较或互补</span>}
        {graph.lines.some(line => line.edges.every(edge => edge.kind === 'feedback')) && <span><i className={radial.feedbackKey} />指导与反馈</span>}
      </div>
      <div className={styles.graphControls}>
        <button type="button" aria-label="缩小关系图" onClick={() => zoom(1 / 1.2)}><Minus size={15} /></button>
        <output>{Math.round(camera.scale * 100)}%</output>
        <button type="button" aria-label="放大关系图" onClick={() => zoom(1.2)}><Plus size={15} /></button>
        <button type="button" aria-label="聚焦所选节点" disabled={!graph.focus} onClick={() => setCamera({ x: size.width / 2 - center.x, y: size.height / 2 - center.y, scale: 1 })}><Focus size={15} /></button>
        <button type="button" aria-label="恢复关系图总览" onClick={() => { fit(); onExplore(''); }}><RotateCcw size={15} /></button>
      </div>
    </div>
    <div ref={viewport} className={`${styles.graphViewport} ${radial.viewport}`} tabIndex={0} aria-label="关系画布，可拖动或用方向键平移"
      onKeyDown={event => {
        const moves: Record<string, [number, number]> = { ArrowLeft: [60, 0], ArrowRight: [-60, 0], ArrowUp: [0, 60], ArrowDown: [0, -60] };
        if (event.target !== event.currentTarget || !moves[event.key]) return;
        event.preventDefault();
        const [dx, dy] = moves[event.key];
        setCamera(current => ({ ...current, x: current.x + dx, y: current.y + dy }));
      }}
      onPointerDown={event => {
        if (event.button !== 0 || (event.target as Element).closest('button, [role="button"]')) return;
        drag.current = { x: event.clientX, y: event.clientY, tx: camera.x, ty: camera.y };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        const origin = drag.current;
        if (origin) setCamera(current => ({ ...current, x: origin.tx + event.clientX - origin.x, y: origin.ty + event.clientY - origin.y }));
      }}
      onLostPointerCapture={() => { drag.current = null; }}>
      <div className={styles.graphWorld} style={{ width, height, transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})` }}>
        <svg className={radial.lines} width={width} height={height} aria-label={`${graph.lines.length} 组关系连线`}>
          <defs><marker id={marker} viewBox="0 0 8 8" refX="7.5" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L8 4 L0 8 Z" fill="context-stroke" /></marker></defs>
          {!isPoint && layout.boxes.slice(1).map(box => <path key={box.id} className={radial.spoke} d={spokePath(center, box)} />)}
          {routes.map(({ line, d, label }) => {
            const arrow = `url(#${marker})`;
            const comparison = line.edges.every(edge => edge.direction === 'undirected');
            const feedback = line.edges.every(edge => edge.kind === 'feedback');
            return <g key={line.from + '/' + line.to} className={radial.relation} role="button" tabIndex={0}
              aria-label={lineLabel(line)} aria-pressed={pinned === line}
              data-muted={!!highlight && line.from !== highlight && line.to !== highlight}
              data-feedback={feedback} data-comparison={comparison} data-category={line.edges.every(edge => edge.category === line.edges[0].category) ? line.edges[0].category : undefined}
              onClick={() => onPin(line)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onPin(line); } }}>
              <title>{lineLabel(line)}</title>
              <path className={radial.hit} d={d} />
              <path className={radial.wire} d={d} markerStart={line.arrow === 'both' ? arrow : undefined} markerEnd={line.arrow !== 'none' ? arrow : undefined} />
              {line.edges.length > 1 && <g className={radial.edgeCount} transform={`translate(${label.x} ${label.y})`}><circle r="10" /><text textAnchor="middle" dy=".35em">{line.edges.length}</text></g>}
            </g>;
          })}
        </svg>
        {graph.focus
          ? <button data-graph-hub="" className={radial.hub} style={position(center)} type="button" id={`node-${graph.hub}`} onClick={() => onSelect(graph.hub)}>
            <strong>{graph.focus.title}</strong><small>阅读{isPoint ? '知识点' : '主题'}<ArrowUpRight size={12} /></small>
          </button>
          : <div data-graph-hub="" tabIndex={-1} className={radial.hub} style={position(center)}><strong>{title}</strong><small>{graph.satellites.length} 个主题</small></div>}
        {graph.satellites.map(node => {
          const count = graph.memberCounts.get(node.id) ?? 0;
          const action = node.parent ? '查看联系' : '展开主题';
          return <div key={node.id} className={radial.node} style={position(layout.byId.get(node.id)!)}
            data-muted={!!highlight && !related.has(node.id)}
            onPointerEnter={event => { if (event.pointerType === 'mouse') setHighlight(node.id); }}
            onPointerLeave={() => setHighlight('')} onFocus={() => setHighlight(node.id)} onBlur={() => setHighlight('')}>
            <button type="button" className={radial.nodeTitle} id={`node-${node.id}`} aria-label={`阅读${node.title}`} title={node.title} onClick={() => onSelect(node.id)}>{node.title}</button>
            <button type="button" className={radial.expand} aria-label={action + ' · ' + node.title} onClick={() => { setHighlight(''); onExplore(node.id); }}>
              {node.parent ? '查看联系' : `${count} 个知识点`}<ChevronRight size={13} />
            </button>
          </div>;
        })}
      </div>
    </div>
  </>;
}
