import type { CatalogNode, MapEdge } from '@/lib/maps/catalog';
import styles from './maps.module.css';

export function GraphRelations({ edges, byId, onSelect }: {
  edges: MapEdge[];
  byId: Map<string, CatalogNode>;
  onSelect: (id: string) => void;
}) {
  return edges.map(edge => <p key={edge.id}>
    <button type="button" onClick={() => onSelect(edge.from)}>{byId.get(edge.from)?.title}</button>
    {' '}{edge.direction === 'undirected' ? '↔' : '→'}{' '}
    <button type="button" onClick={() => onSelect(edge.to)}>{byId.get(edge.to)?.title}</button>
    {' · '}{edge.label}
    <span>{[edge.category, edge.description, edge.sources.length && `依据 ${edge.sources.join('、')}`, edge.verification].filter(Boolean).join(' · ')}</span>
  </p>);
}

export function RelationList({ edges, byId, onSelect }: Parameters<typeof GraphRelations>[0]) {
  return <details className={styles.graphTextList}>
    <summary>用文字查看本层 {edges.length} 条联系</summary>
    <GraphRelations edges={edges} byId={byId} onSelect={onSelect} />
  </details>;
}
