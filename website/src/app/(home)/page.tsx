'use client';

import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { useSearchContext } from 'fumadocs-ui/contexts/search';
import { HomeExperience } from './home-experience';
import { ParticleSurface } from './home-particles';
import { useMapTransition } from '@/components/map-transition';
import { maps } from './home-content';
import styles from './home.module.css';

const summaries = ['任务、概念与工具', '研究者、团队与开源社区', '证据、判断与修正'];

export default function HomePage() {
  const { setOpenSearch } = useSearchContext();
  const transition = useMapTransition();
  return <HomeExperience>
    <section className={styles.hero} aria-labelledby="home-title" data-home-hero>
      <ParticleSurface />
      <div className={styles.copy} data-home-core>
        <p className={styles.eyebrow}>模型构建 / 学习地图</p>
        <h1 id="home-title">从预训练模型，<br />走向有依据的回答。</h1>
        <p className={styles.description}>一个课程答疑助手怎样构建？沿着三张相互关联的地图，<br className={styles.desktopBreak} />找到答案与下一步。</p>
        <div className={styles.actions}>
          <Link href="/docs/domain" className={styles.primary} onPointerEnter={() => transition.prefetch('/docs/domain')}>开始探索 <ArrowRight size={23} strokeWidth={1.6} aria-hidden="true" /></Link>
          <button type="button" className={styles.secondary} onClick={() => setOpenSearch(true)}>搜索地图</button>
        </div>
      </div>
    </section>
    <nav className={styles.mapGrid} aria-label="探索三张地图">
      {maps.map((map, index) => <Link key={map.id} href={map.href} data-map={map.id} data-home-map={map.id} className={styles.mapLink} onPointerEnter={() => transition.prefetch(map.href)} onFocus={() => transition.prefetch(map.href)}>
        <span className={styles.number}>{map.num}</span>
        <div className={styles.mapTitle}><h2>{map.name}</h2><ArrowRight size={22} strokeWidth={1.4} aria-hidden="true" /></div>
        <p className={styles.question}>{map.question}</p>
        <p className={styles.summary}>{summaries[index]}</p>
      </Link>)}
    </nav>
    <footer className={styles.footer}>
      <p>持续更新，保留依据。</p>
      <nav aria-label="网站更新与反馈"><Link href="/docs/project/updates">更新记录 <ArrowUpRight size={14} aria-hidden="true" /></Link><Link href="/feedback">反馈 <ArrowUpRight size={14} aria-hidden="true" /></Link></nav>
    </footer>
  </HomeExperience>;
}
