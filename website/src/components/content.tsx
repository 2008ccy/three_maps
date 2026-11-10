import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { readingContext } from '@/lib/reading-context';
import { getNode } from '@/lib/source';
import { withBasePath } from '@/lib/shared';
import { isLegacyMapArticle } from '@/lib/document-navigation';
import type { ComponentProps } from 'react';

export function NodeGrid({ ids, linked = true }: { ids: string[]; linked?: boolean }) {
  return <div className="node-grid not-prose">{ids.map((id) => {
    const page = getNode(id);
    const clickable = linked && !isLegacyMapArticle(page.url);
    const content = <>
      <span className="node-id">{id}{clickable && <ArrowUpRight size={16} aria-hidden />}</span>
      <strong>{page.data.title}</strong>
      <span className="node-description">{page.data.description}</span>
    </>;
    const { owner, related } = readingContext(id);
    const tags = related.filter((item) => item.label !== '关联阅读').slice(0, 2);
    if (!tags.length && owner) tags.push({ title: owner.node.title, label: '关联节点', href: `/docs/${owner.map.id}/#node-${owner.node.id}` });
    return <div className="node-card node-card-static" key={id}>
      {clickable ? <Link href={page.url} className="node-card-body">{content}</Link> : content}
      {!!tags.length && <nav aria-label={page.data.title+'的关联节点'} className="related-tags"><small>关联节点</small>{tags.map((tag) =>
        <Link href={tag.href} key={tag.href} data-map={tag.href.split('/')[2]}>{tag.title}<ArrowUpRight size={12} /></Link>)}</nav>}
    </div>;
  })}</div>;
}

// 保留旧正文内容，移除指向旧正文的跳转；来源和当前地图节点仍可浏览。
export function ArticleLink({ currentUrl: _currentUrl, ...props }: ComponentProps<'a'> & { currentUrl: string }) {
  return <ContentLink {...props} />;
}

export function ContentLink({ href = '', children, ...props }: ComponentProps<'a'>) {
  if (href.startsWith('node:')) href = getNode(href.slice(5)).url;
  if (href.startsWith('ref:')) href = `/docs/sources/#${href.slice(4).toLowerCase()}`;
  if (isLegacyMapArticle(href)) return <span className={props.className} title={props.title}>{children}</span>;
  if (href.startsWith('/')) return <Link href={href} {...props}>{children}</Link>;
  return <a href={href} {...props} {...(href.startsWith('https://') ? { target: '_blank', rel: 'noreferrer' } : {})}>{children}</a>;
}

export function ContentImage({ src = '', alt = '', ...props }: ComponentProps<'img'>) {
  if (typeof src !== 'string') return null;
  return <a href={src.startsWith('/') ? withBasePath(src) : src} target="_blank" rel="noreferrer" aria-label={`查看原图：${alt}`}>
    <img {...props} src={src.startsWith('/') ? withBasePath(src) : src} alt={alt} loading="lazy" className="content-image" />
  </a>;
}
