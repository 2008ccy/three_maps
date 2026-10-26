import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { baseOptions } from '@/lib/layout.shared';
import { SidebarSection } from '@/components/sidebar-section';
import { BackButton } from '@/components/back-button';

export default function Layout({ children }: LayoutProps<'/docs'>) {
  return (
    <DocsLayout
      tree={source.getPageTree()}
      {...baseOptions()}
      links={[]}
      sidebar={{ components: { Folder: SidebarSection }, footer: <BackButton /> }}
    >
      {children}
    </DocsLayout>
  );
}
