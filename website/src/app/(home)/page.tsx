'use client';

import Link from 'next/link';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { HomeCore, HomeExperience, ScrollCue } from './home-experience';
import { useHomeScene } from '@/components/home-scene-state';
import { useMapTransition } from '@/components/map-transition';
import { maps, explorationPaths } from './home-content';
import styles from './home.module.css';

// 探索路线暂缓展示；确定新版方案后可在这里恢复整段内容及下滑提示。
const showExploration = false;

export default function HomePage() {
  const { phase } = useHomeScene();
  const transition = useMapTransition();
  return (
    <HomeExperience>
      <section className={styles.hero} aria-labelledby="home-title" data-home-hero>
        <div className={styles.constellation}>
          <HomeCore>
            <p className={styles.eyebrow}><span aria-hidden="true" />三张活地图 / 模型构建</p>
            <h1 id="home-title">从预训练模型，<br />走向<span>有依据的回答。</span></h1>
            <p className={styles.description}>一个课程答疑助手怎样构建？<span className={styles.desktopDescription}>需要哪些知识，依靠谁的成果，又该怎样判断有效？</span><br className={styles.mobileBreak} />沿着三张相互关联的地图，找到答案与下一步。</p>
          </HomeCore>

          <div className={`${styles.branch} ${styles.branchDomain}`} aria-hidden="true" />
          <div className={`${styles.branch} ${styles.branchEcosystem}`} aria-hidden="true" />
          <div className={`${styles.branch} ${styles.branchCognition}`} aria-hidden="true" />

          {maps.map((map) => (
            <div key={map.id} className={`${styles.orbit} ${styles[map.id]}`} inert={phase !== 'expanded'} aria-hidden={phase !== 'expanded'}>
            <Link href={map.href} data-map={map.id} data-home-map={map.id} className={styles.mapCard} onPointerEnter={() => transition.prefetch(map.href)} onFocus={() => transition.prefetch(map.href)} onClick={(event) => { if (transition.begin(map.id, event.currentTarget, event)) event.preventDefault(); }}>
              <map.icon className={styles.mapIcon} size={25} aria-hidden="true" />
              <div className={styles.mapCopy}>
                <span className={styles.mapNumber}>{map.num} / EXPLORE</span>
                <h2>{map.name}</h2>
                <p>{map.question}</p>
              </div>
              <ArrowUpRight className={styles.mapArrow} size={18} aria-hidden="true" />
            </Link>
            </div>
          ))}
        </div>
        {showExploration && <ScrollCue />}
      </section>

      {showExploration && <section id="explore" className={styles.exploration} aria-labelledby="explore-title" tabIndex={-1}>
        <div className={styles.sectionHeading} data-reveal>
          <div>
            <p className={styles.eyebrow}><span aria-hidden="true" />从一个问题出发</p>
            <h2 id="explore-title">让问题，带你穿过三张地图。</h2>
            <p className={styles.sectionIntro}>先找资料，还是先微调？从方法出发，认识背后的人与工具，再回到证据与取舍。</p>
          </div>
          <Link href="/docs/project/connections" className={styles.textLink}>查看完整跨图关系 <ArrowUpRight size={16} aria-hidden="true" /></Link>
        </div>

        <div className={styles.paths}>
          {explorationPaths.map((path) => (
            <article key={path.num} className={styles.path} data-reveal>
              <div className={styles.pathHeading}>
                <span className={styles.pathNumber}>{path.num}</span>
                <div><h3>{path.title}</h3><p>{path.description}</p></div>
                <ArrowDownRight size={25} className={styles.pathDirection} aria-hidden="true" />
              </div>
              <ol className={styles.steps} aria-label={`${path.title}探索路线`}>
                {path.steps.map((step, index) => (
                  <li key={step.href}>
                    <Link href={step.href} className={styles.step}>
                      <span className={styles.stepCategory}>{step.category}</span>
                      <span className={styles.stepName}>{step.name}<ArrowUpRight size={14} aria-hidden="true" /></span>
                    </Link>
                    {index < path.steps.length - 1 && <ArrowRight className={styles.stepArrow} size={15} aria-hidden="true" />}
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>

        <div className={styles.mapNotes} data-reveal>
          {maps.map((map) => <p key={map.id}><strong>{map.name}</strong>{map.description}</p>)}
        </div>
      </section>}

      <footer className={styles.footer} hidden={phase === 'intro'} inert={phase !== 'expanded'} aria-hidden={phase !== 'expanded'}>
        <div><p className={styles.eyebrow}>一张会生长的地图</p><h2>持续更新，保留依据。</h2><p className={styles.footerNote}>记录认识的变化，也说明还不知道什么。</p></div>
        <nav aria-label="来源与项目记录">
          <Link href="/docs/sources">来源目录 <ArrowUpRight size={15} aria-hidden="true" /></Link>
          <Link href="/docs/project/updates">更新记录 <ArrowUpRight size={15} aria-hidden="true" /></Link>
          <Link href="/docs/project/status">项目进度 <ArrowUpRight size={15} aria-hidden="true" /></Link>
        </nav>
      </footer>
    </HomeExperience>
  );
}
