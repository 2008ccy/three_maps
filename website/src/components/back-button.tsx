'use client';

import { ArrowLeft } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useSidebar } from 'fumadocs-ui/layouts/docs/slots/sidebar';
import { documentReturnTarget, isAppUrl, previousAppUrlKey } from '@/lib/document-navigation';
import { basePath } from '@/lib/shared';

export function BackButton() {
  const router = useRouter();
  const pathname = usePathname();
  const { setOpen } = useSidebar();

  function goBack() {
    setOpen(false);
    if (window.history.length > 1 && isAppUrl(window.history.state?.[previousAppUrlKey], window.location.origin, basePath)) {
      // 浏览器原生创建的片段记录可能没有路由状态，返回后重新加载以恢复正确正文。
      window.addEventListener('popstate', (event) => {
        if (!event.state && isAppUrl(window.location.href, window.location.origin, basePath)) window.location.reload();
      }, { once: true });
      router.back();
    } else router.replace(documentReturnTarget(pathname).href);
  }

  return (
    <button type="button" onClick={goBack} className="sidebar-back-button">
      <ArrowLeft size={16} aria-hidden="true" />
      返回上页
    </button>
  );
}
