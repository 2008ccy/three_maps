'use client';

import { useEffect } from 'react';
import { appLocationChangeEvent, previousAppUrlKey } from '@/lib/document-navigation';

// history.length 也会计入空白页和站外页面；仅为应用内创建的历史记录标记真实来源。
export function NavigationHistory() {
  useEffect(() => {
    const history = window.history;
    const originalPush = history.pushState;
    const originalReplace = history.replaceState;
    const notify = (previousUrl: string) => {
      if (window.location.href !== previousUrl) queueMicrotask(() => window.dispatchEvent(new Event(appLocationChangeEvent)));
    };
    const push: History['pushState'] = function (data, unused, url) {
      const before = window.location.href;
      originalPush.call(history, { ...data, [previousAppUrlKey]: window.location.href }, unused, url);
      notify(before);
    };
    const replace: History['replaceState'] = function (data, unused, url) {
      const before = window.location.href;
      const previousUrl = history.state?.[previousAppUrlKey];
      originalReplace.call(history, previousUrl ? { [previousAppUrlKey]: previousUrl, ...data } : data, unused, url);
      notify(before);
    };
    history.pushState = push;
    history.replaceState = replace;
    return () => {
      if (history.pushState === push) history.pushState = originalPush;
      if (history.replaceState === replace) history.replaceState = originalReplace;
    };
  }, []);
  return null;
}
