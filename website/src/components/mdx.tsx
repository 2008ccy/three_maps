import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import { ContentLink, ContentImage, NodeGrid } from './content';

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    a: ContentLink,
    img: ContentImage,
    NodeGrid,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
