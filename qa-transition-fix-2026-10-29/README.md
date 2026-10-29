# 首页转场提前消失修复 · 2026-10-29

## 原因与修复

部署前缀为 `/three_maps` 时，浏览器地址是 `/three_maps/docs/domain/`，Next.js 的 `usePathname()` 却返回 `/docs/domain/`。旧转场守卫把路由路径再次按完整前缀校验，误认成离开地图，调用 `finish()`，取消正在进行的标题接续。

实际根路径基线可以完整播放；子路径基线在约 178ms 已直接变回 idle，没有 arriving 样本，也没有结束后的标题焦点。此问题与粒子数量、可见性或删除特效代码无关。

新增仅用于生命周期判断的 `isTransitionPage`：兼容 Next 路由路径及浏览器完整路径；原始链接验证 `mapAtPath` 保持严格，仍拒绝前缀不匹配的链接。非首页/三图路由继续取消动画。不改变配色、像素、时长、布局或返回节奏，不引入依赖。

## 验证

- 默认路径与 `/three_maps` 各执行静态构建、63 项测试、导出链接检查，均通过：73 HTML、3842 个站内链接、锚点与资源。默认路径另执行内容、类型检查通过。
- 新增回归覆盖三图的 Next 路径与浏览器路径、根路径部署、首页、无尾斜杠、错误前缀和正文/来源/项目等非转场页面；保持链接校验严格。
- 修复后子路径领域卡片实际录制：departing → arriving → idle，约 164ms 进入接续、663ms 样本完成并聚焦 map-title；标题从入口位置连续移动到 H1。此前 178ms 已取消。
- 子路径顶部“生态”用 Enter 激活，覆盖 departing / waiting / arriving / idle，完成聚焦 map-title。390×844 认知卡片同样播放完成、标题聚焦、无横向页面溢出。
- 返回首页仍使用 40ms + 220ms 原预算，实际完成后焦点返回领域入口，无残留快照或操作锁。
- 最终根路径认知卡片完成全部阶段，结束聚焦 map-title；子路径浏览器 warn / error 为空。
- 保留修饰键、Canvas 不可用、减少动效、无脚本的原生导航分支；本轮未重新注入这些故障或更改系统设置，不声称已做完整屏幕阅读器和帧率测量。

## 证据

- `base-before-states.json` / `base-before-*.png`：修复前子路径实际录制。
- `base-after-states.json` / `base-after-*.png`：修复后子路径实际录制。
- `before-states.json`：默认路径原本可播放的基线。
- `header-after-states.json`、`mobile-after-states.json`、`root-after-states.json`、`return-states.json`：键盘、窄屏、根路径和返回证据。
- [修复前动图](before-subpath.gif)、[修复后动图](fixed-subpath.gif)、[窄屏动图](fixed-mobile.gif)。动图以真实截图与采样时间合成；桌面等比例缩到 960×540，窄屏保持原尺寸，没有插帧。首帧增加 450ms、尾帧停留 650ms 便于查看，循环不代表网页重复播放，也不代表实际帧率。

本地正式预览保留在 <http://127.0.0.1:4173/>；临时子路径服务检查后关闭。没有发布、推送或删除文件。
