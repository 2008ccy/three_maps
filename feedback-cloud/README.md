# WorkBuddy 共享反馈云端部署包

这是待核验的部署源码，不是已连接的服务。当前云环境ID、数据库模式、HTTP网关地址、平台受保护管理入口、管理者权限和额度均未核验；没有创建、连接或部署云资源。真实跨设备共享与数据库权限验收未完成。网站在未配置时不会请求本包，也不会使用本地反馈存储代替。

## 适用平台与入口

本包提供 **PostgreSQL** 与 CloudBase **传统文档数据库**两个适配器，均遵循同一 HTTP 协议；先确认当前 WorkBuddy 应用实际数据库模式，直接复用现有环境。入口为普通事件云函数 `index.main`，由 HTTP 网关提供访问，Node.js 要求20或以上。PostgreSQL 使用 `pg` 8.23.1 驱动及私有 TLS 连接；文档模式使用 `@cloudbase/node-sdk` 3.18.7，依赖锁定与安全修复见 `DEPENDENCY-AUDIT.md`。

PostgreSQL 模式需要平台提供云函数可达的标准 PostgreSQL 连接地址、服务器专用登录角色及数据库管理端执行 SQL 的权限；它不是把匿名浏览器密钥代入数据库 URL。若当前应用只提供 SDK/HTTP 数据 API、不可访问 PostgreSQL 协议，需按接口契约在平台端适配事务，不能使用逐条无事务的 HTTP 写入替代。新式 HTTP 函数需在平台封装成本文的事件入口，并验证可信来源 IP，不直接信任访客提供的 X-Forwarded-For。

普通事件云函数由平台提供服务端凭据；本包只使用函数身份初始化SDK，不将任何数据库凭据放进网站。`FEEDBACK_HASH_SECRET`是仅云端持有的随机签名/哈希密钥，不能使用浏览器公开变量传入。

## 配置与开通前核对

仅在平台核实后设置服务器环境变量，`.env.example`保留安全的未开启默认值：

| 配置 | 用途 |
| --- | --- |
| `FEEDBACK_ENV_ID` | 当前WorkBuddy应用真实云环境ID |
| `FEEDBACK_DATABASE_MODE` | `postgres` 或 `document`；不自动猜测 |
| `FEEDBACK_POSTGRES_URL` | PG 专用：云函数私密连接字符串，格式为 `postgresql://server_login:password@host:5432/database`，不含查询参数 |
| `FEEDBACK_POSTGRES_CA` | PG 可选：平台提供的根 CA PEM，始终验证服务器证书；不提供则使用系统信任根 |
| `FEEDBACK_ALLOWED_ORIGINS` | JSON数组，列出正式网站完整HTTPS Origin；本地测试可显式加入localhost的HTTP Origin，不接受星号或路径 |
| `FEEDBACK_HASH_SECRET` | 至少32字符的高熵服务器密钥，用于来源哈希、幂等索引和游标签名；不得公开 |
| `FEEDBACK_MANAGEMENT_VERIFIED=true` | 受保护数据库管理入口、管理员权限及客户端拒绝规则已实际验收 |
| `FEEDBACK_GATEWAY_VERIFIED=true` | HTTP网关事件协议、可信来源IP、路由、函数调用权限和TLS已实际验收 |

缺任一必要配置，入口在加载SDK前返回503；标记不是鉴权机制，也不能替代平台权限配置。需要额外付费、开通服务或授权时，先说明并等待用户确认。当前应用与管理入口无法核实时，保持关闭。

1. 在当前WorkBuddy应用打开「云服务→数据库→数据／函数／权限」，确认小组能用受保护的账号入口管理记录。
2. 确认数据库模式。PG 在管理端执行下节 `sql/001-feedback.sql`；文档模式在同一环境创建下列三个集合。安装服务端依赖时使用 `npm ci --omit=dev --ignore-scripts`，严格使用当前锁文件；本包没有自动部署命令。
3. PG 验证私有 schema 的 SQL 权限和 RLS，文档模式逐集合应用客户端拒绝规则；均用未登录及普通访客会话真实验证。
4. 配置HTTP网关透传 `/feedback` 和 `/feedback/*` 到同一个事件云函数；确保实际`event.path`与本包协议一致。如使用URL前缀，应由网关剥离前缀，而非让客户端指定路由。
5. 实际核实SDK的 `getCloudbaseContext(context).TCB_SOURCE_IP` 来自平台运行时且逐请求变化；缺失时POST返回503，不降级信任 `X-Forwarded-For`、事件body或客户端提供的IP。
6. 限制直接客户端SDK调用此函数，避免伪造HTTP事件；公开访问只经已核实网关。CORS只约束允许的网站Origin，不是管理员鉴权，也无法阻止非浏览器伪造Origin；服务器白名单、事务限频和数据库规则仍必须执行。
7. 通过真实越权/持久化验收后才设置两个核验标志；随后在静态网站配置对应的公开接口基址和前端已核验标记。基址不包含`/feedback`后缀。

