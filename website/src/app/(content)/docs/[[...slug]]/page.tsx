import { source } from '@/lib/source';
import { notFound } from 'next/navigation';
import { getMDXComponents } from '@/components/mdx';
import type { Metadata } from 'next';
import { gitConfig } from '@/lib/shared';
import { documentReturnTarget } from '@/lib/document-navigation';
import { readingContext } from '@/lib/reading-context';
import { DocumentReturnLink } from '@/components/document-return-link';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, BookOpen, Network } from 'lucide-react';
import { ContentLink, NodeGrid } from '@/components/content';

export default async function Page(props: PageProps<'/docs/[[...slug]]'>) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();
  const MDX = page.data.body;
  const { owner, related } = readingContext(page.data.id);
  const fallback = documentReturnTarget(page.url);
  const returnHref = owner ? `/docs/${owner.map.id}/#node-${owner.node.id}` : fallback.href;
  const returnTitle = owner ? `返回${owner.map.title} · ${owner.node.title}` : fallback.title;
  const compact = page.url.includes('/entries/') && page.data.toc.length <= 5;
  return <div className="reading-shell">
    <nav className="reading-breadcrumb" aria-label="正文所属路径"><Link href="/">首页</Link><span>/</span>{owner ? <><Link href={`/docs/${owner.map.id}/`}>{owner.map.title}</Link>{owner.node.path.map((title, index) => <span key={`${title}:${index}`}>/ {title}</span>)}<span>/ {page.data.title}</span></> : <span>{page.data.title}</span>}</nav>
    <div className="reading-grid">
      <article className={`reading-article ${compact ? 'reading-compact' : ''}`}>
        <header className="reading-header"><p className="reading-eyebrow"><BookOpen size={14} />{owner?.map.title ?? '资料与项目'}<span> / {compact ? '知识条目' : '主题阅读'}</span></p><h1>{page.data.title}</h1><p className="reading-description">{page.data.description}</p><div className="content-meta"><span>{page.data.status}</span><span>更新于 {page.data.updated}</span><a target="_blank" rel="noreferrer" href={`https://github.com/${gitConfig.user}/${gitConfig.repo}/edit/${gitConfig.branch}/website/content/docs/${page.path}`}>编辑本页 <ArrowUpRight size={12} /></a></div></header>
        {owner && <p className="reading-context"><Network size={15} /><span>在地图中的位置：{[...owner.node.path, owner.node.title].join(' → ')}</span></p>}
        <div className="article-content prose"><MDX components={getMDXComponents({ a: ContentLink, NodeGrid })} /></div>
        {!!page.data.related.length && <section className="reading-next" aria-label="关联阅读"><h2>继续阅读</h2><div>{related.filter((item) => item.label === '关联阅读').map((item) => <Link key={item.href} href={item.href}><span>{item.title}</span><ArrowRight size={15} /></Link>)}</div></section>}
        <nav className="document-return" aria-label="正文返回导航"><DocumentReturnLink map={owner?.map.id} href={returnHref} title={returnTitle} /></nav>
      </article>
      <aside className="reading-aside" aria-label="阅读辅助导航">
        {!compact && !!page.data.toc.length && <nav className="reading-toc" aria-label="本页目录"><h2>本页目录</h2>{page.data.toc.map((item) => <a key={item.url} href={item.url} data-depth={item.depth}>{item.title}</a>)}</nav>}
        {!!related.length && <nav className="reading-relations" aria-label="相关知识"><h2>知识之间的联系</h2>{related.map((item, index) => <Link key={`${item.href}:${index}`} href={item.href}><span>{item.label}</span><strong>{item.title}<ArrowUpRight size={12} /></strong></Link>)}</nav>}
        <div className="reading-aside-foot"><DocumentReturnLink map={owner?.map.id} href={returnHref} title={returnTitle} /></div>
      </aside>
    </div>
  </div>;
}

export async function generateStaticParams() {
  return source.generateParams().filter(({ slug }) => !(slug?.length === 1 && ['domain', 'ecosystem', 'cognition'].includes(slug[0])));
}
export async function generateMetadata(props: PageProps<'/docs/[[...slug]]'>): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();
  return { title: page.data.title, description: page.data.description };
}
