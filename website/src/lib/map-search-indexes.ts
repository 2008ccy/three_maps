import type { Index } from 'fumadocs-core/search/flexsearch';
import { maps } from './maps/content.ts';
import { buildCatalog } from './maps/catalog.ts';

// Search the same active teaching content as the maps. Historical aliases and
// retired collections remain compatible addresses, but are not search entries.
export function mapSearchIndexes(): Index[] {
  return maps.flatMap((map) => [
    {
      id: `map:${map.id}`, title: map.title, url: `/docs/${map.id}/`,
      description: map.description,
      structuredData: { headings: [], contents: [{ heading: undefined, content: map.question }] },
    },
    ...buildCatalog(map).map((node): Index => {
      const lesson = node.lesson;
      const paragraphs = [
        node.detail, node.boundary,
        ...(node.topic ? [...node.topic.overview, node.topic.question, node.topic.outcome, node.topic.classification] : []),
        ...(lesson ? [lesson.role, lesson.goal, ...lesson.explanation, lesson.example.input,
          ...lesson.example.steps, lesson.example.output, ...lesson.confusions,
          lesson.check.question, lesson.check.answer,
          ...(lesson.advanced ?? []).flatMap((block) => [block.title, ...(block.paragraphs ?? []), ...(block.steps ?? []), block.formula,
            ...(block.table ? [...block.table.headers, ...block.table.rows.flat()] : [])]),
        ] : []),
        ...(node.records ?? []).map((record) => record.text),
      ].filter((text): text is string => !!text);
      return {
        id: `map:${map.id}:${node.id}`, title: node.title,
        url: `/docs/${map.id}/#node-${node.id}`, description: node.summary,
        breadcrumbs: [map.title, ...node.path],
        // All matching snippets keep the canonical node fragment. Extra heading
        // fragments would produce an invalid second '#' after #node-….
        structuredData: { headings: [], contents: [...new Set(paragraphs)].map((content) => ({ heading: undefined, content })) },
      };
    }),
  ]);
}
