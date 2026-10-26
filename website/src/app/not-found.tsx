import Link from 'next/link';
export default function NotFound() {
  return <main className="home-shell py-24"><p className="eyebrow">404</p><h1 className="text-3xl font-semibold my-6">这个页面还没有收录</h1><p className="mb-6">请返回地图总览，或使用搜索查找相关概念。</p><Link className="primary-link" href="/docs">返回地图总览 →</Link></main>;
}
