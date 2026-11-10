'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function NavigationDrawer({ label, icon, children, className }: {
  label: string; icon: ReactNode; children: ReactNode; className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const desktop = matchMedia('(min-width: 768px)');
    const closeOnResize = () => { if (desktop.matches) dialog.current?.close(); };
    desktop.addEventListener('change', closeOnResize);
    return () => desktop.removeEventListener('change', closeOnResize);
  }, []);
  return <>
    <button type="button" className={className} aria-label={label} aria-haspopup="dialog" aria-controls={id}
      onClick={() => dialog.current?.showModal()}>{icon}</button>
    <dialog id={id} className="navigation-drawer" ref={dialog} aria-label={label}
      onKeyDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        if (event.target === dialog.current || (event.target as Element).closest('a[href],button')) dialog.current?.close();
      }}>
      <div className="drawer-sheet"><header><strong>{label}</strong><button aria-label="关闭菜单" type="button"><X size={20} /></button></header>{children}</div>
    </dialog>
  </>;
}
