import { source } from '@/lib/source';
import { flexsearch } from 'fumadocs-core/search/flexsearch';
import { searchOptions } from '@/lib/static-search.mjs';
import { isLegacyMapArticle } from '@/lib/document-navigation';
import { mapSearchIndexes } from '@/lib/map-search-indexes';
import { maps } from '@/lib/maps/content';

export const revalidate = false;
export const dynamic = 'force-static';

// Keep original article URLs addressable for bookmarks, without exposing them
// as search destinations. Map results now open the current knowledge node.
export const { staticGET: GET } = flexsearch({
  document: searchOptions,
  indexes: () => [
    ...source.getPages()
      .filter((page) => page.data.searchable && !isLegacyMapArticle(page.url) && !maps.some((map) => map.indexId === page.data.id))
      .map((page) => ({
        id: page.url, title: page.data.title, description: page.data.description,
        url: page.url, structuredData: page.data.structuredData,
      })),
    ...mapSearchIndexes(),
  ],
});
