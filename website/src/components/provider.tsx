'use client';
import SearchDialog from '@/components/search';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { type ReactNode } from 'react';
import { NavigationHistory } from './navigation-history';
import type { Translations } from 'fumadocs-ui/i18n';
import { HomeSceneProvider, useHomeScene } from './home-scene-state';

const translations: Partial<Translations> = {
  'Search(search dialog)': '搜索地图', 'Search(search trigger)': '搜索地图',
  'Open Search(search trigger)(aria-label)': '打开搜索',
  'Close Search(search dialog)(aria-label)': '关闭搜索',
  'No results found(search dialog)': '没有找到相关内容',
  'Search failed(search dialog)': '搜索加载失败，请重试',
  'Search failed, showing results for {query}(search dialog)': '搜索失败，暂时显示“{query}”的结果',
  'On this page(table of contents)': '本页目录',
  'Table of Contents(inline table of contents)': '本页目录',
  'No Headings(table of contents)': '本页暂无小节',
  'Edit on GitHub(edit page)': '在 GitHub 编辑',
  'Toggle Menu(home layout header)(aria-label)': '展开导航',
  'Open Sidebar(aria-label)': '展开目录', 'Open Sidebar(sidebar)(aria-label)': '展开目录',
  'Close Sidebar(aria-label)': '收起目录', 'Close Sidebar(sidebar)(aria-label)': '收起目录',
  'Collapse Sidebar(sidebar)(aria-label)': '收起目录',
  'Hide Sidebar(sidebar)': '隐藏目录', 'Show Sidebar(sidebar)': '显示目录',
  'Copy Anchor Link(heading anchor)(aria-label)': '复制小节链接',
  'Copied Anchor Link(heading anchor)(aria-label)': '已复制链接',
  'Copy Text(code block)(aria-label)': '复制代码', 'Copied Text(code block)(aria-label)': '已复制代码',
};

export function Provider({ children }: { children: ReactNode }) {
  return <HomeSceneProvider><SiteProvider>{children}</SiteProvider></HomeSceneProvider>;
}

function SiteProvider({ children }: { children: ReactNode }) {
  const { isHome, phase } = useHomeScene();
  const searchEnabled = !isHome || phase === 'expanded';
  // 保持 Provider 树稳定，展开时不卸载场景，也不丢失键盘焦点。
  return <RootProvider search={{ SearchDialog, hotKey: [{ key: (event) => searchEnabled && (event.metaKey || event.ctrlKey), display: '⌘' }, { key: 'k', display: 'K' }], options: searchEnabled ? undefined : { open: false } }} theme={{ defaultTheme: 'dark', forcedTheme: 'dark', enableSystem: false, hotKey: false }} i18n={{ translations }}><NavigationHistory />{children}</RootProvider>;
}
