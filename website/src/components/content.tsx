import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { getNode } from '@/lib/source';
import { withBasePath } from '@/lib/shared';
import type { ComponentProps } from 'react';

export function NodeGrid({ ids, linked = true }: { ids: string[]; linked?: boolean }) {
  return <div className="node-grid not-prose">{ids.map((id) => {
    const page = getNode(id);
    const content = <>
      <span className="node-id">{id}{linked && <ArrowUpRight size={16} aria-hidden />}</span>
      <strong>{page.data.title}</strong>
      <span className="node-description">{page.data.description}</span>
    </>;
    return linked ? <Link className="node-card" href={page.url} key={id}>{content}</Link> : <div className="node-card node-card-static" key={id}>{content}</div>;
  })}</div>;
}

// 正文中的节点、文章与来源链接保持可浏览。
export function ArticleLink({ currentUrl: _currentUrl, ...props }: ComponentProps<'a'> & { currentUrl: string }) {
  return <ContentLink {...props} />;
}

export function ContentLink({ href = '', children, ...props }: ComponentProps<'a'>) {
  if (href.startsWith('node:')) href = getNode(href.slice(5)).url;
  if (href.startsWith('ref:')) href = `/docs/sources/#${href.slice(4).toLowerCase()}`;
  if (href.startsWith('/')) return <Link href={href} {...props}>{children}</Link>;
  return <a href={href} {...props} {...(href.startsWith('https://') ? { target: '_blank', rel: 'noreferrer' } : {})}>{children}</a>;
}

export function ContentImage({ src = '', alt = '', ...props }: ComponentProps<'img'>) {
  if (typeof src !== 'string') return null;
  return <a href={src.startsWith('/') ? withBasePath(src) : src} target="_blank" rel="noreferrer" aria-label={`查看原图：${alt}`}>
    <img {...props} src={src.startsWith('/') ? withBasePath(src) : src} alt={alt} loading="lazy" className="content-image" />
  </a>;
}
