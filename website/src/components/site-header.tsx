'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Network, Search } from 'lucide-react';
import { useSearchContext } from 'fumadocs-ui/contexts/search';
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
  return <header id="nd-nav" className={styles.header}>
    <div className={styles.inner}>
      <Link href="/" className={styles.brand} aria-label={`${appName}首页`}>
        <Network size={30} strokeWidth={1.4} aria-hidden="true" />
        <span>{appName}</span><span className={styles.note}>模型构建</span>
      </Link>
      <nav className={styles.links} aria-label="网站主导航">
        {links.map(({ href, label }) => <Link key={href} href={href} aria-current={pathname.startsWith(href) ? 'page' : undefined}>{label}</Link>)}
      </nav>
      <button type="button" className={styles.search} onClick={() => setOpenSearch(true)} aria-label="搜索地图"><Search size={23} strokeWidth={1.5} aria-hidden="true" /></button>
    </div>
  </header>;
}
