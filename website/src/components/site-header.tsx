'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Network, Search } from 'lucide-react';
import { useSearchContext } from 'fumadocs-ui/contexts/search';
import { useEffect } from 'react';
import { NavigationDrawer } from './navigation-drawer';
import { appName } from '@/lib/shared';
import styles from './site-header.module.css';

const links = [
  { href: '/docs/domain', label: '领域' },
  { href: '/docs/ecosystem', label: '生态' },
  { href: '/docs/cognition', label: '认知' },
  { href: '/docs/project/updates', label: '更新记录' },
  { href: '/docs/sources', label: '资料来源' },
  { href: '/feedback', label: '反馈' },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { setOpenSearch } = useSearchContext();
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (event.key !== '/' || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey ||
          event.isComposing || target.isContentEditable || target.closest('input,textarea,select,[role="combobox"],dialog[open]')) return;
      event.preventDefault();
      setOpenSearch(true);
    }
    document.addEventListener('keydown', shortcut);
    return () => document.removeEventListener('keydown', shortcut);
  }, [setOpenSearch]);
  const navigation = links.map(({ href, label }) => <Link key={href} href={href} aria-current={pathname.startsWith(href) ? 'page' : undefined}>{label}</Link>);
  return <header id="nd-nav" className={styles.header}>
    <div className={styles.inner}>
      <Link href="/" className={styles.brand} aria-label={`${appName}首页`}>
        <Network size={30} strokeWidth={1.4} aria-hidden="true" />
        <span>{appName}</span><span className={styles.note}>模型构建</span>
      </Link>
      <nav className={styles.links} aria-label="网站主导航">
        {navigation}
      </nav>
      <div className={styles.actions}>
        <button type="button" className={styles.search} onClick={() => setOpenSearch(true)} aria-label="搜索地图"><Search size={18} strokeWidth={1.5} aria-hidden="true" /><kbd>/</kbd></button>
        <NavigationDrawer className={styles.menu} label="网站导航" icon={<Menu size={20} />}><nav>{navigation}</nav></NavigationDrawer>
      </div>
    </div>
    <noscript><nav className={styles.fallbackNav} aria-label="网站导航">{navigation}</nav></noscript>
  </header>;
}
