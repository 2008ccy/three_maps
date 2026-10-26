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
import { documentReturnTarget } from '@/lib/document-navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default async function Page(props: PageProps<'/docs/[[...slug]]'>) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;
  const returnTarget = documentReturnTarget(page.url);

  return (
    <DocsPage toc={page.data.toc} full={page.data.full} footer={{ enabled: false }}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <div className="content-meta">
        <span>{page.data.status}</span>
        <span>更新于 {page.data.updated}</span>
        <a target="_blank" rel="noreferrer" href={`https://github.com/${gitConfig.user}/${gitConfig.repo}/edit/${gitConfig.branch}/website/content/docs/${page.path}`}>编辑本页 ↗</a>
      </div>
      <DocsBody>
        <MDX components={getMDXComponents()} />
      </DocsBody>
      <nav className="document-return" aria-label="正文返回导航">
        <Link className="document-return-link" href={returnTarget.href}>
          <ArrowLeft size={17} aria-hidden="true" />
          {returnTarget.title}
        </Link>
      </nav>
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
