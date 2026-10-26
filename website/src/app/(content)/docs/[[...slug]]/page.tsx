import { source } from '@/lib/source';
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from 'fumadocs-ui/layouts/docs/page';
import { notFound } from 'next/navigation';
import { getMDXComponents } from '@/components/mdx';
import type { Metadata } from 'next';
import { gitConfig } from '@/lib/shared';
import { NodeGrid } from '@/components/content';
import { findNeighbour } from 'fumadocs-core/page-tree';

export default async function Page(props: PageProps<'/docs/[[...slug]]'>) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;
  const neighbours = findNeighbour(source.getPageTree(), page.url);

  return (
    <DocsPage toc={page.data.toc} full={page.data.full} footer={{ items: {
      previous: neighbours.previous && { ...neighbours.previous, description: '上一篇' },
      next: neighbours.next && { ...neighbours.next, description: '下一篇' },
    } }}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <div className="content-meta">
        <span>{page.data.status}</span>
        <span>更新于 {page.data.updated}</span>
        <a target="_blank" rel="noreferrer" href={`https://github.com/${gitConfig.user}/${gitConfig.repo}/edit/${gitConfig.branch}/website/content/docs/${page.path}`}>编辑本页 ↗</a>
      </div>
      <DocsBody>
        <MDX components={getMDXComponents()} />
        {page.data.related.length > 0 && <section className="related-section" aria-label="相关条目">
          <h2>沿着关系继续探索</h2>
          <NodeGrid ids={page.data.related} />
        </section>}
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  // 三张总览由全宽导图路由生成，正文仍使用文档布局。
  return source.generateParams().filter(({ slug }) => !(slug?.length === 1 && ['domain', 'ecosystem', 'cognition'].includes(slug[0])));
}

export async function generateMetadata(props: PageProps<'/docs/[[...slug]]'>): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
  };
}
