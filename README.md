# 三张活地图 · 模型构建

围绕“从预训练模型到领域助手——语言模型的数据、微调、评测与部署”，以课程答疑助手为典型任务，连接领域知识、参与者与认识方法。

## 现在可以使用什么

`website/` 已提供 Fumadocs 网站：三张地图、68 个内容页面、33 个核心条目、跨图链接、中文搜索、公式与图示、来源目录、更新记录和待核实清单。

网站已提供免登录的公开反馈表单、内容预览、处理进度和反馈编号入口；当前使用 WorkBuddy 托管数据库，接入与管理说明见 [反馈接入说明](feedback-cloud/WORKBUDDY-CLOUD.md)。本地已配置云服务，2026-11-06 只读验证列表和已有详情可用；本轮未提交反馈，写入、跨设备与管理权限仍需实际验收。用户登录和地图 AI 继续暂缓。网站构建配置不等于已经公开上线，国内普通网络可达性仍须上线后验证。

## 在 Mac 上编辑卡片学习状态

在访达中双击项目根目录的 **地图卡片.app**（Apple Silicon，macOS 14 及以上），首次选择本项目文件夹。按 ⌘F 搜索标题或节点 ID，选中一张或多张卡片后点击状态即可保存。⌘1 至 ⌘4 对应窗口底部四种状态，⌘Z 撤销最近一次操作。可用 ⌘O 切换项目，⌘R 重新载入。

应用离线读取 `website/card-editor/manifest.json`，将修改保存至 `website/card-editor/overrides.json`。刷新网站开发预览即可查看结果，提交状态文件后随正常网站流程发布。更改地图条目或资料中的初始状态后，在 `website` 下运行 `npm run cards:sync` 更新清单。若要重新构建应用，在装有 Apple Command Line Tools 的这台 Mac 上运行 `./macos/build.sh`。

## 本地启动

需要 Node.js 24 LTS 和 npm，在终端运行：

```sh
cd website
npm ci
npm run dev
```

打开终端显示的本地地址。内容编辑保存后可在开发预览中查看；生产静态预览与 GitHub Pages 部署步骤见 [网站维护说明](website/README.md)。

## 文件在哪里

| 位置 | 用途 |
| --- | --- |
| [website](website/README.md) | 可运行网站、检查脚本与维护说明 |
| [website/content/docs/domain](website/content/docs/domain/index.mdx) | 领域地图正文 |
| [website/content/docs/ecosystem](website/content/docs/ecosystem/index.mdx) | 生态地图正文 |
| [website/content/docs/cognition](website/content/docs/cognition/index.mdx) | 认知地图正文 |
| [map__text](map__text/三张活地图_作业整合稿.md) | 原始素材、图片与首次整合底稿 |
| [作业要求整理](三张活地图作业要求与网站实现整理.md) | 作业范围和最终验收标准 |
| [原建设计划](模型构建主题_网站建设与云端上线计划.md) | 早期完整后端与云服务器设想，属于长期参考，非第一版运行配置 |

后续网站内容统一在 `website/content/docs` 维护；原素材继续保留用于追溯，不自动覆盖网站正文。推送到 main 后，配置好的 GitHub Actions 会检查并构建；仓库启用 Pages 的 GitHub Actions 发布源后即可部署。

## 内容边界

保留事实、分析判断、素材自述与待补证的区分。本校课程、课堂第三个观、实际实验、成员贡献及三名非组员反馈仍需真实依据；不能因为网站已经实现就将完整作业清单全部勾选。
