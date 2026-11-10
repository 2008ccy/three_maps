'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowUpRight, BookOpen, Boxes, Compass, MessagesSquare, RotateCcw } from 'lucide-react';
import { mapLabels, type MapKey } from '@/lib/map-labels';
import type { AtlasEdge, AtlasNode } from '@/lib/maps/task-atlas';
import styles from './task-atlas.module.css';

const icons = [BookOpen, Boxes, Compass];
const x = (column: number) => 365 + column * 282;
const y = (row: number) => 72 + row * 95;

function wire(a: AtlasNode, b: AtlasNode) {
  const [left, right] = a.column <= b.column ? [a, b] : [b, a];
  const start = x(left.column) + 94, end = x(right.column) - 94;
  const sy = y(left.row), ey = y(right.row);
  if (left.column === right.column) {
    const bend = start + 25;
    return `M${start} ${sy} C${bend} ${sy},${bend} ${ey},${start} ${ey}`;
  }
  if (right.column - left.column > 1) {
    const bypass = Math.min(sy, ey) - 37;
    return `M${start} ${sy} C${start+35} ${sy},${start+35} ${bypass},${start+60} ${bypass} H${end-60} Q${end-30} ${bypass},${end-20} ${ey-14} T${end} ${ey}`;
  }
  return `M${start} ${sy} C${start+55} ${sy},${end-55} ${ey},${end} ${ey}`;
}

export function TaskAtlas({ nodes, edges }: { nodes: AtlasNode[]; edges: AtlasEdge[] }) {
  const [map, setMap] = useState<MapKey | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const visible = nodes.filter((node) => !map || node.map === map);
  const visibleEdges = edges.filter((edge) => visible.some((n) => n.id === edge.from) && visible.some((n) => n.id === edge.to));
  const adjacent = new Set([active, ...visibleEdges.flatMap((e) => e.from === active ? [e.to] : e.to === active ? [e.from] : [])]);
  const branches = visible.filter((n) => map || n.column === 0);
  const select = (id: MapKey | null) => { setMap(id); setActive(null); setResetKey((n) => n + 1); };
  return <section className={styles.atlas} aria-labelledby="atlas-title">
    <header className={styles.bar}><h2 id="atlas-title">三张地图的联系</h2>
      <div role="group" aria-label="按地图筛选" className={styles.filters}>
        <button type="button" aria-pressed={!map} onClick={() => select(null)}>全部</button>
        {mapLabels.map(({ id, title }) => <button type="button" key={id} data-map={id} aria-pressed={map === id} onClick={() => select(id)}><i />{title.slice(0, 2)}</button>)}
      </div>
      <button className={styles.reset} onClick={() => select(null)}><RotateCcw size={14} />重置视图</button>
    </header>
    <div className={styles.diagram} onMouseLeave={() => setActive(null)}>
      <svg viewBox="0 0 1100 310" preserveAspectRatio="none" aria-hidden="true">
        {branches.map((n) => <path key={n.id} data-muted={!!active && !adjacent.has(n.id)} className={styles.trunk}
          d={`M185 167 C230 167,220 ${y(n.row)},${x(n.column)-94} ${y(n.row)}`} />)}
        {visibleEdges.map((e) => <path key={e.from+e.to} data-active={!!active && [e.from,e.to].includes(active)}
          data-muted={!!active && ![e.from,e.to].includes(active)}
          d={wire(nodes.find((n) => n.id === e.from)!, nodes.find((n) => n.id === e.to)!)}><title>{e.label}</title></path>)}
      </svg>
      <Link className={styles.hub} href="/docs/domain/#node-task"><MessagesSquare size={20} /><strong>课程答疑助手</strong></Link>
      {mapLabels.map(({ id, title }, i) => (!map || id === map) && <span key={id} className={styles.lane} data-map={id} style={{ left: x(i)/11+'%' }}>{title}</span>)}
      {visible.map((n) => {
        const Icon = icons[n.column];
        return <Link key={n.id} href={n.href} title={n.caption} data-map={n.map} data-muted={!!active && !adjacent.has(n.id)}
          data-active={active === n.id} className={styles.node} style={{ left: x(n.column)/11+'%', top: y(n.row)/3.1+'%' }}
          onMouseEnter={() => setActive(n.id)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(n.id)} onBlur={() => setActive(null)}>
          <Icon size={16} /><strong>{n.title}</strong><ArrowUpRight size={12} />
        </Link>;
      })}
    </div>
    <div className={styles.tree} key={resetKey}><Link href="/docs/domain/#node-task"><MessagesSquare size={17} />课程答疑助手</Link>
      {mapLabels.filter(({id}) => !map || id === map).map(({ id, title }) => <details key={id} data-map={id} open={!!map}>
        <summary>{title}</summary>
        {visible.filter((n) => n.map === id).map((n) => <div key={n.id}><Link href={n.href}>{n.caption}<ArrowUpRight size={14} /></Link>
          <small>关联节点</small>{edges.filter((e) => e.from === n.id || e.to === n.id).map((e) => {
            const target = nodes.find((item) => item.id === (e.from === n.id ? e.to : e.from))!;
            return <Link className={styles.treeTag} href={target.href} key={target.id}>{target.title}</Link>;
          })}</div>)}</details>)}
    </div>
  </section>;
}
