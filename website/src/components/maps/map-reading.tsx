'use client';

import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import type { CatalogNode } from '@/lib/maps/catalog';
import { nodeKey, type Atlas, type NodeRef } from '@/lib/maps/expanded-graph';
import { teachingCase } from '@/lib/maps/teaching-case';
import { feedbackComposeHref } from '@/lib/feedback-contract';
import { DomainLesson, DomainAdvanced } from './domain-lesson';
import styles from './maps.module.css';
import radial from './radial-graph.module.css';

export function KnowledgeStatus({ node }: { node: CatalogNode }) {
  return <span className={styles.knowledgeStatus}>
    <span data-status="learning" data-understanding={node.understanding} title="项目维护者记录的学习状态">学习状态：{node.understanding}</span>
    <span data-status="verification" data-verified={node.verification === '已核实'}>核实状态：{node.verification}</span>
  </span>;
}

export function MapReading({ node, atlas, sourceTitles, onOpen, remember }: {
  node: CatalogNode; atlas: Atlas; sourceTitles: Record<string, string>; onOpen?: (ref: NodeRef) => void; remember: () => void;
}) {
  const map = atlas.maps.find(map => map.id === node.mapId)!;
  const nodes = atlas.catalogs.get(map.id)!;
  const ecosystem = map.id === 'ecosystem', cognition = map.id === 'cognition';
  const children = node.collection ? node.children as CatalogNode[] : nodes.filter(child => child.parent === node.id);
  const key = nodeKey({ mapId: node.mapId, nodeId: node.id });
  const related = atlas.edges.filter(edge => edge.kind !== 'hierarchy' && (edge.from === key || edge.to === key));
  const local = related.filter(edge => edge.sourceMap === edge.targetMap), cross = related.filter(edge => edge.sourceMap !== edge.targetMap);
  const sourceIds = [...new Set([...node.sources, ...related.flatMap(edge => edge.sources), ...(node.lesson?.example.materials.flatMap(id => teachingCase.materials.find(item => item.id === id)?.sources ?? []) ?? [])])];
  function relations(items: typeof related, title: string) {
    return !!items.length && <section className={styles.lessonRelations} aria-label={title}><h3>{title} <span>（{items.length} 条）</span></h3>{items.map(edge => {
      const from = atlas.byId.get(edge.from), to = atlas.byId.get(edge.to);
      const target = edge.from === key ? to : from;
      if (!from || !to || !target) return null;
      return <article key={edge.id} data-direction={edge.direction ?? 'directed'}><Link href={`/docs/${target.mapId}/#node-${target.id}`} onClick={event => {
        if (onOpen && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
          event.preventDefault(); onOpen({ mapId: target.mapId, nodeId: target.id });
        } else remember();
      }}><strong>{edge.direction === 'undirected' ? `${from.title} 与 ${to.title}：${edge.label}` : `${from.title} ${edge.label} · ${to.title}`}</strong><ArrowUpRight size={16} /></Link>
        {edge.description && <p>{edge.description}</p>}<small>{edge.sourceMap !== edge.targetMap ? '跨图背景' : edge.basis === 'editorial' ? '编辑建议' : '材料关系'} · 依据 {edge.sources.join('、')} · {edge.verification}</small>
      </article>;
    })}</section>;
  }
  return <>
    {!node.collection && <KnowledgeStatus node={node} />}
    {node.collection && <section className={styles.topicTeaching}><p>{node.detail}</p><strong>原分类：{node.title} · {children.length} 个原有条目</strong></section>}
    {node.topic && <section className={styles.topicTeaching}><p className={styles.readingSummary}>{node.topic.question}</p><p>{node.detail}</p>{ecosystem && node.boundary && <p className={styles.topicHandoff}>{node.boundary}</p>}<p className={styles.classification}>{node.topic.classification}</p><strong>学完这个主题：{node.topic.outcome}</strong></section>}
    {node.lesson && <DomainLesson key={key} lesson={node.lesson} ecosystem={ecosystem} cognition={cognition} profile={node.teamProfile} />}
    {onOpen && !!children.length && <section className={styles.childrenSection} aria-label="主题下的知识点"><div className={styles.sectionHeading}><h3>从这里继续探索</h3><span>{children.length} 个知识点</span></div><div className={radial.readingChildren}>{children.map(child => <button key={child.id} type="button" onClick={() => onOpen({ mapId: map.id, nodeId: child.id })} aria-label={`打开知识点：${child.title}`}><span><strong>{child.title}</strong><small>{child.summary}</small><KnowledgeStatus node={child} /></span><ArrowRight size={16} /></button>)}</div></section>}
    {ecosystem && node.lesson && node.boundary && <div className={styles.boundary}><span>理解与使用边界</span><p>{node.boundary}</p></div>}
    {relations(local, ecosystem ? '本图生态联系' : '本图知识联系')}{relations(cross, '跨图背景')}
    <details key={`sources-${key}`} className={styles.lessonSources}><summary>资料状态、使用边界与来源（{sourceIds.length}）</summary><p>项目维护者记录的学习状态：{node.understanding}。核实状态：{node.verification}。</p><p>节点 ID：<code>{node.id}</code>。本页包含教学编排与自编示例，不将学习建议写成已完成的实践成果。</p>{cognition && node.boundary && <p>{node.boundary}</p>}<nav aria-label="内容来源">{sourceIds.map(id => <Link key={id} href={`/docs/sources/#${id.toLowerCase()}`} onClick={remember}><span>{sourceTitles[id] ?? id}</span><small>{id}<ArrowUpRight size={13} /></small></Link>)}</nav></details>
    {!!node.records?.length && <details className={styles.lessonSources}><summary>历史记录与材料范围（{node.records.length}）</summary>{node.records.map((record, index) => <section className={styles.evidenceRecord} key={index}><h3>{record.title}</h3><p>{record.date} · <Link href={`/docs/sources/#${record.source.toLowerCase()}`} onClick={remember}>{record.source}</Link> · {record.locator}</p><p>{record.text}</p></section>)}</details>}
    {node.lesson && <DomainAdvanced key={`advanced-${key}`} lesson={node.lesson} />}
    {!node.collection && <nav className={styles.feedbackAction} aria-label={node.parent ? '知识点反馈' : '主题反馈'}><Link href={feedbackComposeHref({ mapId: node.mapId, nodeId: node.id })} onClick={remember}>{node.parent ? '反馈这个知识点' : '反馈这个主题'}<ArrowUpRight size={15} aria-hidden="true" /></Link></nav>}
  </>;
}
