import { loader } from 'fumadocs-core/source';
import { docsRoute } from './shared';
import { defineDocs } from 'fumadocs-mdx/macro';
import { metaSchema, pageSchema } from 'fumadocs-core/source/schema';
import { applyMdxPreset } from 'fumadocs-mdx/config';
import { z } from 'zod';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    schema: pageSchema.extend({
      id: z.string(),
      updated: z.string(),
      status: z.string(),
      related: z.array(z.string()).default([]),
    }),
    mdxOptions: applyMdxPreset({
      remarkPlugins: [remarkMath],
      rehypePlugins: [rehypeKatex],
    }),
  },
  meta: {
    schema: metaSchema,
  },
});

export function getNode(id: string) {
  const page = source.getPages().find((item) => item.data.id === id);
  if (!page) throw new Error(`Unknown content ID: ${id}`);
  return page;
}

// See https://fumadocs.dev/docs/headless/source-api for more info
export const source = loader({
  baseUrl: docsRoute,
  source: docs.toFumadocsSource(),
  plugins: [],
});

