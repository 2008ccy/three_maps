'use client';
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay,
  type SharedProps,
} from 'fumadocs-ui/components/dialog/search';
import { experimental_useSearch as useSearch } from 'fumadocs-core/search/client';
import { withBasePath } from '@/lib/shared';
import { useCallback, useState } from 'react';
import { mapLabels, type MapKey } from '@/lib/map-labels';

let client: ReturnType<typeof import('@/lib/static-search.mjs').createStaticSearch>;

export default function DefaultSearchDialog(props: SharedProps) {
  const [tags, setTags] = useState<MapKey[]>([]);
  const run = useCallback(async (query: string) => {
    client ??= (await import('@/lib/static-search.mjs')).createStaticSearch(withBasePath('/api/search/'));
    return client.search(query, tags);
  }, [tags]);
  const search = useSearch(run, { delayMs: 120, allowEmpty: tags.length > 0 });
  function toggle(tag: MapKey) {
    setTags((current) => current.includes(tag) ? current.filter((id) => id !== tag) : [...current, tag]);
  }

  return (
    <SearchDialog {...search} {...props}>
      <SearchDialogOverlay className="search-overlay" />
      <SearchDialogContent className="search-popup">
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput placeholder="搜索标题、概念或正文…" />
          <SearchDialogClose />
        </SearchDialogHeader>
        <div className="search-filters" onKeyDownCapture={(event) => {
          // Keep Enter on a filter from selecting the active search result.
          if (event.key === 'Enter') {
            event.preventDefault();
            event.stopPropagation();
            (event.target as HTMLButtonElement).click();
          }
        }} role="group" aria-label="按地图筛选，可多选">
          <button type="button" aria-pressed={!tags.length} onClick={() => setTags([])}>全部</button>
          {mapLabels.map(({ id, title }) => <button key={id} type="button" data-map={id}
            aria-pressed={tags.includes(id)} onClick={() => toggle(id)}>{title}</button>)}
        </div>
        <SearchDialogList />
      </SearchDialogContent>
    </SearchDialog>
  );
}
