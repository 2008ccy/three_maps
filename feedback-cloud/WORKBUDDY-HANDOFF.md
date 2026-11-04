# WorkBuddy 数据库接入交接

本项目的反馈页与接口已经分离：静态网站只调用 HTTP API，数据库凭据只放在后端。此交接包用于后续接入你的 **现有 WorkBuddy 应用**。本文件不表示已创建云资源、已部署、已完成真实数据库或跨设备验收。

当前功能是 **公开反馈＋小组回复与处理状态**。提交页明确提示公开展示，不收集手机号、学号或私密联系方式。提交前预览仅用于核对内容，不会保存数据；接口未配置时提交保持禁用。

## 从哪里开始

| 文件 | 用途 |
| --- | --- |
| `README.md` | 运行时配置、接口语义、管理员操作与验收说明 |
| `openapi.json` | OpenAPI 3.1 契约，可交给 WorkBuddy 对照接入 |
| `src/runtime.mjs`、`index.js` | CloudBase 普通事件云函数入口；由 HTTP 网关公开访问 |
| `src/postgres-store.mjs`、`sql/001-feedback.sql` | PostgreSQL 适配器、三张表、索引、RLS 与专用服务端角色 |
| `src/cloudbase-store.mjs`、`database.rules.json` | 传统文档数据库适配器和逐集合客户端拒绝规则 |
| `data/targets.json` | 当前三图与活动知识点白名单，随内容检查保持同步 |
| `../website/.env.example` | 网站公开接口配置示例，不放数据库凭据 |

所有命令均从仓库根目录执行。本文中的域名、编号和测试内容均为示例，不代表现有云资源或真实反馈。

## 1. 确认现有应用与数据库模式

