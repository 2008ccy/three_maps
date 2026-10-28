# 像素帷幕验收证据

- `pixel-curtain-preview.gif`：最终生产构建的真实桌面截图序列；源图为 `delivery-00.png` 至 `delivery-23.png`，1440×900，展示缩至 960×600。每帧原始时间见 `delivery-frame-times.json`。首尾添加阅读停留，循环回首帧是演示行为，不代表网页循环或实际帧率。
- `pixel-curtain-mobile.gif`：390×844 实际窄屏截图序列；源图与时间为 `mobile-*.png`、`mobile-frame-times.json`，保留原尺寸；同样添加首尾停留。
- `delivery-*` 为最终版桌面证据；`desktop-*`、`final-desktop-*`、`eco-*` 保留早期检查记录，不作为最终版时序测量。
- `slow-*` 记录临时服务对资料请求注入 650ms 延迟时的等待遮幕；`09-slow-complete.png` 为完成状态。`10-timeout-fallback.png` 为 8 秒请求延迟触发 1.5 秒普通导航回退后的可用页面。
- `07-reduced-motion.png`、`08-canvas-fallback.png`、`11-no-js-domain.png` 分别为模拟减少动态效果、模拟 Canvas 不可用、sandbox 实际禁用脚本后通过原生链接进入领域地图。
- `12-basepath-domain.png` 来自临时目录独立构建的 `/three_maps/` 子路径。
- 1920×1080 视口截图工具实际输出 1920×1068，不拉伸；DOM 尺寸及入口位置另行检查。没有进行真实手机设备、屏幕阅读器全流程或长期性能测量。
