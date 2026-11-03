import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { feedbackHref, feedbackIdPattern } from '@/lib/feedback-contract';

export function UpdateEntry({ version, date, title, children, feedbackIds = [] }: {
  version: string; date: string; title: string; children: ReactNode; feedbackIds?: string[];
}) {
  return <details className="update-entry" id={version.replace('.', '-')}>
    <summary>
      <span className="update-version">{version}</span>
      <span className="update-title">{title}</span>
      <time dateTime={date}>{date}</time>
      <ChevronDown size={16} aria-hidden="true" />
    </summary>
    <div className="update-body">{children}{feedbackIds.some((id) => feedbackIdPattern.test(id)) && <nav aria-label="本版本关联反馈"><p>关联反馈</p>{[...new Set(feedbackIds)].filter((id) => feedbackIdPattern.test(id)).map((id) => <Link key={id} href={feedbackHref(id)}>{id}</Link>)}</nav>}</div>
  </details>;
}
