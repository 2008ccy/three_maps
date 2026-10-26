import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { appName, gitConfig } from './shared';
import { Network } from 'lucide-react';

export function baseOptions(): BaseLayoutProps {
  return {
    themeSwitch: { enabled: false },
    nav: {
      // JSX supported
      title: <><Network size={22} className="text-fd-primary" /><span>{appName}</span><span className="brand-note">模型构建</span></>,
    },
    links: [
      { text: '领域', url: '/docs/domain', active: 'nested-url' },
      { text: '生态', url: '/docs/ecosystem', active: 'nested-url' },
      { text: '认知', url: '/docs/cognition', active: 'nested-url' },
      { text: '更新记录', url: '/docs/project/updates' },
    ],
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
