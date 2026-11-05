// 云端反馈接入验收脚本（真实读写，非模拟）。
//
// 用法：node scripts/accept-feedback.mjs
// 读取 .env.local 里的 endpoint / publishableKey，然后完全走网站正在使用的
// 同一套客户端代码：feedback-client → feedback-cloud 适配层 → 云端 PostgreSQL。
//
// 覆盖：提交、按编号读取、同键幂等重放、同键不同内容冲突、筛选、越权访问。
// 这是验收辅助脚本，不参与构建，也不会被网页打包。

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (match) process.env[match[1]] = match[2];
}

const { listFeedback, getFeedback, submitFeedback, feedbackService, FeedbackApiError } = await import('../src/lib/feedback-client.ts');

const stamp = new Date().toISOString();
const input = {
  target: { mapId: 'domain', nodeId: 'rag' },
  type: '内容错误',
  content: `【接口验收，非真实反馈】${stamp} 用于验证提交、读取与幂等重放。`,
};
const key = (tag) => `accept-${tag}-${crypto.randomUUID()}`;

assert.equal(feedbackService.configured, true, '未配置云端 endpoint / publishableKey');

// 1. 读取列表
const before = await listFeedback();
assert.ok(Array.isArray(before.items), '列表应返回 items 数组');
console.log(`1. 列表可读：当前 ${before.items.length} 条公开反馈，nextCursor=${before.nextCursor ? '有' : '无'}`);

// 2. 提交
const submitKey = key('submit');
const created = await submitFeedback(input, submitKey);
assert.match(created.id, /^FB-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
assert.equal(created.status, '待核实', '新反馈状态必须是待核实');
assert.equal(created.content, input.content);
console.log(`2. 提交成功：${created.id}（状态 ${created.status}，昵称 ${created.nickname ?? '匿名访客'}）`);

// 3. 按编号读取
const fetched = await getFeedback(created.id);
assert.equal(fetched.id, created.id);
assert.equal(fetched.content, input.content);
console.log('3. 按编号读取：内容一致');

// 4. 幂等重放：同键同内容，编号不变、不新增记录
const replay = await submitFeedback(input, submitKey);
assert.equal(replay.id, created.id, '同键重放必须返回同一编号');
const afterReplay = await listFeedback();
assert.equal(afterReplay.items.length, before.items.length + 1, '同键重放不应新增记录');
console.log('4. 幂等重放：编号不变，未新增记录');

// 5. 同键不同内容 → 409
let conflict = null;
try {
  await submitFeedback({ ...input, content: `${input.content}（内容已改）` }, submitKey);
} catch (error) {
  conflict = error;
}
assert.ok(conflict instanceof FeedbackApiError, '同键改内容必须报错');
assert.equal(conflict.status, 409, `同键改内容应返回 409，实际 ${conflict.status}`);
console.log('5. 同键不同内容：已按 409 拒绝');

// 6. 筛选
const byMap = await listFeedback({ map: 'domain' });
assert.ok(byMap.items.every((item) => item.target.mapId === 'domain'), '地图筛选必须只返回该地图');
assert.ok(byMap.items.some((item) => item.id === created.id), '按地图筛选应包含刚提交的反馈');
const done = await listFeedback({ status: '已完成' });
assert.ok(!done.items.some((item) => item.id === created.id), '待核实的反馈不应出现在已完成筛选里');
console.log('6. 筛选：地图命中，状态筛选正确排除');

// 7. 越权：普通访客直接读写数据库表必须被拒绝
const { createWorkBuddyCloud } = await import('@tencent-ai/workbuddy-cloud-sdk');
const cloud = createWorkBuddyCloud({
  endpoint: process.env.NEXT_PUBLIC_WORKBUDDY_CLOUD_ENDPOINT,
  publishableKey: process.env.NEXT_PUBLIC_WORKBUDDY_CLOUD_KEY,
});
const attempts = {
  '读取整表': await cloud.database.from('feedback').select('*').limit(1),
  '修改状态': await cloud.database.from('feedback').update({ status: '已完成' }).eq('id', created.id).select(),
  '冒充小组回复': await cloud.database.from('feedback').update({ reply: '冒充回复' }).eq('id', created.id).select(),
  '删除记录': await cloud.database.from('feedback').delete().eq('id', created.id).select(),
};
for (const [label, result] of Object.entries(attempts)) {
  assert.ok(result.error, `${label} 必须被数据库拒绝，实际未报错`);
  console.log(`7. 越权「${label}」被拒绝：${result.error.code}`);
}

// 8. 隐藏后的记录不可见（由管理员在受保护入口把 is_public 设为 false 后复查）
const hiddenId = process.env.ACCEPT_HIDDEN_ID;
if (hiddenId) {
  let notFound = null;
  try { await getFeedback(hiddenId); } catch (error) { notFound = error; }
  assert.ok(notFound instanceof FeedbackApiError && notFound.status === 404, '隐藏记录应返回 404');
  console.log(`8. 隐藏记录 ${hiddenId}：读取已返回 404`);
}

console.log(`\n验收通过。测试反馈编号：${created.id}（这是一条明确标记的测试记录，不计入真实反馈）`);
