# 非地图功能核查 · 2026-11-06

本记录区分当前实现、真实只读服务验证、本地回归与仍待实际验收的能力。没有提交真实反馈、调用写入 RPC、修改云端数据、执行云端迁移、发布网站或读取管理凭据。云端检查只发出 GET 请求，日志不保存 endpoint、key、反馈内容或私密字段。

| 功能 | 结果与依据 | 边界 |
| --- | --- | --- |
| 反馈对象带入、逐字段校验、预览、成功/失败显示 | `website/src/components/feedback/feedback-board.tsx` 与前端反馈测试可核对；地图及正文入口均使用当前目标目录。前端反馈测试 15/15 通过。 | 本轮没有按下真实提交按钮；提交成功仅在离线协议测试验证。 |
| 真实反馈列表、详情 | 本地 `.env.local` 配置 WorkBuddy；SDK GET `list_feedback` 与已有记录的 GET `get_feedback` 均 HTTP 200，详情编号与列表一致。见 `feedback-read-only.json`。 | 这不是跨设备持久化或新反馈写入验收。 |
| 匿名整表读取保护 | 实际 GET `feedback?select=id&limit=1` 返回 HTTP 401 / `DATABASE_42501`，未取得整表数据。 | 实际更新、删除、管理回复和隐藏操作本轮不执行，不能据此宣称全部管理权限已验收。 |
| 筛选、分页、幂等、字段权限 | 当前托管 SQL002 路径与本地准备的 SQL003 补丁在真实嵌入 PostgreSQL 引擎测试；包含等时分页、隐藏记录、管理员公开字段、同键冲突及匿名表权限。 | 本地单连接引擎不验证云端锁竞争、网络或平台权限配置。 |
| 文档、来源、图片、公式、更新记录 | 源码中 `ContentLink` 解析 node:/ref: 并保留旧正文入口限制；`ContentImage` 处理部署前缀并提供原图链接；MDX/KaTeX 在构建期渲染；`UpdateEntry` 使用原生 details。已有静态测试覆盖公式、来源、返回入口、更新折叠卡。 | 本次广泛浏览器/静态导出回归由主任务执行；不能把仅阅读测试源码称为本代理已操作全部文档。 |
| 正文返回 | `document-return-link.tsx:7` 校验同源、指定地图路径后恢复已存 query/hash，无有效记录时使用稳定所属节点；`document-navigation.ts` 为直接进入提供地图/首页回退。 | 无脚本时使用稳定链接；旧 BackButton 组件不等于当前页面必定展示返回上页按钮。 |
| GitHub Pages CI | 已修复工作流缺少 WorkBuddy 两项公开构建变量的注入；部署说明给出 Repository variables 路径和变量名。 | 本轮未改变 GitHub 设置或运行远程发布；Repository variables 实际是否设置、线上产物与国内可达性仍需正式环境确认。 |
| 登录、地图 AI | 现有应用无登录流程、模型服务端接口或地图 AI 问答功能。 | 仍是未实现范围，不属于通过此次样式或现有功能回归自动完成的功能。 |

## 已发现并处理的确定问题

1. **CI 配置遗漏**：本地真实反馈使用 `NEXT_PUBLIC_WORKBUDDY_CLOUD_ENDPOINT` 与 `NEXT_PUBLIC_WORKBUDDY_CLOUD_KEY`，原 `.github/workflows/website.yml` 只传旧 HTTP 配置。现已加入两项 Repository variables 引用，不写入实际值。
2. **状态文档过期**：根 README、网站维护说明和 `project/status.mdx` 原称“当前未接通”且首页仍留待视觉阶段。已改为当前实现及真实只读验证的范围，状态日期更新到 2026-11-06。
3. **活动目标校验只在前端/旧适配器充分实现**：当前 SQL002 `submit_feedback` 在 151 行只检查节点 ID 格式。原 SQL 在本地可接受一个不存在的 `unknown-node`。已准备 `sql/003-workbuddy-targets.sql`：当前 3 张地图、59 个活动节点的私有目标表及 INSERT guard；拒绝不存在、退役、错图节点，保留历史公开读取。内容一致性加入 `website/scripts/check-feedback.mjs`。
4. **服务端 URL 契约漏洞**：SQL002 163 行的前缀正则可接受含用户名密码的 URL，而前端拒绝该公开记录。已在本地 SQL003 guard 中拒绝 authority 用户信息及未编码空白；前端和保留的旧适配器同步拒绝未编码空白。回归覆盖 credentials、空白、换行、Tab，并保留 `%20`、路径/查询中的 @ 与 IPv6 URL。
5. **活跃路径缺乏直接测试**：原后端测试主要覆盖事件云函数与 SQL001。现新增 SQL002/003 的 PostgreSQL 引擎回归，并给实际 `feedback-cloud.ts` 适配器增加注入式离线 RPC 测试；默认运行传输不变。

**SQL003 仅准备在本地，尚未执行到云端。** 不能在最终结论中把上述服务端保护写成已经在线生效。管理员须在受保护 SQL 管理端审查、执行并做实际验收。

## 仍待补齐或实际验收

- 当前 SQL002 RPC 源码没有基于可信来源的业务限频逻辑。旧 `service.mjs` 的每来源每分钟 5 条限制及其测试不代表当前 SQL RPC 具备该能力；需要实际网关/服务端支持，不能信任访客自报 IP 或用前端倒计时替代。
- 新反馈写入、设备 A/B 同编号读取、管理员回复/状态/隐藏，以及正式 Origin 的平台访问限制与服务额度，本轮未实际操作。
- 公开部署、正式环境 Repository variables、国内校园网/移动网络可达性与实际设备表现仍需确认。
- AI、登录、真实实验与非组员反馈材料仍按项目边界处理。

## 本地证据

- `feedback-read-only.json`：两次只读 RPC HTTP200、匿名表读取拒绝；只保存状态与响应形状。
- `read-feedback-cloud.mjs`：只允许 GET/HEAD 的诊断脚本。
- `website/scripts/test-feedback.mjs`：15 个前端协议/活跃适配器测试。
- `feedback-cloud/test/workbuddy-sql.test.mjs`：6 个活跃托管 SQL 与未执行补丁的本地测试。
- 旧事件云函数/PostgreSQL/文档适配器测试原为 21 个；加入上述 6 个后总计 27 个。
