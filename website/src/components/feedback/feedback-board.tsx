'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowRight, ArrowUpRight, ChevronDown, Eye, MessageSquare, RefreshCw } from 'lucide-react';
import { Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  feedbackHref, feedbackIdPattern, feedbackInputSchema, feedbackReferenceHref, feedbackReleaseHref, feedbackStatuses, feedbackTypes,
  isPublicReferenceUrl, type FeedbackFilters, type FeedbackInput, type FeedbackType, type PublicFeedback,
} from '@/lib/feedback-contract';
import { FeedbackApiError, feedbackService, getFeedback, listFeedback, submitFeedback } from '@/lib/feedback-client';
import { feedbackMaps, feedbackTargets, findFeedbackTarget } from '@/lib/feedback-targets';
import { basePath, withBasePath } from '@/lib/shared';
import styles from './feedback.module.css';

const count = (value: string) => Array.from(value).length;
const displayDate = (value: string) => new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Shanghai' }).format(new Date(value));
const errorMessage = (error: unknown) => {
  if (error instanceof FeedbackApiError) return error.message + (error.retryAfter ? ` 请在${error.retryAfter}秒后重试。` : '');
  return '共享反馈暂时无法加载，请稍后重试。';
};

// Isolate the dynamic query hook so the static form and service notice remain
// present in the exported HTML, including when JavaScript is unavailable.
function FeedbackLocationSync({ onChange }: { onChange: () => void }) {
  const query = useSearchParams().toString();
  useEffect(onChange, [query, onChange]);
  return null;
}

function FeedbackRecord({ item, expanded = false, releasedVersions }: { item: PublicFeedback; expanded?: boolean; releasedVersions: string[] }) {
  const target = findFeedbackTarget(item.target);
  const release = item.status === '已完成' && item.releaseVersion && releasedVersions.includes(item.releaseVersion) ? feedbackReleaseHref(item.releaseVersion) : null;
  const referenceText = item.referenceUrl && count(item.referenceUrl) <= 2048 && isPublicReferenceUrl(item.referenceUrl) ? item.referenceUrl : null;
  const reference = referenceText ? feedbackReferenceHref(referenceText, typeof window === 'undefined' ? '' : window.location.origin, basePath) : null;
  return <details className={styles.record} open={expanded} id={item.id}>
    <summary>
      <span className={styles.recordHeading}><span className={styles.recordType}>{item.type}</span><strong>{target?.label ?? '原反馈对象暂不可用'}</strong><span className={styles.recordMeta}><time dateTime={item.createdAt}>{displayDate(item.createdAt)}</time><span>{item.nickname || '匿名访客'}</span></span></span>
      <span className={styles.status} data-status={item.status}>{item.status}</span><ChevronDown size={17} aria-hidden="true" />
    </summary>
    <div className={styles.recordBody}>
      <p className={styles.identifier}>编号 <span>{item.id}</span></p>
      <p className={styles.plainText}>{item.content}</p>
      {reference && <a className={styles.reference} href={reference} target="_blank" rel="noopener noreferrer">参考链接 <ArrowUpRight size={14} aria-hidden="true" /><span>{reference}</span></a>}
      {referenceText && !reference && <p className={styles.reference}>参考地址<span>{referenceText}</span></p>}
      {(item.reply || item.resolution) && <section className={styles.response} aria-label="小组处理记录">{item.reply && <><h3>小组回复</h3><p className={styles.plainText}>{item.reply}</p></>}{item.resolution && <><h3>处理说明</h3><p className={styles.plainText}>{item.resolution}</p></>}</section>}
      <nav className={styles.recordLinks} aria-label="反馈关联入口">{target && <Link href={target.href}>查看反馈对象 <ArrowUpRight size={14} aria-hidden="true" /></Link>}{release ? <Link href={release}>已发布版本 {item.releaseVersion}<ArrowUpRight size={14} aria-hidden="true" /></Link> : item.releaseVersion && <span>关联版本 {item.releaseVersion}</span>}<a href={withBasePath(feedbackHref(item.id))}>打开这条反馈 <ArrowUpRight size={14} aria-hidden="true" /></a></nav>
    </div>
  </details>;
}

