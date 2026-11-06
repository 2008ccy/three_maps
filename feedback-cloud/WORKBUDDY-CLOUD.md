# 反馈接入 WorkBuddy 云数据库

三张地图与更新记录仍然是项目里的静态内容，只有「反馈」放在云端共享数据库。访客无需登录。

- 应用：三张活地图（`wbapp_pKlQiFEGLYBr7gJ1WeGUQW`）
- 数据库：PostgreSQL 17，库 `postgres-fncydubq`
- 表：`public.feedback`（唯一一张业务表）
- 网页只持有 `https://three-maps-02432.app.workbuddy.host` 与 publishable key，二者只用于标识应用，不含数据权限；数据库连接串与任何密钥都不在网页代码里。

## 小组在哪里看和改

WorkBuddy →「云服务」→「数据库」→「数据」→ 选表 `feedback`。这里用管理凭据读写，不受访客权限限制，可以直接查看、编辑、删除记录；也可以点「SQL」执行下面第二段的语句。

## 字段含义

| 字段 | 含义 | 谁来写 |
| --- | --- | --- |
| `id` | 反馈编号，`FB-` + UUID，自动生成，请勿修改 | 系统 |
| `map_id` | 所属地图：`domain` 领域 / `ecosystem` 生态 / `cognition` 认知 | 访客 |
| `node_id` | 知识点 id（小写字母、数字、连字符），空表示针对整张地图 | 访客 |
| `type` | 类型：内容错误 / 链接问题 / 使用体验 / 其他建议 | 访客 |
| `content` | 反馈正文，纯文本 5–1000 字 | 访客 |
| `nickname` | 昵称，≤20 字，空则显示「匿名访客」 | 访客 |
| `reference_url` | 参考链接，仅 http/https，≤2048 字符 | 访客 |
| `created_at` | 提交时间（UTC），自动生成 | 系统 |
| `status` | 处理状态：待核实 / 已采纳待修改 / 已完成 / 暂不采纳 | 小组 |
| `reply` | 公开回复，显示为「小组回复」 | 小组 |
| `resolution` | 公开处理说明，显示为「处理说明」（改了什么 / 为什么不采纳） | 小组 |
| `release_version` | 实际上线的版本号，格式 `v1.5`；未上线留空 | 小组 |
| `is_public` | 是否公开展示，默认 `true`；改成 `false` 即对访客隐藏 | 小组 |
| `internal_notes` | 内部备注，公开接口永不返回 | 小组 |
| `request_key` / `request_hash` | 提交幂等键与其内容指纹，防重复提交，内部字段 | 系统 |

状态与字段的取值受数据库约束保护：`status` 只能是上面四个值之一，`type` 只能是四种类型之一，正文长度、昵称长度、链接格式都由 CHECK 约束把关。

## 怎样回复、改状态

在数据表里直接改这一行的三列，改完即生效，访客刷新就能看到：

```sql
UPDATE public.feedback
SET status = '已采纳待修改',
    reply = '谢谢指出，我们已核对 RAG 那一段的引用标注，正在修改。',
    resolution = '将重写该知识点的引文段落并核对出处。',
    release_version = NULL,          -- 真正上线后再填 v1.5
    internal_notes = '内部：第 38 周处理'
WHERE id = 'FB-xxxxxxxx-xxxx-4xxx-xxxx-xxxxxxxxxxxx';
```

- 只想先内部消化、暂时不对外：`UPDATE public.feedback SET is_public = false WHERE id = '…';`
- 处理完上线后：`status = '已完成'` 并填 `release_version`，反馈页会链到已发布版本。
- 删除记录：在数据表里删除该行即可（访客没有删除权限）。

## 访客能做什么

访客角色 `anon` 对 `feedback` 表**没有任何** SELECT / INSERT / UPDATE / DELETE 权限（RLS 已开启且不设策略），只能执行三个 `SECURITY DEFINER` 函数：

- `submit_feedback(p_request_key, p_map_id, p_node_id, p_type, p_content, p_nickname, p_reference_url)` → 新增一条，`is_public` 强制为 true
- `list_feedback(p_map, p_type, p_status, p_cursor, p_limit)` → 只返回 `is_public = true` 的记录，每页最多 20 条
- `get_feedback(p_id)` → 只返回公开记录

因此「改状态、冒充小组回复、删除」在数据库层就被拒绝，而不是靠前端隐藏按钮；隐藏的记录在列表和详情里都不再出现。返回字段只有公开投影，`internal_notes`、`request_key`、`request_hash`、`is_public` 不会出现在响应里。

## 网页侧

- `website/src/lib/feedback-cloud.ts`：把原 `/feedback` HTTP 契约映射到上述三个函数（保留原有的入参校验、幂等键、错误文案与超时）。
- `website/src/lib/feedback-client.ts`：`feedbackService` 优先使用云端配置，未配置时才退回旧的 `NEXT_PUBLIC_FEEDBACK_API_BASE_URL`。
- 环境变量（`website/.env.local`，不进仓库）：
  - `NEXT_PUBLIC_WORKBUDDY_CLOUD_ENDPOINT=https://three-maps-02432.app.workbuddy.host`
  - `NEXT_PUBLIC_WORKBUDDY_CLOUD_KEY=<publishable key>`

## 建表脚本

`feedback-cloud/sql/002-workbuddy-cloud.sql` 是完整初始化脚本（建表、注释、索引、RLS、三个函数、授权），接入时记录为已在云端执行。它包含不带 IF NOT EXISTS 的建表与建索引语句，不应在已有表上直接重放。

2026-11-06 的只读检查确认：真实 `list_feedback` 和 `get_feedback` 均返回 HTTP 200。此次没有提交、修改或删除反馈，不把只读可达性等同于写入或跨设备验收。

`sql/003-workbuddy-targets.sql` 是本地准备、尚未执行到云端的后续补丁：

- 通过活动目标表和 INSERT trigger 拒绝不存在、退役或属于其他地图的节点；历史公开反馈仍可读取。
- 新提交的参考链接拒绝 authority 中的用户名密码和未编码空白，保留 HTTP/HTTPS、编码空格和路径中的 @。
- 目标清单与 `data/targets.json` 一起维护，`website` 的 `npm run check` 校验两者与当前地图一致。补丁本身可重复执行。

应用补丁需由管理员在受保护 SQL 管理端审阅并执行；本轮没有连接管理凭据或执行迁移。来源限频仍未在此 RPC 源码中实现，不能把旧云函数适配器的“每来源每分钟 5 条”测试结果当作当前 RPC 的已上线能力；需要实际可信网关或服务端补充并验收。
