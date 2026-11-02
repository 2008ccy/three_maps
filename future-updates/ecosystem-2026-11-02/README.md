# 生态地图：后续更新储备

归档日期：2026-11-02。本目录保存精简前的完整资料，不进入网站内容编译、搜索或主图。

本次从 **7主题、47条目、62关系** 收束为 **5主题、15条目、24关系**。保留并重写14个原条目，新增1个合并的“研究贡献”条目；其余33个原条目移出或合并。教学数据字符数由26,899降为8,015，约减少70%（按 lesson 对象序列化长度统计，不等同于屏幕字数）。

## 当前主图保留什么

| 主题 | 三个核心条目 |
| --- | --- |
| 模型与研究来源 | Qwen历史发布案例；研究贡献；模型卡、版本与获取 |
| 运行与工具 | Transformers/PEFT/TRL分工；自托管；托管API |
| 应用与资料 | 课程资料；应用交付；内容核实与维护责任 |
| 评测与验收 | 通用基准；评测框架；课程验收 |
| 反馈与维护 | 反馈修订；来源与版本维护；资源费用责任 |

## 储备内容与重新启用条件

| 储备专题 | 原节点 | 为什么暂时移出 | 适合何时更新 |
| --- | --- | --- | --- |
| 多模型团队比较 | deepseek-team、llama-team、glm-team、kimi-team | 入门只需一个发布案例解释角色；当前缺少同题选型结果 | 有明确课程任务、具体型号与可比记录后再增比较专题 |
| 独立作者与论文卡 | attention-authors、attention-paper、lora-authors、qlora-authors、lora-paper、rag-authors、rag-paper | 核心贡献已合并为research-origins，避免作者与论文分别占卡 | 需要深入原论文、复算或复现实验时展开 |
| 发布与分发细分 | publish-weights、distribution、distribute-weights、access-boundaries | 对象、版本、来源与条件已并入model-releases | 有一次真实下载与核对记录时展开 |
| 历史网络观测 | access-observation、access-validation | 旧访问自述不能代替当前验证，入门主线不需要逐条阅读 | 完成带时间、设备网络、目标与原始结果的新验证后更新 |
| 工具与交接细分 | transformers、peft、trl、load-adapt、maintenance-cost、eleuther、serve-model、application-tools | 核心分工合并到工具、运行、评测与应用条目 | 有具体环境、运行配置或失败记录后补实践专题 |
| 扩展信息入口 | stanford、ml-conferences、ai-language-conferences、journals、community-information | 从主线移出课程、会议与期刊目录，保留来源查证方法 | 有具体学习缺口、论文阅读任务或版本问题时选取 |
| 重复的成本与角色卡 | training-cost、distribution-cost、visitor-role | 成本责任与反馈角色已进入保留条目 | 有实际账单、工时或独立读者反馈后深化 |

这是资料储备，**不代表事实已核实、实践已完成或已经安排定时更新**。保留原记录的日期、范围与“待核实”状态。

## 文件清单

- `map-before.json`：精简前完整解析结果，含7主题、47条目、教学内容、来源、跨图链接、62条本图关系及旧分类。
- `manifest.json`：47个原条目逐项说明保留或合并情况、当前去向，以及旧地址映射。
- `content/`：精简前全部20份生态MDX正文及导航元数据，保留原文件名和层级。
- `sources-before.mdx`：当时全站来源目录快照，便于查回S/L编号。
- `source/`：精简前的ecosystem-learning.ts、ecosystem-base.ts及配套类型。它们是历史源码，不被当前网站导入。

原始素材仍保留在仓库原来的 `map__text/`，未在本次整理中删除或移动。

## 如何恢复为后续专题

1. 从manifest找到原节点及合并位置，再从map-before读取原文、关系与来源。
2. 明确这次新增要解决的学习问题，复核原始出处和适用日期；补上实际分析或实践记录。
3. 在当前 `website/src/lib/maps/ecosystem-learning.ts` 中新增或扩展内容，恢复需要的文档与关系。不要直接覆盖整张已精简的地图。
4. 若恢复原ID，先去掉该ID的nodeAliases映射，再更新旧文章的合并提示与searchable状态。
5. 写公开更新记录，运行内容、类型、静态构建、导出链接及测试，并检查新旧地址与跨图导航。

旧团队地址指向“模型与研究来源”主题，不会把其他团队重命名为Qwen；旧研究卡指向合并后的研究贡献。旧文章只保留简短迁移入口，并从全站搜索排除。