在 WorkBuddy 现有应用中打开云服务，记录数据库类型、环境 ID、可用的受保护管理入口、函数入口和 HTTP 网关地址。官方说明中的「数据／函数／权限」页用于查看、管理和保护数据；数据库模式以你当前应用的实际界面为准。[WorkBuddy 云服务说明](https://www.workbuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/App-Publishing/Cloud-Services)

- 若为 **PostgreSQL**，使用本包的 `postgres` 模式和 SQL；不要把文档库规则套在 PG 上。
- 若为 **CloudBase 传统文档数据库**，使用 `document` 模式和集合规则。
- 若只提供 SQL 函数、HTTP 云函数或其他托管入口，先适配网关事件与可信来源提取；现有入口要求 `httpMethod/path/headers/queryStringParameters/body` 事件结构。不要绕过可信来源校验，也不要改动网站协议来迁就入口差异。
- 复用当前应用及数据库，不为本功能另建一套环境。

## 2. 初始化数据权限

### PostgreSQL

由数据库管理员在 **现有数据库** 运行 `sql/001-feedback.sql`。脚本使用 `feedback_private` schema，创建 `feedback`、`feedback_requests`、`feedback_rate_limits` 三张表，并建立分页筛选索引、RLS 和 `three_maps_feedback_backend` 角色。

管理员选择一个专用于该云函数的服务器登录角色，再授予：

```sql
GRANT three_maps_feedback_backend TO your_server_only_login;
```

将 `your_server_only_login` 替换为实际角色名。不要把此角色授予 `anon`、`authenticated` 或浏览器使用的角色，也不要把 `feedback_private` 加入面向客户端的 API schema。若平台账号无权创建 schema、角色或策略，先由平台管理员完成权限配置，不能通过给匿名角色开放表来替代。

云函数角色只具备接口所需权限；状态、回复、公开可见性由有权的管理员在受保护管理入口维护。

### 传统文档数据库

在现有环境创建 `feedback`、`feedback_requests`、`feedback_rate_limits` 集合，将 `database.rules.json` 中对应规则应用到每个集合，拒绝客户端直接读写。按 `README.md` 建立筛选和分页所需索引；服务端 SDK 使用函数身份访问。

## 3. 配置后端并发布 API

先安装锁定依赖和执行本地检查：

```sh
npm --prefix feedback-cloud ci --ignore-scripts
npm --prefix feedback-cloud run check
npm --prefix feedback-cloud test
```

服务器私密环境变量：

| 配置 | 要求 |
| --- | --- |
| `FEEDBACK_ENV_ID` | 当前应用的真实 CloudBase 环境 ID；两个模式均需配置 |
| `FEEDBACK_DATABASE_MODE` | `postgres` 或 `document`，以实际数据库为准 |
| `FEEDBACK_POSTGRES_URL` | 仅 PG 模式：专用服务器角色的 `postgresql://…` 连接串，不包含 `sslmode` 或其他 URL 查询参数 |
| `FEEDBACK_POSTGRES_CA` | 可选：平台提供的 PEM CA 证书；TLS 默认校验证书，不关闭校验 |
| `FEEDBACK_ALLOWED_ORIGINS` | JSON 数组，例如 `["https://2008ccy.github.io"]`；Origin 不含 `/three_maps` 等路径 |
| `FEEDBACK_HASH_SECRET` | 至少32字符的随机高熵服务器密钥，用于幂等、来源哈希及游标签名 |
| `FEEDBACK_MANAGEMENT_VERIFIED` | 管理入口、权限与客户端拒绝规则真实通过验收后才设为 `true` |
| `FEEDBACK_GATEWAY_VERIFIED` | 网关路由、可信来源、函数调用边界与 TLS 真实通过验收后才设为 `true` |

密码中的特殊字符必须按连接串规则编码。连接串和哈希密钥只进入函数的私密环境配置，不能复制进前端、GitHub 仓库、截图或公开日志。默认配置未完成时服务返回 503，不会写入数据库。

发布整个 `feedback-cloud` 函数目录（含 `data/targets.json`、锁文件及已安装的生产依赖），入口为 `index.main`，Node.js 20 或以上。通过网关透传以下路径：

| 方法 | 网关转发路径 |
| --- | --- |
| GET、POST、OPTIONS | `/feedback` |
| GET、OPTIONS | `/feedback/*` |

若 API 对外地址含前缀，例如 `https://api.example.com/v1`，网站的基址包含 `/v1`，但网关转给函数的 `event.path` 仍是 `/feedback` 或 `/feedback/FB-…`。

只开放 HTTP 网关入口，限制客户端直接 SDK 调用事件函数。当前限流来源必须来自 CloudBase 函数上下文 `TCB_SOURCE_IP`；缺失时 POST 返回503。不得改为信任浏览器 body、`X-Forwarded-For` 或用户自填 IP。CORS 只是浏览器来源约束，不能代替权限控制。

## 4. 按统一契约验收

详细字段和返回值见 `openapi.json`；以下是必需行为：

- GET 列表返回 `{items,nextCursor}`，每页最多20条；GET 单条返回 `{item}`。
- POST 输入只允许 `target/type/content/nickname/referenceUrl`，必须带允许的 Origin 和 `Idempotency-Key`。
- 新增返回201 `{item}`，同键同内容重试返回200且编号不变；同键不同内容返回409。
- 客户端不能指定编号、时间、状态、回复或公开可见性。新反馈为 `待核实` 且公开；管理员隐藏后，列表、详情和幂等重放均不公开内容。
- 只允许三个读取／提交接口，没有公开的 PATCH、PUT、DELETE 或管理员回复接口。
- 字符数按 trim 后 Unicode 码点计算；内容5—1000字，昵称最多20字，参考链接最多2048字符且仅接受无账号密码的HTTP/HTTPS绝对地址。
- 无效请求400、来源403、反馈不存在或隐藏404、方法405、幂等冲突409、非JSON415、限频429、服务或配置异常503。429携带 `Retry-After`。
- 同来源IP每个自然分钟最多5条新反馈，幂等重试不重复计数。改变列表筛选时丢弃旧游标。

至少完成一次真实测试：A设备提交明确标记的测试反馈，B设备读取同一编号；管理员修改回复与状态后两端刷新可见；隐藏后两端详情404；普通访客直接数据库读写和修改接口均被拒绝。测试反馈不能计入课程要求的真实非组员反馈。

## 5. 接通网站

云端真实验收完成后，在网站构建环境配置：

```dotenv
NEXT_PUBLIC_FEEDBACK_API_BASE_URL=https://replace-with-your-feedback-api.example
NEXT_PUBLIC_FEEDBACK_SERVICE_VERIFIED=true
```

基址不含 `/feedback` 后缀，可以含网关前缀。它是公开 API 地址，不是数据库连接串。GitHub Pages 部署时将这两个名字设置为仓库的 Actions **Variables**；工作流在构建时读取。若本地构建，用 `website/.env.local` 或构建进程环境变量；示例文件本身不会启用服务。

```sh
npm --prefix website run check
npm --prefix website run build
npm --prefix website run check:export
npm --prefix website test
```

前端变量在构建时写入静态产物，更改后必须重新构建、部署；只修改运行时配置不会改变已发布 HTML/JS。未配置时网站仍可浏览，并显示「共享反馈尚未开放」，不会制造成功提示或用本地记录充当共享反馈。

## 管理员怎样处理反馈

PG 的数据库列使用 snake_case，HTTP 返回继续使用 camelCase。只在受保护的管理入口维护一条真实记录：

| 用途 | PG列 | 文档库字段 |
| --- | --- | --- |
| 处理状态 | `status` | `status` |
| 公开回复 | `reply` | `reply` |
| 公开处理说明 | `resolution` | `resolution` |
| 真实发布版本 | `release_version` | `releaseVersion` |
| 是否公开 | `is_public` | `isPublic` |
| 私密管理备注 | `internal_notes` | 自定义私有管理字段，不得放进公开回复字段 |

状态为 `待核实`、`已采纳待修改`、`已完成`、`暂不采纳`。实际发布后才填写 `v1.5` 等版本号和「已完成」，不修改原始内容、稳定编号和创建时间。发布前导出反馈及私有幂等／限流数据，并在隔离测试库验证可恢复；不要覆盖现有数据或重置幂等索引。

## 可复制给 WorkBuddy 的接入提示词

```text
请在我当前三张活地图项目的现有 WorkBuddy 应用中接入反馈数据库，复用已有应用和云环境，不要另建一套。

先阅读 feedback-cloud/WORKBUDDY-HANDOFF.md、README.md、openapi.json、.env.example 和 src/runtime.mjs，并核实当前应用实际数据库类型、函数入口、受保护管理入口、环境ID与资源额度。不要把“文件已写好”当作“已部署成功”。

如果数据库为 PostgreSQL：
1. 复用现有数据库，由管理员执行 feedback-cloud/sql/001-feedback.sql。
2. 使用专用服务端数据库登录角色，只授予 three_maps_feedback_backend；不要向 anon/authenticated 开放 feedback_private schema。
3. FEEDBACK_DATABASE_MODE=postgres，连接串放入服务端 FEEDBACK_POSTGRES_URL。URL不带查询参数；平台提供CA时使用 FEEDBACK_POSTGRES_CA；保持TLS证书校验。

如果实际为传统 CloudBase 文档库：
1. FEEDBACK_DATABASE_MODE=document。
2. 按 README 创建三集合、索引，逐集合应用 database.rules.json 中的客户端拒绝规则。
3. 不要为了套用文档库而更换现有PG应用。

部署现有后端，不改HTTP契约：
GET /feedback -> {items,nextCursor}
POST /feedback -> 201/200 {item}
GET /feedback/FB-UUID -> {item}
处理 OPTIONS 预检；输入、输出、枚举、幂等键、CORS和错误以 openapi.json 及 service.mjs 为准。

入口是 index.main 的 CloudBase 普通事件函数。如果平台入口不同，请先适配事件协议与平台可信来源，不绕过 TCB_SOURCE_IP 校验，不信任浏览器自填IP。限制客户端直接调用事件函数；不新增公开管理接口。

配置全部必需服务端变量；先验证管理权限、匿名数据库拒绝、网关路由与可信来源，再设置 MANAGEMENT_VERIFIED/GATEWAY_VERIFIED。缺配置应保持503，不用模拟数据或浏览器存储掩盖。

使用明确标记的测试反馈验证：A设备提交、B设备读取；同键重试不重复；管理员回复两端可见；隐藏后详情404；访客不能改状态或直接读写数据库；限流返回429及Retry-After。测试不算真实课程反馈。

通过云端验收后，向网站构建环境提供公开 API 基址及 NEXT_PUBLIC_FEEDBACK_SERVICE_VERIFIED=true。GitHub Actions使用同名仓库Variables。API基址不含/feedback；任何数据库凭据或哈希密钥都不进入NEXT_PUBLIC变量。重建静态网站，运行check、build、check:export和test，报告实际接口地址、完成项和仍未通过项。需要购买资源时先说明费用，不自动购买。
```

