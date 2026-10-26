import { source } from '@/lib/source';
import { flexsearchFromSource } from 'fumadocs-core/search/flexsearch';
import { searchOptions } from '@/lib/static-search.mjs';

export const revalidate = false;
export const dynamic = 'force-static';

export const { staticGET: GET } = flexsearchFromSource(source, { document: searchOptions });
