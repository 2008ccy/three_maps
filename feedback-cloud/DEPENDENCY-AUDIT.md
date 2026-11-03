# 云函数依赖审计 · 2026-11-03

本次仅在本地安装、锁定并检查SDK依赖，没有创建、连接或部署云资源。

初始SDK3.18.3经`npm audit --json`报告5项问题：1项moderate、4项high。主要链路为：

- `@cloudbase/node-sdk → axios 0.27.2`，涉及请求配置/代理处理、SSRF、凭据泄漏和原型污染相关通告。
- `@cloudbase/node-sdk → @cloudbase/database 1.4.3 → lodash.set 4.3.2 / lodash.unset 4.5.2`，涉及原型污染。

只升级SDK补丁无法消除，因为SDK3.18.7仍声明axios0.27.2与database1.4.3；没有使用`npm audit fix --force`，也没有替换为数据库2.x或引入lodash shim。

采用并锁定的修复：

| 依赖 | 修复 |
| --- | --- |
| `@cloudbase/node-sdk` | 补丁更新至3.18.7 |
| SDK下的`@cloudbase/database` | 定向override至1.5.1，保持1.x接口，移除lodash.set/unset依赖 |
| SDK下的`axios` | 定向override至0.34.0，保持0.x接口 |

执行`npm install --ignore-scripts --package-lock-only`和`npm ci --ignore-scripts`后，`npm audit --json`为0项漏洞，依赖树确认实际安装版本与上表一致。这里的结果只是当前registry审计覆盖，不等于生产环境安全验收。

兼容性检查使用真实锁定SDK：数据库构造、`runTransaction`、文档get/set、筛选与游标查询均通过离线传输层测试；真实SDK返回的事务文档对象、非事务文档数组、序列化参数和事务回调结果均与适配器一致。业务测试另验证失败写入会连同限频与幂等索引一起回滚。

真实云环境中的数据库模式、权限、可信IP来源、事务冲突、复合索引及跨设备行为仍需按README验收；服务核验标记继续默认false。
