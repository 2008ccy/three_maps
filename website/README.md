# 三张活地图网站 · 维护说明

本目录是独立的 Fumadocs + Next.js + TypeScript 项目。正文在 Markdown/MDX 文件中，构建后由 GitHub Pages 提供静态页面。使用系统字体、本地图片及本地搜索索引，浏览不需要登录或模型密钥。

## 1. 运行和预览

推荐 Node.js 24 LTS，使用项目内的 `package-lock.json` 固定依赖版本。

```sh
cd website
npm ci
npm run dev
```

开发地址通常是 `http://127.0.0.1:3000`。若端口占用，按终端实际显示的地址访问。

生产静态预览：

```sh
npm run check
npm run build
npm run check:export
npm test
npm run preview
```

验证 GitHub Pages 子路径（macOS/Linux）：

```sh
NEXT_PUBLIC_BASE_PATH=/three_maps npm run build
npm run check:export
npm test
npm run preview
```

PowerShell 可先执行 `$env:NEXT_PUBLIC_BASE_PATH="/three_maps"`，再执行 `npm run build`。预览服务器读取本次构建的路径配置，会打印准确地址；默认 3000 端口，`PORT=3001 npm run preview` 可换端口。

当前显式采用 Next.js Webpack 构建，以兼容本机受限环境；不需要自行安装独立服务器。`out/` 是生成物，不直接修改或提交。

## 2. 文件分工

| 目录 | 维护内容 |
| --- | --- |
| `content/docs/domain` | 领域主题，`entries` 存概念与工具详情 |
| `content/docs/ecosystem` | 生态主题，`entries` 存团队、平台与社区详情 |
| `content/docs/cognition` | 认识方法、三个案例、习惯与修正 |
| `content/docs/sources` | 全站共用的来源编号和链接 |
| `content/docs/project` | 跨图探索、进度、更新、待补问题、作业覆盖与阶段安排 |
| `src/components` | 搜索、关联卡片、内容渲染、中文界面 |
| `src/app` | 首页、文档布局、静态搜索导出 |
| `public/images/domain` | 从原素材复制的网站图片，原文件保留 |
| `scripts` | 内容检查、导出检查、搜索与关联测试、静态预览 |

网站正文是今后唯一需要日常编辑的展示内容。`../map__text` 是原始素材和首次整合底稿，修改它不会自动更新网站，避免误覆盖已整理页面。

## 3. 修改或新增一篇内容

### 首页外观与探索路线

首页主框、三图分支和滚动探索的样式独立放在 `src/app/(home)/home.module.css`，不会修改文档页外观。文件顶部是统一调节区：

| 参数 | 调整内容 |
| --- | --- |
| `--home-frame-width`、`--home-frame-radius` | 主框宽度、圆角 |
| `--home-frame-border-width`、`--home-frame-border` | 边框粗细、颜色 |
| `--home-frame-background`、`--home-frame-glow` | 背景、光晕（设为 `none` 可关闭光晕） |
| `--home-frame-padding` 及 `-compact`、`-mobile` | 常规、较矮电脑窗口、手机的内边距 |
| `--home-branch-gap`、`--home-branch-gap-compact` | 主框到左右地图的距离，保持大于 `22px` |
| `--home-branch-width`、`--home-branch-color` | 连线粗细、颜色 |
| `--home-card-width`、`--home-card-radius` | 地图卡片宽度、圆角 |
| `--home-enter-duration`、`--home-reveal-duration` | 首次进入、下滑渐显的动画时长 |
| `--home-cue-pulse-duration`、`--home-cue-glow` | 下滑提示的闪光周期、光晕颜色及强度 |

地图文案、入口和三条探索路线集中在 `src/app/(home)/home-content.ts`，主标题在同目录 `page.tsx`。更换标题或增大框的间距后，检查 1280×720 电脑和 375×667 手机首屏；极矮窗口或放大文字时内容会自然延展。系统开启“减少动态效果”后直接显示全部内容，下滑提示保持静态发光；关闭 JavaScript 后仍可使用普通链接。

全站固定使用夜间配色，导航和文档页均不显示主题切换，主题快捷键也已关闭。历史浅色偏好或系统外观不会覆盖夜间配色，静态 HTML 从首帧开始就是深色。

### 文档正文

普通段落、列表、表格按 Markdown 写。文件后缀为 `.mdx`，只有使用卡片等交互组件时才需要 JSX。

