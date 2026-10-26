import Link from 'next/link';
import { ArrowRight, BookOpen, Network, ScanEye } from 'lucide-react';

const maps = [
  { num: '01', name: '领域地图', question: '学什么，怎样构建？', desc: '从任务、概念到工具与实践，拆开一个课程助手的构建过程。', href: '/docs/domain', icon: BookOpen, tags: ['模型原理', 'RAG / LoRA', '评测与部署'] },
  { num: '02', name: '生态地图', question: '谁在推动，如何协作？', desc: '连接研究者、模型团队与开源社区，追踪技术和资源怎样流转。', href: '/docs/ecosystem', icon: Network, tags: ['团队与社区', '论文与工具', '资源与成本'] },
  { num: '03', name: '认知地图', question: '怎样判断，如何修正？', desc: '从 loss、榜单和成本三个问题出发，用证据检查我们的判断。', href: '/docs/cognition', icon: ScanEye, tags: ['系统拆解', '对照比较', '认识更新'] },
];

export default function HomePage() {
  return (
    <main className="home-shell">
      <section className="hero">
        <div className="eyebrow"><span /> 三张活地图 / 模型构建</div>
        <h1>从预训练模型，<br />走向<span>有依据的回答。</span></h1>
        <p className="hero-description">一个课程答疑助手怎样构建？需要哪些知识，依靠谁的成果，又该怎样判断有效？沿着三张相互关联的地图，找到答案与下一步。</p>
        <div className="hero-actions">
          <Link href="/docs" className="primary-link">开始探索 <ArrowRight size={17} /></Link>
          <Link href="/docs/project/connections" className="secondary-link">看看三图怎样相连 <ArrowRight size={16} /></Link>
        </div>
      </section>
      <section aria-label="三张地图" className="map-grid">{maps.map((map) => <Link className="map-card" href={map.href} key={map.num}>
        <div className="map-card-top"><map.icon size={25} /><span>{map.num}</span></div>
        <h2>{map.name}</h2><h3>{map.question}</h3><p>{map.desc}</p>
        <div className="map-tags">{map.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
        <span className="map-enter">进入地图 <ArrowRight size={17} /></span>
      </Link>)}</section>
      <section className="exploration-strip">
        <div><span className="eyebrow">从一个问题出发</span><h2>先找资料，还是先微调？</h2><p>理解方法，认识工具，再回到证据与取舍。</p></div>
        <div className="path-links"><Link href="/docs/domain/entries/k-rag">RAG</Link><ArrowRight size={16}/><Link href="/docs/domain/entries/k-lora">LoRA</Link><ArrowRight size={16}/><Link href="/docs/cognition/tradeoffs">效果与成本</Link></div>
      </section>
      <footer className="home-footer"><p>持续更新 · 保留来源 · 说明未知</p><div><Link href="/docs/sources">来源目录</Link><Link href="/docs/project/updates">更新记录</Link><Link href="/docs/project/status">项目进度</Link></div></footer>
    </main>
  );
}
