'use client';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { basePath, withBasePath } from '@/lib/shared';

export function DocumentReturnLink({ map, href, title }: { map?: string; href: string; title: string }) {
  const [target, setTarget] = useState(href);
  useEffect(() => {
    if (!map) return;
    try {
      const saved = JSON.parse(sessionStorage.getItem(`three-maps-browse:${map}`) ?? 'null');
      if (typeof saved?.url !== 'string') return;
      const url = new URL(saved.url, window.location.origin);
      if (url.origin === window.location.origin && url.pathname === withBasePath(`/docs/${map}/`)) setTarget(`${url.pathname.slice(basePath.length)}${url.search}${url.hash}`);
    } catch { /* The stable owning-node link is also useful without storage. */ }
  }, [map]);
  return <Link className="document-return-link" href={target}><ArrowLeft size={16} />{title}</Link>;
}
