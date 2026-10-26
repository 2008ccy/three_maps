'use client';

import type { SidebarPageTreeComponents } from 'fumadocs-ui/components/sidebar/page-tree';
import { SidebarItem } from 'fumadocs-ui/components/sidebar/base';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

// Render only the section entry; its overview contains the child-page cards.
// Keep the complete page tree available for breadcrumbs and search.
export const SidebarSection: SidebarPageTreeComponents['Folder'] = ({ item }) => {
  const pathname = usePathname();
  const page = item.index ?? item.children.find((child) => child.type === 'page');
  if (!page) return null;
  const url = page.url.replace(/\/$/, '');
  const active = pathname === url || pathname.startsWith(`${url}/`);

  return (
    <SidebarItem href={page.url} active={active} className="section-nav-link">
      <span>{item.name}</span>
      <ChevronRight aria-hidden="true" size={16} />
    </SidebarItem>
  );
};
