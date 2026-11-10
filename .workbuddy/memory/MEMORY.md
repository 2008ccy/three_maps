# 三张活地图 · 项目约定

## 发布规则（2026-11-10 用户确认，长期有效）

用户要求：**「就保持这个版本就行，我后续更新的话你直接按照上述要求同步发布即可。」**

后续每次用户说「更新网站 / 发布」时，按以下流程执行，无需再确认：

1. **不改源码。** 不以修复显示问题为由编辑 `website/src`、`website/content` 等源文件。只做同步、构建、发布。`git diff -- website` 必须为空。
2. **发布基准 = GitHub Pages 当前实际部署的版本。** 不是本地 HEAD。
   - 先用 `gh run list` 查最近几次 Actions 的 `conclusion`；只有 `success` 的提交才真正上了 Pages。
   - Pages 地址：https://2008ccy.github.io/three_maps/ （仓库 2008ccy/three_maps，Actions 失败时站点会静默停在旧版本）。
   - 取那个成功提交，用 `git worktree add --detach <tmp> <sha>` 检出构建，工作区源码零改动。
3. **验收标准：与 GitHub Pages 逐项一致。** 在 900 / 1080 / 1440 三个宽度下，比对各元素的 border 宽度、border-radius、padding-inline、带边框大元素数量、`scrollWidth` 是否溢出。必须完全相同。
   - 重点：首页 hero 不得被圆角边框卡片包裹（`2c5e3a9` 引入过 `border: 1px` + `border-radius: 14px`，用户明确不喜欢，已回滚到 `a4bdfe0`）。
4. **发布流程**：rsync/工作树 → `npm run check` → `npm run build` → `scripts/check-export.mjs` → `npm test` → `workbuddy_sites_deploy`（appId `wbapp_pKlQiFEGLYBr7gJ1WeGUQW`，domainPrefix `three-maps`，static，entryHtml index.html）。
   - 构建需带 `website/.env.local`（含云端 endpoint 与 key），否则反馈功能失效。
   - 后端测试缺 `node_modules`（pglite）会报 2 项失败，软链 `feedback-cloud/node_modules` 后即 27/27。
5. **发布后必做**：把 `.wbapp_pKlQiFEGLYBr7gJ1WeGUQW.genie` 的 `localDir` 改回 `website/out`（发布工具会写成临时目录）；线上核对 7 个页面 200、无 4xx/5xx、无 JS 报错、反馈 `list_feedback` 正常。

## 固定信息

- 分享链接必须带 `?sharecode=G53JT22DQM`，否则显示「链接不完整」。
- 线上地址：https://three-maps-02432.app.workbuddy.host
- 反馈走 WorkBuddy 云数据库 `/.cloud/database/rest`，浏览器内调 rpc（`list_feedback` / `get_feedback` / `submit_feedback`）。**curl 直调返回 401 `invalid_client` 属正常**，publishable key 只认 SDK 请求特征 + 精确 Origin，必须用浏览器验证。
- 反馈表 `public.feedback`；测试数据用完要删，公开板不要留「发布验证」字样。
