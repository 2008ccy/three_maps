'use client';

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import { BookOpen, Focus, Minus, Plus, RotateCcw, Scan } from 'lucide-react';
import { nodeKey, type ExpandedGraph, type NodeRef } from '@/lib/maps/expanded-graph';
import { expandedLayout, graphBounds } from '@/lib/maps/expanded-layout';
import { cameraTransitionDuration, interpolateCamera, dragThreshold, elasticPan, panInput, stepPanGravity, movingPath, stepGraphMotion, stillMotion, type Camera, type Motion } from '@/lib/maps/graph-motion';
import radial from './radial-graph.module.css';

type Drag = { pointer: number; x: number; y: number; previousX: number; previousY: number; pan: { x: number; y: number }; key?: string; moved: boolean };
type Props = { graph: ExpandedGraph; pinned: string; selected: NodeRef | null; focus: string; onPin: (key: string) => void; onSelect: (ref: NodeRef) => void; onToggle: (id: string) => void; onCollapse: () => void };

export function RadialCanvas({ graph, pinned, selected, focus, onPin, onSelect, onToggle, onCollapse }: Props) {
  const viewport = useRef<HTMLDivElement>(null), world = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 900, height: 650, measured: false });
  const cameraRef = useRef<Camera>({ x: -1150, y: -1275, scale: 1 });
  const cameraFlight = useRef<{ from: Camera; to: Camera; startedAt: number; size: typeof size } | null>(null);
  const zoomLabel = useRef<HTMLOutputElement>(null);
  const [highlight, setHighlight] = useState('');
  const drag = useRef<Drag | null>(null), suppressClick = useRef(false);
  const pan = useRef(stillMotion()), keyboardPan = useRef(false);
  const motion = useRef(new Map<string, Motion>()), frame = useRef(0), previousTime = useRef(0), reduced = useRef(false);
  const nodeElements = useRef(new Map<string, HTMLDivElement>()), lineElements = useRef(new Map<string, SVGGElement>());
  const marker = useId();
  const compact = size.width < 600;
  const layout = useMemo(() => expandedLayout(graph, compact), [graph, compact]);
  const layoutRef = useRef(layout); layoutRef.current = layout;
  const neighbors = useMemo(() => {
    const result = new Map<string, string[]>();
    graph.lines.forEach(line => { result.set(line.from, [...result.get(line.from) ?? [], line.to]); result.set(line.to, [...result.get(line.to) ?? [], line.from]); });
    return result;
  }, [graph.lines]);
  const neighborRef = useRef(neighbors); neighborRef.current = neighbors;
  const nodeSignature = graph.nodes.map(node => node.key).join('|');
  const selectedKey = selected ? nodeKey(selected) : '';
  const active = highlight || selectedKey;
  const connected = new Set([active, ...graph.lines.filter(line => line.from === active || line.to === active).flatMap(line => [line.from, line.to])]);

  function paintCamera() {
    const current = cameraRef.current, offset = pan.current;
    if (world.current) world.current.style.transform = `translate(${current.x+offset.x}px, ${current.y+offset.y}px) scale(${current.scale})`;
    if (zoomLabel.current) zoomLabel.current.textContent = `${Math.round(current.scale*100)}%`;
  }
  function stopCameraTransition(finish = false) {
    if (finish && cameraFlight.current) cameraRef.current = cameraFlight.current.to;
    cameraFlight.current = null;
    viewport.current?.setAttribute('data-camera-moving', 'false');
  }
  // Only explicit fit, zoom, focus and resize actions change the resting view.
  const updateCamera = (value: Camera, smooth = true) => {
    const current = cameraRef.current;
    const from = { ...current, x: current.x+pan.current.x, y: current.y+pan.current.y };
    Object.assign(pan.current, stillMotion());
    if (!smooth || !size.measured || reduced.current || document.hidden) {
      stopCameraTransition(); cameraRef.current = value; paintCamera(); return;
    }
    cameraRef.current = from;
    cameraFlight.current = { from, to: value, startedAt: performance.now(), size };
    viewport.current?.setAttribute('data-camera-moving', 'true');
    wake();
  };
  const fitBoxes = (boxes = layout.boxes, minimum = 0, smooth = true) => {
    const bounds = graphBounds(boxes);
    const scale = Math.max(minimum, Math.min(1, size.width / (bounds.right-bounds.left), size.height / (bounds.bottom-bounds.top)));
    updateCamera({ scale, x: size.width/2 - (bounds.left+bounds.right)/2*scale, y: size.height/2 - (bounds.top+bounds.bottom)/2*scale }, smooth);
  };
  const fit = () => fitBoxes();
  const explorationFit = (smooth = true) => {
    const bounds = graphBounds(layout.boxes);
    const fullScale = Math.min(size.width/(bounds.right-bounds.left),size.height/(bounds.bottom-bounds.top));
    const target = graph.nodes.find(node => node.key === focus);
    if (target && fullScale < .75) {
      const keys = new Set(graph.nodes.filter(node => node.kind === 'map' || node.group === target.group).map(node => node.key));
      fitBoxes(layout.boxes.filter(box => keys.has(box.id)), .75, smooth);
    } else fitBoxes(layout.boxes, 0, smooth);
  };
  const fitRef = useRef(explorationFit); fitRef.current = explorationFit;
  const focusNode = () => {
    const box = layout.byId.get(selectedKey || focus) ?? layout.boxes[0];
    const scale = Math.max(.85, cameraRef.current.scale);
    updateCamera({ scale, x: size.width/2-box.x*scale, y: size.height/2-box.y*scale });
  };
  const zoom = (factor: number) => {
    const current = cameraFlight.current?.to ?? cameraRef.current, scale = Math.min(2, Math.max(.15, current.scale*factor)), ratio = scale/current.scale;
    updateCamera({ scale, x: size.width/2-(size.width/2-current.x)*ratio, y: size.height/2-(size.height/2-current.y)*ratio });
  };
  function paintMotion() {
    paintCamera();
    for (const [id, element] of nodeElements.current) {
      const state = motion.current.get(id) ?? stillMotion();
      element.style.transform = `translate(${state.x}px, ${state.y}px)`;
    }
    for (const route of layoutRef.current.routes) {
      const element = lineElements.current.get(route.line.id); if (!element) continue;
      const from = motion.current.get(route.line.from) ?? stillMotion(), to = motion.current.get(route.line.to) ?? stillMotion();
      const path = movingPath(route.d, from, to);
      element.querySelectorAll('path').forEach(element => element.setAttribute('d', path));
      element.querySelector('[data-edge-count]')?.setAttribute('transform', `translate(${route.label.x+(from.x+to.x)/2} ${route.label.y+(from.y+to.y)/2})`);
    }
  }
  const animate = (time: number) => {
    const elapsed = previousTime.current ? (time-previousTime.current)/1000 : 1/60;
    previousTime.current = time;
    const flight = cameraFlight.current;
    if (flight) {
      const progress = (time-flight.startedAt)/cameraTransitionDuration;
      cameraRef.current = interpolateCamera(flight.from, flight.to, progress, flight.size);
      if (progress >= 1) stopCameraTransition();
    }
    const nodesMoving = stepGraphMotion(motion.current, neighborRef.current, elapsed, drag.current?.moved ? drag.current.key : undefined);
    const held = keyboardPan.current || !!drag.current;
    const mapMoving = !held && stepPanGravity(pan.current, elapsed);
    const moving = nodesMoving || mapMoving || !!cameraFlight.current;
    paintMotion();
    if (moving && !reduced.current && !document.hidden) frame.current = requestAnimationFrame(animate);
    else { frame.current = 0; previousTime.current = 0; viewport.current?.setAttribute('data-moving', 'false'); }
  };
  const wake = () => {
    if (reduced.current) { paintMotion(); return; }
    if (!frame.current) { previousTime.current = 0; viewport.current?.setAttribute('data-moving', 'true'); frame.current = requestAnimationFrame(animate); }
  };
  const resetMotion = () => {
    cancelAnimationFrame(frame.current); frame.current = 0; previousTime.current = 0;
    stopCameraTransition();
    Object.assign(pan.current, stillMotion()); keyboardPan.current = false;
    motion.current.forEach(state => Object.assign(state, stillMotion())); paintMotion();
    viewport.current?.setAttribute('data-moving', 'false');
  };
  useEffect(() => {
    const element = viewport.current; if (!element) return;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth && element.clientHeight) setSize({ width: element.clientWidth, height: element.clientHeight, measured: true });
    });
    observer.observe(element);
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const preference = () => { reduced.current = media.matches; if (media.matches) { stopCameraTransition(true); resetMotion(); } };
    const visibility = () => { if (document.hidden) { drag.current = null; stopCameraTransition(true); resetMotion(); } };
    preference(); media.addEventListener('change', preference); document.addEventListener('visibilitychange', visibility);
    return () => { observer.disconnect(); media.removeEventListener('change', preference); document.removeEventListener('visibilitychange', visibility); cancelAnimationFrame(frame.current); };
  }, []);
  useEffect(() => {
    motion.current = new Map(graph.nodes.map(node => [node.key, motion.current.get(node.key) ?? stillMotion()]));
    fitRef.current();
    // A structural change is an explicit exploration action. Reader selection alone keeps the camera.
  }, [nodeSignature]);
  const lastSize = useRef(size);
  useEffect(() => {
    const old = lastSize.current; lastSize.current = size;
    if (!old.measured) { fitRef.current(false); return; }
    if (old.width === size.width && old.height === size.height) return;
    if ((old.width < 600) !== compact) { fitRef.current(); return; }
    const current = cameraFlight.current?.to ?? cameraRef.current;
    updateCamera({ ...current, x: current.x+(size.width-old.width)/2, y: current.y+(size.height-old.height)/2 });
  }, [size]);
  useEffect(() => { paintMotion(); }, [layout]);

  function finish(pointer: number, cancelled = false) {
    const origin = drag.current; if (!origin || origin.pointer !== pointer) return;
    if (origin.moved) suppressClick.current = true;
    drag.current = null;
    viewport.current?.setAttribute('data-dragging', 'false');
    if (cancelled || reduced.current) resetMotion(); else wake();
  }
  const camera = cameraRef.current;
  return <>
    <div className={radial.canvasBar}><div className={radial.legend}><span><i />主题归属</span><span><i className={radial.localKey} />本图联系</span><span><i className={radial.crossKey} />跨图联系</span></div>
      <div className={radial.controls}><button type="button" aria-label="缩小关系图" onClick={() => zoom(1/1.2)}><Minus size={15} /></button><output ref={zoomLabel}>{Math.round(camera.scale*100)}%</output><button type="button" aria-label="放大关系图" onClick={() => zoom(1.2)}><Plus size={15} /></button><button type="button" aria-label="聚焦所选节点" onClick={focusNode}><Focus size={15} /></button><button type="button" aria-label="适应全部节点" onClick={fit}><Scan size={15} /></button><button type="button" aria-label="恢复关系图总览" onClick={() => { resetMotion(); onCollapse(); fit(); }}><RotateCcw size={15} /></button></div>
    </div>
    <div ref={viewport} className={radial.viewport} data-graph-viewport="" data-moving="false" tabIndex={0} aria-label="关系画布，可拖动节点或空白，也可用方向键平移"
      onKeyDown={event => {
        const moves: Record<string, [number, number]> = { ArrowLeft: [60,0], ArrowRight: [-60,0], ArrowUp: [0,60], ArrowDown: [0,-60] };
        if (event.target !== event.currentTarget || !moves[event.key]) return;
        event.preventDefault(); stopCameraTransition(); const [x,y] = moves[event.key], input = panInput(pan.current, size);
        keyboardPan.current = true;
        Object.assign(pan.current, elasticPan({ x: input.x+x, y: input.y+y }, size), { vx: 0, vy: 0 });
        wake();
      }}
      onKeyUp={event => { if (keyboardPan.current && event.key.startsWith('Arrow')) { keyboardPan.current = false; if (reduced.current) resetMotion(); else wake(); } }}
      onBlur={event => { if (event.target === event.currentTarget && keyboardPan.current) { keyboardPan.current = false; if (reduced.current) resetMotion(); else wake(); } }}
      onClickCapture={event => { if (suppressClick.current && event.detail > 0) { event.preventDefault(); event.stopPropagation(); } suppressClick.current = false; }}
      onPointerDown={event => {
        if (event.button !== 0 || drag.current) return;
        const target = event.target as Element;
        if (target.closest('[data-relation]')) return;
        stopCameraTransition();
        suppressClick.current = false;
        const key = target.closest<HTMLElement>('[data-graph-node]')?.dataset.graphNode;
        drag.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, previousX: event.clientX, previousY: event.clientY, pan: panInput(pan.current, size), key: key === graph.hub ? undefined : key, moved: false };
        if (!drag.current.key) { pan.current.vx = 0; pan.current.vy = 0; }
      }}
      onPointerMove={event => {
        const origin = drag.current; if (!origin || origin.pointer !== event.pointerId) return;
        const dx = event.clientX-origin.x, dy = event.clientY-origin.y;
        if (!origin.moved && Math.hypot(dx,dy) <= dragThreshold) return;
        if (!origin.moved) { origin.moved = true; event.currentTarget.setPointerCapture(event.pointerId); event.currentTarget.setAttribute('data-dragging', 'true'); setHighlight(''); }
        if (origin.key) {
          const state = motion.current.get(origin.key); if (state) Object.assign(state, { x: Math.max(-260,Math.min(260,dx/cameraRef.current.scale)), y: Math.max(-260,Math.min(260,dy/cameraRef.current.scale)), vx: 0, vy: 0 });
        } else {
          Object.assign(pan.current, elasticPan({ x: origin.pan.x+dx, y: origin.pan.y+dy }, size), { vx: 0, vy: 0 });
          if (!reduced.current) motion.current.forEach((state, key) => {
            const weight = key === graph.hub ? .25 : .65;
            state.vx -= (event.clientX-origin.previousX)*weight*7; state.vy -= (event.clientY-origin.previousY)*weight*7;
            state.vx = Math.max(-220,Math.min(220,state.vx)); state.vy = Math.max(-220,Math.min(220,state.vy));
          });
        }
        origin.previousX = event.clientX; origin.previousY = event.clientY; wake();
      }}
      onPointerUp={event => finish(event.pointerId)} onPointerCancel={event => finish(event.pointerId, true)} onLostPointerCapture={event => finish(event.pointerId)}
      onPointerLeave={event => { if (drag.current && !drag.current.moved) finish(event.pointerId, true); }}>
      <div ref={world} className={radial.world} style={{ width: layout.width, height: layout.height, transform: `translate(${camera.x+pan.current.x}px, ${camera.y+pan.current.y}px) scale(${camera.scale})` }}>
        <svg className={radial.lines} width={layout.width} height={layout.height} aria-label={`${graph.lines.filter(line => line.kind !== 'hierarchy').length} 组关系连线`}>
          <defs><marker id={marker} viewBox="0 0 8 8" refX="7.5" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L8 4 L0 8 Z" fill="context-stroke" /></marker></defs>
          {layout.routes.map(({ line, d, label }) => <g key={line.id} ref={element => { if (element) lineElements.current.set(line.id, element); else lineElements.current.delete(line.id); }}
            className={radial.relation} data-map={line.kind === 'cross' ? (line.edges[0].sourceMap === graph.map.id ? line.edges[0].targetMap : line.edges[0].sourceMap) : graph.map.id} data-relation={line.kind !== 'hierarchy' ? '' : undefined} data-kind={line.kind} data-muted={!!active && !connected.has(line.from) && !connected.has(line.to)} data-comparison={line.edges.some(edge => edge.direction === 'undirected')}
            role={line.kind !== 'hierarchy' ? 'button' : undefined} tabIndex={line.kind !== 'hierarchy' ? 0 : undefined} aria-pressed={line.kind !== 'hierarchy' ? pinned === line.id : undefined}
            aria-label={line.kind !== 'hierarchy' ? `${graph.byId.get(line.from)?.title ?? graph.nodes.find(node => node.key === line.from)?.node?.title} 与 ${graph.byId.get(line.to)?.title} · ${line.edges.length} 条联系` : undefined}
            onClick={line.kind !== 'hierarchy' ? () => onPin(line.id) : undefined} onKeyDown={event => { if (line.kind !== 'hierarchy' && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onPin(line.id); } }}>
            {line.kind !== 'hierarchy' && <path className={radial.hit} d={d} />}<path className={radial.wire} d={d} markerStart={line.arrow === 'both' ? `url(#${marker})` : undefined} markerEnd={line.arrow !== 'none' ? `url(#${marker})` : undefined} />
            {line.edges.length > 1 && <g data-edge-count="" className={radial.edgeCount} transform={`translate(${label.x} ${label.y})`}><circle r="10" /><text textAnchor="middle" dy=".35em">{line.edges.length}</text></g>}
          </g>)}
        </svg>
        {graph.nodes.map(item => {
          const box = layout.byId.get(item.key)!, node = item.node;
          const expanded = graph.expanded.includes(item.group);
          const style: CSSProperties = { left: box.x-box.width/2, top: box.y-box.height/2, width: box.width, height: box.height };
          return <div key={item.key} ref={element => { if (element) nodeElements.current.set(item.key, element); else nodeElements.current.delete(item.key); }} className={radial.node} style={style} data-graph-node={item.key} data-kind={item.kind} data-map={node?.mapId ?? graph.map.id} data-selected={selectedKey === item.key} data-expanded={item.kind === 'theme' && expanded} data-muted={!!active && !connected.has(item.key)}
            onPointerEnter={event => { if (event.pointerType === 'mouse' && !drag.current?.moved) setHighlight(item.key); }} onPointerLeave={() => setHighlight('')} onFocus={event => {
              setHighlight(item.key);
              if (!(event.target as HTMLElement).matches(':focus-visible')) return;
              const current = cameraRef.current;
              const x = box.x*current.scale+current.x, y = box.y*current.scale+current.y;
              if (x < box.width*current.scale/2 || x > size.width-box.width*current.scale/2 || y < box.height*current.scale/2 || y > size.height-box.height*current.scale/2) {
                updateCamera({ ...current, x: size.width/2-box.x*current.scale, y: size.height/2-box.y*current.scale });
                requestAnimationFrame(() => viewport.current?.scrollIntoView({ block: 'center', behavior: 'instant' }));
              }
            }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setHighlight(''); }}>
            {!node ? <div className={radial.hub} data-graph-hub=""><span>学习地图 {graph.map.number}</span><strong>{graph.map.title}</strong><small>{graph.themes.length} 个主题 · 向外探索</small></div> : <>
              <button type="button" className={radial.nodeTitle} id={node.mapId === graph.map.id ? `node-${node.id}` : `node-${node.mapId}-${node.id}`} aria-label={item.kind === 'theme' ? `${expanded ? '收起' : '展开'}主题：${node.title}` : `阅读${node.title}`} aria-expanded={item.kind === 'theme' ? expanded : undefined} onClick={() => item.kind === 'theme' ? onToggle(node.id) : onSelect({ mapId: node.mapId, nodeId: node.id })}>
                <i aria-hidden="true" /><strong>{node.title}</strong><small>{item.kind === 'theme' ? `${item.count} 个知识点 · ${expanded ? '收起 −' : '展开 +'}` : item.kind === 'external' ? `${node.mapId === 'domain' ? '领域' : node.mapId === 'ecosystem' ? '生态' : '认知'}地图 ↗` : '阅读知识点'}</small>
              </button>
              {item.kind === 'theme' && <button type="button" className={radial.readTopic} aria-label={`阅读主题导读：${node.title}`} title="阅读主题导读" onClick={() => onSelect({ mapId: node.mapId, nodeId: node.id })}><BookOpen size={13} /></button>}
            </>}
          </div>;
        })}
      </div>
      <span className={radial.canvasHint}>拖动牵引 · 松手回到中央附近</span>
    </div>
  </>;
}
