# 连续名称交接验收

最终效果：入口名称持续可见并过渡到真实标题；实际首页内容与目标正文短暂交叠，导航独立固定。没有新加全屏遮幕；主体配色不变。进入名义 80+480ms，返回保持 40+220ms，另加路由就绪时间。

## 证据

- continuous-title-roundtrip.gif：最终代码真实录制的进入生态、返回主页，1440×900 缩至 960×600。按原始时间间隔拼接，首尾及段间增加停留，不插帧。截图采样包含工具开销，phase 在截图后读取，不应视为精确网页帧率或性能测量。
- final-enter-* / final-back-*：最终桌面序列和时间 JSON。最后版本导航副本关闭背景折射，采样中导航顶部 0、站点标识顶部 16。
- mobile-*：390×844 认知地图进入过程，无横向页面溢出；键盘返回焦点恢复认知入口。最终小补丁仅关闭导航副本背景折射，不改移动端几何与交接时序。
- home-final-1440.png、ecosystem-final-1440.png、domain-final-1366.png、cognition-final-1920.png：关键完成状态。1920 视口截图实际输出 1920×1068，没有拉伸。
- snapshot-fallback.png、reduced-fallback.png、canvas-fallback.png、timeout-fallback.png：临时服务故障模拟完成结果。slow-* 与 slow-states.json：650ms 资料请求延迟时来源画面/名称保持可见，slow-complete.png 为完成状态。
- enter-*、domain-complete-1440.png、ecosystem-complete-1440.png 属于初稿，不用作最终动图；保留追溯，没有删除文件。

内容/类型检查、生产构建、56 项测试、73 HTML 与 3586 链接/资源检查通过。没有自动发布，未测试真实手机设备或长期性能。
