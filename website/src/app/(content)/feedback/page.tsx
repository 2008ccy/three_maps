import type { Metadata } from 'next';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';
import { FeedbackBoard } from '@/components/feedback/feedback-board';
import { readFileSync } from 'node:fs';

export const metadata: Metadata = {
  title: '反馈与改进',
  description: '提交三张地图的具体问题，查看小组回复与处理进展。',
};

export default function FeedbackPage() {
  const updates = readFileSync('content/docs/project/updates.mdx', 'utf8');
  const releasedVersions = [...updates.matchAll(/<UpdateEntry\b[^>]*\bversion=["'](v\d+\.\d+)["']/g)].map((match) => match[1]);
  return <HomeLayout {...baseOptions()}><FeedbackBoard releasedVersions={releasedVersions} /></HomeLayout>;
}
