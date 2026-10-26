'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSidebar } from 'fumadocs-ui/layouts/docs/slots/sidebar';

export function BackButton() {
  const router = useRouter();
  const { setOpen } = useSidebar();

  function goBack() {
    setOpen(false);
    if (window.history.length > 1) router.back();
    else router.replace('/');
  }

  return (
    <button type="button" onClick={goBack} className="sidebar-back-button">
      <ArrowLeft size={16} aria-hidden="true" />
      返回上页
    </button>
  );
}