新条目示例：在适合的地图目录中创建文件，替换以下内容。

```mdx
---
id: "K-NEW-CONCEPT"
title: "新概念"
description: "用一句话解释它的作用。"
updated: "2026-10-26"
status: "资料整理 · 理解程度待自评"
related: ["K-RAG", "C-RANKING"]
---

## 它是什么

解释概念，标清适用条件。依据见 [S02](ref:S02)。

## 与什么相关

它与 [RAG](node:K-RAG) 的关系是……

## 还不知道什么

列出缺少的证据，不把计划写成结果。
```

- `id` 全站唯一，建立后保持稳定。改标题不改 ID；移动文件后，`node:` 链接会自动找到新地址。
- `updated` 使用带引号的日期字符串，改内容时同步改日期。
- `status` 说明材料或实践状态；`related` 保留内容关联元数据，正文底部不再自动追加关联卡片。图内跨图关系由导图配置维护。
- 在同目录 `meta.json` 的 `pages` 数组中加入文件名（不带 `.mdx`）。顺序用于页面树与面包屑；`index` 是目录首页。侧边栏固定显示总览及五个顶层栏目，子页面通过导图、首页任务路线或搜索进入。
- 三张地图总览使用可展开导图，结构维护见下面“导图维护”；文档页的 `<NodeGrid ids={["D-TASK", "D-PIPELINE"]} />` 当前只展示条目名称和说明，不提供跳转。
- 使用二级标题 `##`，Fumadocs 自动生成本页目录和小节链接。

也可点击页面上的“编辑本页”进入 GitHub 编辑器。建议通过分支和 Pull Request 修改，检查通过再合并；合并到 main 后自动重建。

## 4. 来源、图片和公式

**来源：** 在 `sources/index.mdx` 新增 `## S22` 等唯一标题，写明原始入口、支持内容、版本/日期及局限。正文使用 `[S22](ref:S22)`。不要仅列论文名而不说明它支持什么。L1—L5 指向仓库原素材。

L6 是浙大版讲解稿，归档 PDF 放在 `public/sources/ai-model-building-zju.pdf`，知识树原图在 `public/images/domain/zju-knowledge-tree.png`。学校课程信息来自讲解稿转述，正式培养方案原件仍待核验。更新归档材料时同步 `map__text` 与网站副本。

L7 是用户提供的 `认知地图关系图.html`，原件归档于 `map__text`，网站在 `public/sources/cognition-relationships.txt` 提供原始 HTML 文本。认知地图按其中的四条主干、三个方法组合及三个案例组织；六类习惯与四个修正问题沿用原有素材展开。

**关系：** 正文使用 `[显示名称](node:稳定ID)`，例如 `[LoRA](node:K-LORA)`；不要手写完整域名或 `/three_maps`，避免更换部署地址后失效。普通站内链接使用 `/docs/...`。

完整文章当前暂时停用跨文章跳转：`ArticleLink` 将指向其他文章的链接渲染为普通文字，`NodeGrid` 以 `linked={false}` 渲染静态条目。来源引用、外部依据、页内锚点及返回地图仍可操作，原始 Markdown 关系保留，方便后续恢复。

**图片：** 放入 `public/images`，正文使用 `![描述](/images/文件名.png)`。路径前缀由组件处理；点击图片可看原图。

**公式：** 行内用 `$...$`，独立公式用 `$$...$$`。KaTeX 在构建时渲染，字体随静态资源提供。MDX 中普通文本的花括号需要转义；公式放进数学标记内。

## 5. 每周更新

在 `project/updates.mdx` 顶部增加记录：日期、对象、依据、修改、原因、执行与复核人、尚未解决的问题。没有内容变化也记录检查结果。

在 `project/gaps.mdx` 和 `project/coverage.mdx` 对照作业逐项复核。缺课堂原文、学校课程大纲、实验附件或成员确认的项目，保留“待补证”。登录、反馈和地图 AI 的当前状态在 `project/status.mdx` 中说明。

## 6. GitHub Pages 部署

默认仓库为 `2008ccy/three_maps`，目标地址为 `https://2008ccy.github.io/three_maps/`。该地址仅是配置目标，不表示已经上线。

1. 将网站文件与根目录 `.github/workflows/website.yml` 推送到仓库。
2. 在仓库 Settings → Pages → Build and deployment 中选择 **GitHub Actions**。
3. 工作流会安装依赖、检查内容和类型、构建、检查导出链接、运行搜索与跨图测试；全部通过后发布。
4. 首次发布后直接打开一个详情地址并刷新，验证图片和搜索；再用校园网及移动网络进行独立访问验证。