export function FeedbackBoard({ releasedVersions }: { releasedVersions: string[] }) {
  const [ready, setReady] = useState(false);
  const [targetValue, setTargetValue] = useState('');
  const [type, setType] = useState<FeedbackType>(feedbackTypes[0]);
  const [content, setContent] = useState(''), [nickname, setNickname] = useState(''), [referenceUrl, setReferenceUrl] = useState('');
  const [formError, setFormError] = useState(''), [success, setSuccess] = useState<PublicFeedback | null>(null), [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({}), [preview, setPreview] = useState<FeedbackInput | null>(null);
  const [retryAt, setRetryAt] = useState(0), [retrySeconds, setRetrySeconds] = useState(0);
  const [filters, setFilters] = useState<FeedbackFilters>({});
  const [singleId, setSingleId] = useState('');
  const [items, setItems] = useState<PublicFeedback[]>([]), [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]), [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false), [loadError, setLoadError] = useState(''), [reload, setReload] = useState(0);
  const requestKey = useRef<{ signature: string; key: string } | null>(null);
  const inFlight = useRef(false), submitAbort = useRef<AbortController | null>(null);
  const locationRead = useRef<(() => void) | null>(null), lastQuery = useRef<string | null>(null);
  const syncLocation = useCallback(() => locationRead.current?.(), []);
  const form = useRef<HTMLFormElement>(null), successNotice = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!retryAt) return;
    const tick = () => setRetrySeconds(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)));
    tick(); const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [retryAt]);
  useEffect(() => { if (success) successNotice.current?.focus({ preventScroll: true }); }, [success]);

  useEffect(() => {
    const read = () => {
      if (lastQuery.current === window.location.search) return;
      lastQuery.current = window.location.search;
      const query = new URLSearchParams(window.location.search);
      const map = feedbackMaps.find((item) => item.id === query.get('map'))?.id;
      const filterType = feedbackTypes.find((item) => item === query.get('type'));
      const status = feedbackStatuses.find((item) => item === query.get('status'));
      setFilters({ map, type: filterType, status });
      setSingleId(query.get('id') ?? ''); setCursors([undefined]); setPage(0);
      setFormError('');
      setFieldErrors({}); setPreview(null);
      if (map) {
        const target = findFeedbackTarget({ mapId: map, ...(query.get('node') ? { nodeId: query.get('node')! } : {}) });
        setTargetValue(target?.value ?? '');
        if (!target) setFormError('这个反馈对象已调整，请重新选择当前地图或知识点。');
      } else setTargetValue('');
      setReady(true);
    };
    locationRead.current = read;
    read(); window.addEventListener('popstate', read);
    return () => { locationRead.current = null; window.removeEventListener('popstate', read); submitAbort.current?.abort(); };
  }, []);

  const cursor = cursors[page];
  const invalidId = !!singleId && !feedbackIdPattern.test(singleId);
  useEffect(() => {
    if (!ready || !feedbackService.configured || invalidId) return;
    const controller = new AbortController(); let current = true;
    setLoading(true); setLoadError(''); setItems([]); setNextCursor(null);
    const request = singleId ? getFeedback(singleId, controller.signal).then((item) => ({ items: [item], nextCursor: null })) : listFeedback({ ...filters, cursor }, controller.signal);
    request.then((result) => { if (current) { setItems(result.items); setNextCursor(result.nextCursor); } }).catch((error: unknown) => { if (current) setLoadError(errorMessage(error)); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; controller.abort(); };
  }, [ready, singleId, invalidId, filters.map, filters.type, filters.status, cursor, reload]);

  function changeFilter(key: 'map' | 'type' | 'status', value: string) {
    const next: FeedbackFilters = { ...filters, [key]: value || undefined };
    setFilters(next); setCursors([undefined]); setPage(0); setSingleId('');
    const query = new URLSearchParams(window.location.search); query.delete('id'); query.delete('node');
    if (value) query.set(key, value); else query.delete(key);
    lastQuery.current = query.size ? `?${query}` : '';
    window.history.replaceState(null, '', `${window.location.pathname}${lastQuery.current}`);
  }
  function showAll() {
    setSingleId(''); setCursors([undefined]); setPage(0); setReload((value) => value + 1);
    const query = new URLSearchParams(window.location.search); query.delete('id');
    lastQuery.current = query.size ? `?${query}` : '';
    window.history.replaceState(null, '', `${window.location.pathname}${lastQuery.current}`);
  }
  function editField(name: string) {
    setFieldErrors((errors) => { const next = { ...errors }; delete next[name]; return next; });
    setFormError(''); setPreview(null); setSuccess(null);
  }
  function validateDraft() {
    setFormError(''); setFieldErrors({});
    const target = feedbackTargets.find((item) => item.value === targetValue);
    if (!target) {
      setFieldErrors({ target: '请选择当前地图或知识点。' });
      form.current?.querySelector<HTMLElement>('#feedback-target')?.focus();
      return null;
    }
    const parsed = feedbackInputSchema.safeParse({ target: target.target, type, content, ...(nickname.trim() ? { nickname } : {}), ...(referenceUrl.trim() ? { referenceUrl } : {}) });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
      setFieldErrors(errors);
      const fields: Record<string, string> = { content: 'content', nickname: 'nickname', referenceUrl: 'reference' };
      const first = Object.keys(errors)[0];
      form.current?.querySelector<HTMLElement>(`#feedback-${fields[first] ?? 'type'}`)?.focus();
      return null;
    }
    return parsed.data;
  }
  function showSubmitted(item: PublicFeedback) {
    // A successful submission must remain discoverable even when the current
    // list is filtered by another map, status or feedback type.
    setFilters({}); setCursors([undefined]); setPage(0); setSingleId(item.id);
    lastQuery.current = `?id=${encodeURIComponent(item.id)}`;
    window.history.replaceState(null, '', `${window.location.pathname}${lastQuery.current}`);
    setReload((value) => value + 1);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || !feedbackService.configured || inFlight.current || retrySeconds > 0) return;
    setFormError(''); setSuccess(null);
    const input = validateDraft();
    if (!input) return;
    const signature = JSON.stringify(input);
    if (!requestKey.current || requestKey.current.signature !== signature) {
      const key = globalThis.crypto?.randomUUID?.();
      if (!key) { setFormError('当前浏览器无法生成安全提交标识，请使用支持安全连接的浏览器重试。'); return; }
      requestKey.current = { signature, key };
    }
    const controller = new AbortController(); submitAbort.current = controller;
    inFlight.current = true; setSubmitting(true);
    try {
      const item = await submitFeedback(input, requestKey.current.key, controller.signal);
      if (controller.signal.aborted) return;
      setSuccess(item); setContent(''); setReferenceUrl(''); setPreview(null); requestKey.current = null; showSubmitted(item);
    } catch (error) {
      if (!controller.signal.aborted) setFormError(errorMessage(error));
      if (error instanceof FeedbackApiError && error.status === 409) requestKey.current = null;
      if (error instanceof FeedbackApiError && error.status === 429 && error.retryAfter) {
        setRetrySeconds(error.retryAfter); setRetryAt(Date.now() + error.retryAfter * 1000);
      }
    } finally { if (!controller.signal.aborted) setSubmitting(false); inFlight.current = false; }
  }

  return <div className={styles.page}>
    <Suspense fallback={null}><FeedbackLocationSync onChange={syncLocation} /></Suspense>
    <nav className={styles.breadcrumb} aria-label="反馈所属路径"><Link href="/">首页</Link><span>/</span><span>反馈与改进</span></nav>
    <header className={styles.header}><p className={styles.eyebrow}><MessageSquare size={15} aria-hidden="true" />一起改进三张地图</p><h1>反馈与改进</h1><p>指出一个具体问题，查看小组怎样核实、回复和修改。</p></header>
    {!feedbackService.configured && <div className={styles.serviceNotice} role="status"><strong>共享反馈尚未开放</strong><p>{feedbackService.message}</p></div>}
    <noscript><p className={styles.serviceNotice}>反馈提交与云端查询需要启用JavaScript。地图内容仍可直接阅读。</p></noscript>
    <div className={styles.layout}>
      <section className={styles.compose} aria-labelledby="feedback-form-title">
        <h2 id="feedback-form-title">提交反馈</h2><p className={styles.help}>提交后会公开展示，请勿填写手机号、学号或其他私人信息。</p>
        <form ref={form} onSubmit={submit} noValidate>
          <fieldset disabled={submitting}>
            <label htmlFor="feedback-target">反馈对象<span>必选</span></label><select id="feedback-target" value={targetValue} onChange={(event) => { editField('target'); setTargetValue(event.target.value); }} aria-invalid={!!fieldErrors.target} aria-describedby={fieldErrors.target ? 'feedback-target-error' : undefined} required><option value="">选择地图或知识点</option>{feedbackMaps.map((map) => <optgroup label={map.title} key={map.id}>{feedbackTargets.filter((item) => item.target.mapId === map.id).map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</optgroup>)}</select>
            {fieldErrors.target && <p id="feedback-target-error" className={styles.fieldError} role="alert">{fieldErrors.target}</p>}
            <label htmlFor="feedback-type">反馈类型<span>必选</span></label><select id="feedback-type" value={type} onChange={(event) => { editField('type'); setType(event.target.value as FeedbackType); }}>{feedbackTypes.map((item) => <option key={item}>{item}</option>)}</select>
            <label htmlFor="feedback-content">具体内容<span data-over-limit={count(content) > 1000}>{count(content)} / 1000字</span></label><textarea id="feedback-content" rows={6} maxLength={2000} value={content} onChange={(event) => { editField('content'); setContent(event.target.value); }} aria-invalid={!!fieldErrors.content} aria-describedby={`feedback-content-help${fieldErrors.content ? ' feedback-content-error' : ''}`} required /><p id="feedback-content-help" className={styles.fieldHelp}>5—1000字。建议写清在哪里遇到问题、实际情况和希望怎样改进。</p>
            {fieldErrors.content && <p id="feedback-content-error" className={styles.fieldError} role="alert">{fieldErrors.content}</p>}
            <label htmlFor="feedback-nickname">昵称<span>选填，最多20字</span></label><input id="feedback-nickname" maxLength={40} value={nickname} onChange={(event) => { editField('nickname'); setNickname(event.target.value); }} aria-invalid={!!fieldErrors.nickname} aria-describedby={fieldErrors.nickname ? 'feedback-nickname-error' : undefined} autoComplete="nickname" />
            {fieldErrors.nickname && <p id="feedback-nickname-error" className={styles.fieldError} role="alert">{fieldErrors.nickname}</p>}
            <label htmlFor="feedback-reference">参考链接<span>选填</span></label><input id="feedback-reference" type="url" inputMode="url" maxLength={2048} value={referenceUrl} onChange={(event) => { editField('referenceUrl'); setReferenceUrl(event.target.value); }} placeholder="https://" aria-invalid={!!fieldErrors.referenceUrl} aria-describedby={`feedback-reference-help${fieldErrors.referenceUrl ? ' feedback-reference-error' : ''}`} /><p id="feedback-reference-help" className={styles.fieldHelp}>仅接受HTTP或HTTPS地址，最多2048字符。</p>
            {fieldErrors.referenceUrl && <p id="feedback-reference-error" className={styles.fieldError} role="alert">{fieldErrors.referenceUrl}</p>}
          </fieldset>
          {formError && <p className={styles.error} role="alert">{formError}</p>}
          <button className={styles.previewButton} type="button" disabled={!ready || submitting} onClick={() => { const input = validateDraft(); setPreview(input); }}><Eye size={16} aria-hidden="true" />预览反馈</button>
          {preview && <section className={styles.preview} aria-label="反馈内容预览"><h3>提交前预览</h3><p className={styles.fieldHelp}>仅预览，尚未提交或保存。</p><p>{findFeedbackTarget(preview.target)?.label} · {preview.type}</p><p className={styles.plainText}>{preview.content}</p><p>署名：{preview.nickname || '匿名访客'}</p>{preview.referenceUrl && <p className={styles.plainText}>参考链接：{preview.referenceUrl}</p>}</section>}
          <button className={styles.submit} type="submit" disabled={!ready || !feedbackService.configured || submitting || retrySeconds > 0}>{submitting ? '正在提交…' : retrySeconds > 0 ? `${retrySeconds}秒后可重试` : '提交公开反馈'}<ArrowRight size={16} aria-hidden="true" /></button>
          {!feedbackService.configured && <p className={styles.fieldHelp}>服务接通前不会发送或保存表单内容。</p>}
        </form>
        {success && <div ref={successNotice} className={styles.success} role="status" tabIndex={-1}><strong>反馈已提交</strong><p>编号 <span>{success.id}</span></p><a href={withBasePath(feedbackHref(success.id))}>查看这条反馈<ArrowUpRight size={14} aria-hidden="true" /></a></div>}
      </section>
      <section className={styles.feed} aria-labelledby="feedback-list-title" aria-busy={loading}>
        <div className={styles.listHeading}><div><h2 id="feedback-list-title">{singleId ? '反馈详情' : '公开反馈'}</h2><p>小组核实后，会在这里更新回复与处理结果。</p></div>{singleId ? <button type="button" onClick={showAll}><ArrowLeft size={14} aria-hidden="true" />查看全部</button> : <button type="button" onClick={() => setReload((value) => value + 1)} disabled={!feedbackService.configured || loading}><RefreshCw size={14} aria-hidden="true" />刷新</button>}</div>
        {!singleId && <div className={styles.filters} aria-label="筛选公开反馈"><label>地图<select aria-label="筛选地图" value={filters.map ?? ''} onChange={(event) => changeFilter('map', event.target.value)}><option value="">全部地图</option>{feedbackMaps.map((map) => <option value={map.id} key={map.id}>{map.title}</option>)}</select></label><label>类型<select aria-label="筛选类型" value={filters.type ?? ''} onChange={(event) => changeFilter('type', event.target.value)}><option value="">全部类型</option>{feedbackTypes.map((item) => <option key={item}>{item}</option>)}</select></label><label>状态<select aria-label="筛选状态" value={filters.status ?? ''} onChange={(event) => changeFilter('status', event.target.value)}><option value="">全部状态</option>{feedbackStatuses.map((item) => <option key={item}>{item}</option>)}</select></label></div>}
        {!feedbackService.configured ? <div className={styles.empty}><MessageSquare size={25} aria-hidden="true" /><p>反馈开放后，这里将显示大家的问题与小组处理结果。</p></div> : invalidId ? <p className={styles.error} role="alert">反馈编号无效，请通过有效编号重新打开。</p> : loading || !ready ? <p className={styles.empty} role="status">正在读取共享反馈…</p> : loadError ? <div className={styles.loadError} role="alert"><p>{loadError}</p><button type="button" onClick={() => setReload((value) => value + 1)}>重新加载</button></div> : items.length ? <div className={styles.records}>{items.map((item) => <FeedbackRecord item={item} key={item.id} expanded={!!singleId} releasedVersions={releasedVersions} />)}</div> : <p className={styles.empty}>{Object.values(filters).some(Boolean) ? '当前筛选下还没有公开反馈。' : '还没有公开反馈。欢迎指出第一个具体问题。'}</p>}
        {feedbackService.configured && !singleId && !loading && !loadError && <nav className={styles.pagination} aria-label="反馈分页"><button type="button" disabled={page === 0} onClick={() => setPage((value) => value - 1)}><ArrowLeft size={15} aria-hidden="true" />上一页</button><span>第{page + 1}页 · 每页最多20条</span><button type="button" disabled={!nextCursor} onClick={() => { if (!nextCursor) return; setCursors((value) => [...value.slice(0, page + 1), nextCursor]); setPage((value) => value + 1); }}>下一页<ArrowRight size={15} aria-hidden="true" /></button></nav>}
      </section>
    </div>
  </div>;
}
