import type { NodeLesson, TeamProfile } from '@/lib/maps/types';
import { teachingCase } from '@/lib/maps/teaching-case';
import styles from './maps.module.css';

export function DomainLesson({ lesson, ecosystem = false, profile }: { lesson: NodeLesson; ecosystem?: boolean; profile?: TeamProfile }) {
  return <article className={styles.lesson} aria-label="知识点教学内容">
    <p className={styles.lessonGoal}><span>学完能解释什么</span>{lesson.goal}</p>
    <section><h3>{ecosystem ? '角色与作用' : '概念解释'}</h3>{lesson.explanation.map((text) => <p key={text}>{text}</p>)}</section>
    {profile && <section className={styles.teamProfile} aria-label="团队资料卡"><h3>同一模板，逐项查证</h3><dl><dt>团队与系列</dt><dd>{profile.series}</dd><dt>代表发布物</dt><dd>{profile.release}</dd><dt>官方查证入口</dt><dd>{profile.official.map((link) => <a href={link.href} key={link.href} target="_blank" rel="noreferrer">{link.title} ↗</a>)}</dd><dt>可复用对象</dt><dd>{profile.reusable}</dd><dt>下游依赖</dt><dd>{profile.dependencies}</dd><dt>许可与资源边界</dt><dd>{profile.limits}</dd><dt>尚缺证据</dt><dd>{profile.missingEvidence}</dd></dl></section>}
    <section className={styles.teachingExample} aria-label="课程助手示例"><h3>{ecosystem ? '课程助手交接示例' : '课程助手示例'}</h3><p className={styles.exampleNotice}>{ecosystem ? '教学交接示例，非真实课程原文、实际部署记录或模型对比结果。' : teachingCase.notice}</p>
      {lesson.example.materials.map((id) => { const material = teachingCase.materials.find((item) => item.id === id)!; return <blockquote key={id}><span>{id} · 自编教学材料</span><p>{material.text}</p></blockquote>; })}
      <h4>输入</h4><p>{lesson.example.input}</p><h4>处理过程</h4><ol>{lesson.example.steps.map((text) => <li key={text}>{text}</li>)}</ol><h4>结果与判断</h4><p>{lesson.example.output}</p>
    </section>
    <section><h3>容易混淆的地方</h3><ul>{lesson.confusions.map((text) => <li key={text}>{text}</li>)}</ul></section>
    <section className={styles.understandingCheck}><h3>检查理解</h3><p>{lesson.check.question}</p><details><summary>展开答案与理由</summary><p>{lesson.check.answer}</p><small>仅供对照理解，不记录成绩，也不改变原资料状态。</small></details></section>
  </article>;
}

export function DomainAdvanced({ lesson }: { lesson: NodeLesson }) {
  if (!lesson.advanced?.length) return null;
  return <details className={styles.lessonAdvanced}><summary>进阶内容与进一步辨析</summary>{lesson.advanced.map((block) => <section key={block.title}><h3>{block.title}</h3>
    {block.formula && <div className={styles.lessonFormula} role="math" tabIndex={0} aria-label={block.formula}>{block.formula}</div>}
    {block.paragraphs?.map((text) => <p key={text}>{text}</p>)}
    {block.steps && <ol>{block.steps.map((text) => <li key={text}>{text}</li>)}</ol>}
    {block.table && <div className={styles.lessonTable} tabIndex={0} role="region" aria-label={block.title}><table><thead><tr>{block.table.headers.map((text) => <th key={text} scope="col">{text}</th>)}</tr></thead><tbody>{block.table.rows.map((row, i) => <tr key={i}>{row.map((text, j) => <td key={j}>{text}</td>)}</tr>)}</tbody></table></div>}
  </section>)}</details>;
}
