# 方案 09 首页及三图样式统一 · 2026-11-05

参考：`../design-previews-2026-11-04/09-active-theory-particles.png` 和第 9 方案 v3 动图。

首页采用左侧标题、右侧金/青/珍珠白三层粒子曲面、底部三个地图入口。首页入口与导航首次渲染即可使用。粒子使用本地原图纹理、小网格局部位移与 GPU 采样；沿用 v3 的不规则流动幅度，标注与引线固定。未增加运行依赖。

三图统一深墨蓝底色、暖白文字、灰蓝细分隔线及金/青/珍珠白强调色。主题、知识正文、关系图、搜索筛选、普通文章与更新页面保持统一。地图数据和已有教学内容未改动。

## 验证

- `npm run check`：内容目录、反馈目标、TypeScript 和后端语法通过。
- `npm run build`：74 个静态页面构建成功。
- `npm run check:export`：3237 处站内链接与资源通过。
- 前端静态/功能单元测试 90 项、云端测试 21 项全部通过。
- 桌面 1440×900、1366×768，手机 390×844 与 650px 宽度无横向溢出。
- 首页实时粒子可见；减少动态效果时画面静止。
- 搜索 RAG 实际返回领域、生态和认知等现有内容。
- 首页分别进入三图、返回首页，标题与入口焦点恢复正常。
- 强制 WebGL 不可用：静态 SVG 曲面保留；导航快照的 SVG mask/filter 引用全部指向快照内的新 ID。
- 禁用 JavaScript：首页三图链接仍可直接进入静态地图。
- 三图总览、主题、知识点、关系图与图节点操作，桌面/手机共 21 张截图，无页面或 HTTP 错误。详见 `maps/README.md`。

## 文件

- `home-desktop.png`、`home-laptop.png`：实际生产首页截图。
- `home-mobile-viewport.png`、`home-mobile.png`：手机首屏与整页。
- `home-motion-a.png`、`home-motion-b.png`：相隔 1.2 秒的流动画面。
- `home-search.png`：实际搜索结果。
- `home-no-webgl.png`、`home-no-js.png`：降级场景。
- `updates-unified.png`：更新页面统一样式。
- `home-report.json`、`navigation-report.json`：浏览器检查记录。
- `maps/`：三图截图及检查记录。

本地静态预览：`http://127.0.0.1:3000/`。未推送或发布。