Pull Request 只检查和构建，不部署。构建或测试失败时不会触发发布，已上线版本保持不变。可恢复上一条已知可用提交再重新运行工作流回滚。若更换仓库名或使用根域名，调整工作流中的 `NEXT_PUBLIC_BASE_PATH`，并同步 `src/lib/shared.ts` 的 GitHub 编辑入口。

GitHub Pages 只负责静态页面。后续 AI 接入需要额外服务端，密钥不能写入正文、浏览器代码或 `NEXT_PUBLIC_*` 变量。反馈可另接 GitHub Discussions/giscus 或独立服务，本版没有预装登录或评论占位按钮。

## 7. 检查项与已知边界

- `npm run check:content`：必填元数据、唯一 ID、关联、来源、图片和目录引用。
- `npm run types:check`：路由类型和 TypeScript。
- `npm run check:export`：实际导出的全部 HTML、站内链接、锚点、脚本及样式资源，包含部署前缀。
- `npm test`：读取导出的搜索索引、HTML 和导图配置，验证搜索、跨图路径、公式、节点引用与来源、锚点恢复、分支切换、无 JavaScript 层级入口以及课程同步。
- 浏览器人工验收：手机与桌面布局、鼠标导航、搜索结果点击、目录、夜间配色和长表格。

搜索索引在构建时生成，首次搜索会下载索引，以后在浏览器内查询。构建和查询必须使用相同的 CJK 编码器，统一维护 `src/lib/static-search.mjs`。内容较多时再评估搜索服务。

完整作业还需要真实 AI、实验/分析证据、三名非组员反馈和上线后的国内网络验证。本次不代填这些结果。

## 8. 导图维护

- `src/lib/maps/content.ts` 集中维护三张图。每个节点有独立 ID、标题、解释、使用边界、正文 ID、来源和可选子节点；嵌套关系表示内容归属。不要根据技术名称自动推断依赖。
- 节点 ID 决定分享地址，例如 `/docs/domain/#node-rag`。修改标题时保持 ID 稳定；同层只展开一个分支，深层节点会恢复完整祖先路径。
- `documents` 用现有正文 ID 查找网址，可加 `anchor` 定位小节；一个节点可对应多篇正文，一篇正文也可被多个节点引用。
- `relations` 指向目标地图及节点，`label` 明确说明“提出”“实现”“用于评测”等关系。每个目标都会在构建与测试中核验。
- `connections` 表示树形归属以外的有向关系，配置来源节点、目标节点和关系名称。认知图用它显示“指导选方法”“跑过后修正”“反哺习惯”的虚线闭环；点击端点可定位分支或打开要点，节点详情也可跳到同图分支。
- `src/components/maps/maps.module.css` 顶部是中心框宽度、圆角、背景、光晕、分支间距、侧栏宽度、平移距离和动画时长等中文注释变量。桌面要点继承所属主干的左右方向，在同侧打开覆盖式阅读侧栏；地图保持原有宽度、节点大小和间距，向侧栏的反方向平移，保留选中一侧，允许另一侧移出画布。默认平移距离为侧栏宽度加间隔，确保选中分支不被侧栏遮挡；不产生横向滚动。导航与页尾为侧栏让位，关闭后地图回到居中位置。移动端用纵向分支，1100px 及以下用底部阅读抽屉；减弱动画设置会禁用渐显和位移。
- `src/components/maps/map-explorer.tsx` 负责展开、焦点、连接线和阅读面板；`src/lib/maps/state.ts` 保存可独立测试的状态转换。没有 JavaScript 时，同一份内容通过原生 `details` 展开，正文与来源仍可访问。
- 正文底部显示返回所属地图的按钮，不再显示上一篇、下一篇或自动关联条目；项目、来源等公共页面返回首页。目录中的“返回上页”使用已记录的站内历史，能回到之前展开的地图节点；直接进入正文、无有效站内历史时返回所属地图，公共页面返回首页，避免跳到空白页或站外页面。
- 三个总览由 `src/app/(maps)/docs/` 下的固定路由生成；其余正文位于 `src/app/(content)/docs/`。正文的 `generateStaticParams` 排除三张总览，防止静态导出重复。内容目录的三份 `index.mdx` 仍提供搜索摘要和页面树信息。