## PostgreSQL 初始化与管理

1. 在 WorkBuddy 当前应用的受保护数据库 SQL 管理端执行 [`sql/001-feedback.sql`](sql/001-feedback.sql)。脚本创建私有 `feedback_private` schema、三张表、八个列表/游标索引和 RLS 策略，可重复执行；不修改现有应用表，不自动连接云端。脚本要求数据库管理角色可建 schema、表、索引和角色；权限不足时由该应用数据库管理员执行，不改用公开客户端权限。
2. 数据库管理员创建或选用**仅供函数使用**的 LOGIN 角色，安全配置密码，在管理端执行 `GRANT three_maps_feedback_backend TO <该服务登录角色>`。不要把此组角色授予 `anon`、`authenticated` 或任何访客身份。`three_maps_feedback_backend` 自身为 NOLOGIN，无超级用户、建库、建角色和绕过RLS能力。
3. 在函数环境设置 `FEEDBACK_DATABASE_MODE=postgres`、私密 `FEEDBACK_POSTGRES_URL` 及通用配置。使用平台提供的 TLS 主机名；如需要私有 CA，设置 `FEEDBACK_POSTGRES_CA`。URL 中不允许 `sslmode`、`sslcert` 等查询参数，以免覆盖证书验证。密码特殊字符需 URL 编码；不得写入仓库或 `NEXT_PUBLIC_*`。
4. 三表均启用RLS，且不向PUBLIC授予schema和表权限，不设匿名/普通用户策略。schema 不应加入平台客户端暴露清单。函数角色仅可读取/插入反馈与幂等索引、更新限流计数，不能更新反馈状态/回复或删除记录；平台管理员在受保护管理端维护这些字段。权限验收需确认实际服务登录继承该角色，普通用户既没有该角色成员资格，也没有表所有者/超级用户/BYPASSRLS身份。
5. HTTP 字段保持原协议；PG管理端列名为 `created_at/is_public/reference_url/release_version/internal_notes`，其他业务字段 `id/target/type/content/nickname/status/reply/resolution` 同名。`target` 为 JSONB。`internal_notes` 始终私密；`reply/resolution` 为公开处理说明。`feedback_requests` 与 `feedback_rate_limits` 只供接口使用。

PG写入在同一客户端连接中执行 BEGIN/COMMIT/ROLLBACK；先通过幂等唯一键声明请求，再锁定来源计数行，反馈与请求索引通过延迟外键在同一事务提交。所有访客输入使用参数绑定。列表按毫秒UTC时间和稳定编号排序，与文档适配器返回相同JSON。连接池每实例最多2连接，连接5秒、SQL8秒超时；初始化脚本/权限错误或数据库断连均返回脱敏503，不回退到浏览器存储。

本地使用 `@electric-sql/pglite` 0.5.15（仅开发依赖）执行真实 PostgreSQL 引擎的初始化SQL、RLS与事务测试；它是单连接嵌入引擎，不证明云端多连接锁等待、TLS、平台权限或真实跨设备访问已通过。这些应在当前 WorkBuddy 测试环境独立验证。

## 文档数据库数据与权限

`database.rules.json`是逐集合规则清单，在平台每个集合的权限管理中应用该集合对应的规则对象；它不是宣称会被平台自动导入的配置文件。三个集合都必须禁止客户端直接read/write/create/update/delete。服务端SDK以受控函数身份执行访问，管理员仅通过WorkBuddy受保护数据库界面维护记录；不提供任何公开PATCH、PUT或DELETE接口。

| 集合 | 字段与用途 |
| --- | --- |
| `feedback` | `_id=id=FB-UUID`；`target={mapId,nodeId?}`、`type`、`content`、可选`nickname/referenceUrl`、UTC ISO `createdAt`、`status`、`isPublic`及管理员填写的可选`reply/resolution/releaseVersion` |
| `feedback_requests` | 私有幂等索引：以密钥HMAC后的Idempotency-Key为文档ID，保存请求内容哈希、反馈编号和时间；不公开返回 |
| `feedback_rate_limits` | 私有来源限频：以可信IP的HMAC为ID，保存分钟窗口、计数和更新时间；不保存原始IP，不公开返回 |

初始`status=待核实`、`isPublic=true`、编号和时间由服务端生成。访客只能写反馈对象、类型、内容、昵称、参考链接；附带其他字段直接拒绝。新提交目标必须在 `data/targets.json` 当前白名单内，不接受旧别名或历史集合。更新地图时由仓库检查同步白名单。已存在的公开历史反馈仍可读取，其目标只校验地图ID与节点ID的结构；节点以后删去或合并时，不因历史目标不再属于当前白名单而使反馈或整个列表失效，前端对不可用目标不再生成链接。

