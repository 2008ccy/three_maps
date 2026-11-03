import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export function UpdateEntry({ version, date, title, children }: {
  version: string; date: string; title: string; children: ReactNode;
}) {
  return <details className="update-entry" id={version.replace('.', '-')}>
    <summary>
      <span className="update-version">{version}</span>
      <span className="update-title">{title}</span>
      <time dateTime={date}>{date}</time>
      <ChevronDown size={16} aria-hidden="true" />
    </summary>
    <div className="update-body">{children}</div>
  </details>;
}
