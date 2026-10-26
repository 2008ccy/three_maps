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
import { createStaticSearch } from '@/lib/static-search.mjs';

const client = createStaticSearch(withBasePath('/api/search/'));

export default function DefaultSearchDialog(props: SharedProps) {
  const search = useSearch(client.search);

  return (
    <SearchDialog {...search} {...props}>
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList />
      </SearchDialogContent>
    </SearchDialog>
  );
}