管理员只维护状态、回复、处理说明、实际发布版本和公开可见性；不要修改稳定编号、提交时间或原始访客内容。建议状态流转为待核实→已采纳待修改→已完成，或待核实→暂不采纳并写明理由。正式版本在发布并复核后再填写，不能用计划版本冒充已发布。内部管理备注不得放进公开`reply/resolution`字段。

公开读取只投影`id/target/type/content/nickname/referenceUrl/createdAt/status/reply/resolution/releaseVersion`，仅返回`isPublic===true`。平台管理员隐藏记录后，列表、单条读取和幂等重放都不会继续公开其内容。由于前端公开反馈均按普通文本渲染，包含HTML的输入不会获得脚本执行能力。

## HTTP协议

| 操作 | 输入 | 成功结果 |
| --- | --- | --- |
| POST `/feedback` | JSON五字段输入；`Idempotency-Key`为16—100位字母、数字或连字符；必须携带允许的Origin | 201 `{item}`；重放为200 `{item}` |
| GET `/feedback` | 可选`map/type/status/cursor`，每页固定20条 | 200 `{items,nextCursor}` |
| GET `/feedback/FB-UUID` | 无查询参数 | 200 `{item}`；不存在或未公开为404 |

JSON输入示例结构为`{target:{mapId:"domain",nodeId:"rag"},type:"内容错误",content:"…",nickname:"…",referenceUrl:"https://…"}`。枚举与前端一致：类型为内容错误、链接问题、使用体验、其他建议；状态为待核实、已采纳待修改、已完成、暂不采纳。内容按Unicode码点计5—1000字，昵称最多20字，参考链接最多2048字符、必须为无用户名密码的HTTP/HTTPS绝对地址。

错误统一为`{error:{code,message}}`。无效输入400、未允许来源403、不存在404、不支持修改405、幂等请求冲突409、非JSON输入415、限频429（带Retry-After）、未配置或依赖错误503。不会回显SDK异常、环境变量或请求头。分页游标签名并绑定筛选条件，修改筛选需从第一页开始。

新提交、幂等索引和来源计数在一次数据库事务中提交。并发请求及网络重试使用同一幂等键时只生成一个编号；同键但不同规范化内容返回409。幂等重放先于计数检查，不重复消耗限频名额。同一可信来源每个自然分钟最多5条新反馈；部署期间保留幂等记录，不随意清空，以免重试变成重复记录。哈希密钥轮换需维护期安排，并明确旧幂等键与游标将失效。

文档模式分页按`createdAt desc, _id desc`排序；对每个使用的筛选组合建立对应复合索引：基础`isPublic`，可选`target.mapId/type/status`，以及`createdAt desc,_id desc`。共有8种可选筛选组合。具体索引语法以当前控制台为准，部署前需遍历所有组合与两页数据实测；缺索引返回503，不退回读取整表。

## 本地验证与真实验收

安装锁定依赖后运行`npm test`及`npm run check`。测试包含两种适配器；PG初始化脚本在本地实际执行两次并核验RLS、公开投影、幂等、限流、回滚及等时分页。测试存储仅存在于`test/database-fixture.mjs`，不会被部署入口导入，也没有对外模拟服务器。测试覆盖字段越权、Unicode与链接、来源缺失、并发幂等、并发限频、事务失败回滚、公开投影、隐藏记录、历史节点、分页与签名、方法限制和异常脱敏。另一个测试保留真实SDK的数据库/事务/查询实现，仅替换测试进程中的传输层，确认安全修复后的实际序列化与适配器兼容；这些均不代表实际云权限或跨设备共享已通过。

真实验收应使用明确标记的测试记录：A设备提交并刷新；B设备读取同一编号；小组在受保护界面回复，A和B刷新均看到一致状态；普通访客直接数据库读写与调用修改接口失败。确认测试不被计入真实非组员反馈。还应验证网关来源IP、防直接函数事件伪造、前端静态产物无密钥，以及生产CORS和接口地址。未完成前不启用网站公开服务标记，也不发布新功能。

## 已核对的官方参考

- [WorkBuddy云服务及受保护数据管理入口](https://www.codebuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/App-Publishing/Cloud-Services)
- [普通云函数经HTTP网关接收事件与响应](https://docs.cloudbase.net/service/access-cloud-function)
- [CloudBase服务端数据库事务](https://docs.cloudbase.net/database/transaction)
- [CloudBase PostgreSQL标准连接方式](https://docs.cloudbase.net/database/postgresql/connecting-to-postgresql)
- [node-postgres事务需要同一客户端连接](https://node-postgres.com/features/transactions)
- [node-postgres TLS设置与URL参数](https://node-postgres.com/features/ssl)
- [传统模式数据库安全规则；PG模式使用不同规则](https://docs.cloudbase.net/database/security-rules)
- [Node SDK鉴权及平台来源IP接口](https://github.com/TencentCloudBase/node-sdk/blob/master/docs/auth.md)
- [官方NPM包与固定版本](https://www.npmjs.com/package/%40cloudbase/node-sdk)
