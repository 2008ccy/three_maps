import { source } from '@/lib/source';
import { flexsearchFromSource } from 'fumadocs-core/search/flexsearch';
import { searchOptions } from '@/lib/static-search.mjs';

export const revalidate = false;
export const dynamic = 'force-static';

// Migration routes stay addressable, but should not compete with core learning content.
export const { staticGET: GET } = flexsearchFromSource({
  ...source,
  getPages: () => source.getPages().filter((page) => page.data.searchable),
}, { document: searchOptions });
