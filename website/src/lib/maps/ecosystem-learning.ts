import type { ConceptRelation, LegacyCollection, MapDefinition, MapNode, NodeLesson, TopicLesson } from './types';

// 主图只保留解释课程助手协作链所需的15个条目。
// 精简前的完整内容、来源和恢复清单位于 future-updates/ecosystem-2026-11-02/。
const nodes: Record<string, MapNode> = {};
function point(id: string, title: string, type: string, documents: string[], sources: string[], lesson: NodeLesson, relations: MapNode['relations'] = []) {
  nodes[id] = { id, title, type, summary: lesson.explanation[0], detail: lesson.explanation[0],
    documents: documents.map((id) => ({ id })), sources, lesson, relations,
    understanding: '待自评', verification: '待核实' };
}
const example = (input: string, steps: string[], output: string): NodeLesson['example'] => ({ input, steps, output, materials: [] });

point('qwen', '模型发布方：Qwen 案例', '参与者', ['E-QWEN'], ['S11'], {
  role: '提供已有模型', goal: '说清模型发布方交付什么，以及使用者仍负责什么。',
  explanation: ['以 Qwen2.5 的历史发布为例：模型团队提供模型说明、权重入口与技术资料，课程项目据此选择已有模型。', '发布方负责说明成果，课程项目负责选择具体对象、核对使用条件并验证课程任务。选定型号与实际结果仍需本组记录。'],
  example: example('要为课程助手选择一个已有模型。', ['从 Qwen2.5 官方发布页找到一个具体模型的入口。', '记录完整型号、版本和对应模型卡。', '把课程解释、引用和无答案处理列为本组验收项。'], '得到“发布方 → 具体模型 → 本组验收”的责任划分。此处是历史查证练习，不是型号推荐。'),
  confusions: ['团队名称不能替代模型版本。', '发布方的通用实验与本课程的答疑验收需要分别记录。'],
  check: { question: '模型团队与课程项目各应交付什么？', answer: '模型团队交付可定位的模型及说明；课程项目交付具体选型、使用条件记录和课程问题的验证结果。' },
  advanced: [{ title: '历史查证入口', paragraphs: ['Qwen2.5 官方发布：https://qwenlm.github.io/blog/qwen2.5/；可点击来源 S11 回查。本主图用一家发布方解释角色，其他团队的原卡片已保存为后续更新储备。'] }],
}, [{ map: 'domain', node: 'pretraining', label: '发布可复用的预训练模型' }]);

point('research-origins', '研究贡献：结构、RAG 与 LoRA', '成果与资料', ['E-ATTN', 'E-RAG', 'E-LORA', 'E-QLORA'], ['S01', 'S02', 'S03', 'S04'], {
  role: '追溯方法来处', goal: '把方法、论文贡献和工程实现分别对应起来。',
  explanation: ['研究者通过论文交付方法与实验依据。Transformer 结构、RAG 的检索生成思路、LoRA 的低秩适配，各自解决不同问题。', '项目通过工具复用方法，并用自己的资料与问题检查效果。论文、工具和课程应用属于不同层次的成果。'],
  example: example('课程助手需要引用资料，并可能调整回答行为。', ['把外部资料的使用对应到 RAG 思路。', '把低秩参数更新对应到 LoRA，把量化基座适配对应到 QLoRA。', '在来源中核对论文，再到工具文档查具体实现。'], '得到“研究贡献 → 工具实现 → 课程验证”的三层记录。'),
  confusions: ['研究方法的提出者与模型发布方可能不同。', '论文实验结果必须保留原任务和设置。'],
  check: { question: '“Hu 等提出 LoRA，PEFT 提供实现，本组检验答疑效果”分别属于哪三层？', answer: '依次是研究贡献、工程实现和任务验证；不能将其中一层的完成情况代替另一层。' },
  advanced: [{ title: '四项研究贡献', table: { headers: ['研究入口', '主要贡献', '来源'], rows: [['Vaswani 等 · Transformer', '用注意力等模块组织序列计算', 'S01'], ['Lewis 等 · RAG', '将检索与生成结合的研究设计', 'S02'], ['Hu 等 · LoRA', '低秩增量适配', 'S03'], ['Dettmers 等 · QLoRA', '量化基座上的低秩适配', 'S04']] } }],
}, [{ map: 'domain', node: 'attention', label: '追溯注意力与结构背景' }, { map: 'domain', node: 'rag', label: '追溯检索增强思路' }, { map: 'domain', node: 'lora', label: '追溯低秩适配方法' }]);

point('model-releases', '模型卡、版本与获取', '成果与资料', ['E-RESOURCES', 'E-DISTRIBUTION', 'E-ACCESS'], ['S11', 'L8'], {
  role: '明确复用对象', goal: '写出一条别人能准确找到的模型记录。',
  explanation: ['模型交接至少保留完整名称、版本或 revision、官方来源与使用条件。模型卡帮助读懂具体对象，托管平台提供获取入口。', '自行运行要核对权重文件与配置；托管调用要记录服务的模型标识。代码、权重、资料和服务的条件分别查证。'],
  example: example('记录中只有“上周下载的 Qwen”。', ['补上具体模型与 revision。', '记录发布者、实际渠道和文件核对结果；服务路线改记模型标识。', '为拟进行的使用找到对应条件。'], '形成“对象｜版本｜入口｜条件”的四项记录。实际取值由所选发布物确定。'),
  confusions: ['Hugging Face、ModelScope 等托管入口与模型发布者身份需要分开。', '网页能打开、完整下载和接口成功是三种检查。'],
  check: { question: '要让同学复查你拿到的模型，最少补哪四类信息？', answer: '具体对象、版本、来源或渠道、对应使用条件；自行下载还应保存文件核对结果。' },
});

point('huggingface', '工具协作：Transformers、PEFT、TRL', '工具', ['E-HF'], ['S05', 'S06', 'S07', 'S26'], {
  role: '连接方法与运行', goal: '为加载、适配和训练流程分别找到工具职责。',
  explanation: ['Hugging Face 与社区贡献者提供模型生态中的工具。Transformers 提供模型与分词器的加载、生成接口，PEFT 提供 LoRA 等适配实现，TRL 的 SFTTrainer 组织监督微调流程。', '课程项目可以先使用已有模型；有明确行为问题、合格样本和评测后再决定是否适配。工具选择要对应具体模型和版本。'],
  example: example('需要先运行模型，再判断是否微调。', ['用加载工具核对模型、分词器和模板。', '记录已有模型在固定问题上的表现。', '若需要 SFT，将训练流程交给相应工具，参数更新方案单独选择。'], '得到三项分工：加载接口、参数更新、训练流程；微调仍是按需选择。'),
  confusions: ['SFT 是训练任务，LoRA 是更新方法，PEFT 与 TRL 是工具。', '模型出现在托管平台，不代表所有工具都已兼容它。'],
  check: { question: '已有模型能正常答疑，只为“用上完整技术栈”就加一次微调，合理吗？', answer: '先检查是否存在稳定的行为问题。没有明确问题与比较标准时，增加训练只会增加工作，无法解释收益。' },
}, [{ map: 'domain', node: 'inference', label: '支持已有模型的运行' }, { map: 'domain', node: 'lora', label: 'PEFT 提供适配实现' }, { map: 'domain', node: 'finetuning', label: 'TRL 可组织监督微调' }]);

point('inference-tools', '自托管推理', '工具', ['E-DEPLOY'], ['S10', 'S27', 'S28'], {
  role: '自己运行模型', goal: '列出自托管者承担的三项责任。',
  explanation: ['vLLM、Ollama、llama.cpp 等工具提供模型运行入口。自托管者需要选择匹配的格式和后端，并准备设备、运行环境与服务。', '本组承担资源配置、异常处理和版本维护。工具的具体支持范围应查采用版本的文档，再在实际设备上验证。'],
  example: example('课程项目考虑在自己的设备上运行模型。', ['确认权重格式、设备和工具版本。', '记录单次请求及失败信息。', '按预期使用人数检查响应、资源和维护需求。'], '得到自托管路线的责任清单：设备、运行与维护。这里没有性能实测结论。'),
  confusions: ['权重可获取不代表设备一定足够。', '单次对话成功与持续提供多人服务不同。'],
  check: { question: '设备由本组维护时，哪些工作不能交给模型发布方？', answer: '本组设备上的加载、容量与并发检查、异常处理、升级和运行维护。' },
}, [{ map: 'domain', node: 'deployment', label: '提供自行部署的运行入口' }]);

point('api-platforms', '托管模型 API', '参与者', ['E-API'], ['S21', 'L8'], {
  role: '使用外部推理服务', goal: '说清供应方与应用方的责任边界。',
  explanation: ['托管服务由供应方运行模型，应用通过 API 提交请求、接收结果。使用者需要记录服务、模型标识、接口条件与用量。', '应用方仍负责课程资料、提示、引用展示、失败处理和预算。选择 API 可以省去本地权重运行，但会增加服务与网络依赖。'],
  example: example('课程助手拟调用一项托管服务。', ['登记服务地址、模型标识和使用条件。', '规定请求、返回、超时和用量的记录字段。', '用固定课程问题检查内容及引用。'], '形成服务接入清单；实际供应方、调用结果与费用待项目选择和验证。'),
  confusions: ['取得调用权与取得模型权重不同。', '控制台可达与目标模型调用成功不同。'],
  check: { question: '供应方返回了流畅答案，应用方还要验收什么？', answer: '是否正确解释课程问题、资料能否支持结论、引用是否可回查，以及异常与用量是否符合约定。' },
}, [{ map: 'domain', node: 'deployment', label: '提供托管推理路线' }, { map: 'cognition', node: 'cost-api', label: '结合效果与成本选择路线' }]);

point('course-data', '课程资料与授权', '成果与资料', ['E-APP'], ['L3', 'L8'], {
  role: '提供任务依据', goal: '为课程资料保留可追溯的出处与使用范围。',
  explanation: ['课程资料由作者、教师或其他权利人提供，项目负责确认允许的用途，再整理为可以定位的片段。每段内容都应能回到原文。', '资料记录至少包含来源、版本、页码或章节，以及使用范围。用于训练和用于检索的材料应分别考虑用途，测试问题也需与训练切分。'],
  example: example('将一段获准使用的课程材料交给检索环节。', ['登记作者、出处与使用范围。', '保留版本和页码，给片段一个稳定编号。', '检查解析是否保留公式、条件与否定词。'], '得到带出处的资料片段，可作为回答和引用的依据。示例未声称已取得真实课件授权。'),
  confusions: ['可以访问资料与可以公开分发资料不同。', '原始讲义与已经设计好的测试集不同。'],
  check: { question: '片段文字正确，但没有页码与出处，会给下游带来什么问题？', answer: '回答中的引用难以回到原文，版本变化和内容争议也更难核查。' },
}, [{ map: 'domain', node: 'collection', label: '约束资料采集与出处记录' }]);

point('build-application', '应用集成与交付', '协作环节', ['E-COLLABORATION', 'E-APP'], ['S02', 'L8'], {
  role: '把各方成果接成答疑流程', goal: '画出问题到可核对回答的五个环节。',
  explanation: ['应用团队连接课程资料、检索、模型接口和阅读界面，交付回答与引用。工具可以辅助流程编排，应用仍要保证各环节的输入输出能衔接。', '最小链路是“问题 → 检索片段 → 模型回答 → 引用展示 → 失败反馈”。本网站展示这条设计，模型问答是否接入以项目进度为准。'],
  example: example('读者询问课程中的一个概念。', ['从获准材料中找支持片段并保留编号。', '让回答使用片段，再逐句核对关键结论。', '显示可回查出处，并提供具体问题的反馈入口。'], '交付物包含回答、支持片段与出处；资料没有答案时说明不足。这里是教学设计。'),
  confusions: ['接口返回成功不能代替回答验收。', '加入流程工具不会自动解决资料与引用错误。'],
  check: { question: '答案正确但引用指向无关页面，应在哪项交付要求下判为失败？', answer: '引用可回查且能支持结论这一项。内容正确与引用有效要分别检查。' },
}, [{ map: 'domain', node: 'rag', label: '借鉴检索增强的应用思路' }]);

point('content-cost', '内容核实与维护责任', '资源与成本', ['E-COSTS'], ['L8'], {
  role: '承担人工工作', goal: '分清模型调用费与内容维护投入。',
  explanation: ['项目成员需要整理资料、核对引用、检查失败并更新内容。这些人工工作持续存在，也需要明确修改者与复核者。', '供应方运行模型，并不能代替课程内容核实。比较方案时，应把调用、设备和人工核实分列，避免只看单次价格。'],
  example: example('两种路线调用费用接近，但一条经常需要人工修正引用。', ['分别记录调用用量和引用失败。', '记录修正、复核与资料更新所需工作。', '在相同质量要求下说明维护责任如何分配。'], '形成包含人工工作的投入记录；没有实际工时与账单时不填成本结论。'),
  confusions: ['免费工具仍需要维护。', '模型供应方与课程内容维护者承担不同职责。'],
  check: { question: '为什么只比较每次调用价格，可能选错路线？', answer: '因为设备、资料整理、失败处理和人工核实也影响总投入，应在相同质量要求下分项比较。' },
}, [{ map: 'cognition', node: 'cost-api', label: '把人工维护纳入取舍' }]);

point('benchmarks', '通用基准与课程问题', '成果与资料', ['E-RESOURCES'], ['S09', 'L8'], {
  role: '提供初筛线索', goal: '区分公开基准与课程验收各回答什么问题。',
  explanation: ['通用基准用特定任务、题目与评分口径描述公开表现，可以帮助初筛。课程答疑还需要解释指定概念、忠实引用材料并处理无答案问题。', '项目应根据这些任务要求补自己的问题集。比较结果要保留模型版本和评测设置，不能只复制一个名次。'],
  example: example('候选模型的公开成绩很好，但课程引用表现未知。', ['查公开基准实际测了什么。', '列出课程解释、引用和无答案处理的缺口。', '为缺口各设计一个问题与预期要点。'], '得到初筛依据与课程补测任务。'),
  confusions: ['公开榜单与课程专用评测覆盖范围不同。', '不同配置下的总分不能直接混比。'],
  check: { question: '为什么课程助手还需要一组没有答案的问题？', answer: '用来检查资料不足时是否说明限制，而不是编造课程信息；这也是任务质量的一部分。' },
}, [{ map: 'cognition', node: 'ranking-task', label: '把榜单线索放回课程任务' }]);

point('evaluation-tools', '评测框架与维护者', '工具', ['E-ELEUTHER'], ['S09', 'L8'], {
  role: '组织可重复的测试', goal: '区分维护者、框架、题库与评分规则。',
  explanation: ['EleutherAI 维护 lm-evaluation-harness；OpenCompass 是另一个评测框架入口。框架负责组织运行与记录，任务支持要核对采用的版本。', '本组仍需准备课程题、资料与评分规则，保存逐题输出。引用是否支持结论也需要单独核对。'],
  example: example('用评测工具组织同一组课程问题。', ['核对目标模型接口和任务支持。', '登记数据、提示与评分配置。', '保留逐题回答、判分理由和失败例。'], '交接物是可重复的评测配置与记录，不只是一张总分截图。'),
  confusions: ['安装框架不等于拥有课程题库。', 'EleutherAI 对 lm-evaluation-harness 的维护关系不能扩展到 OpenCompass。'],
  check: { question: '复查一张总分截图还缺什么？', answer: '问题与数据版本、模型及提示设置、评分规则和逐题结果。' },
}, [{ map: 'domain', node: 'evaluation-set', label: '支持独立任务检验' }]);

point('evaluate-model', '课程任务验收', '协作环节', ['E-COLLABORATION', 'E-RESOURCES'], ['L8'], {
  role: '决定能否交付', goal: '为同一道问题分开记录内容、引用和无答案处理。',
  explanation: ['验收者使用事先固定的问题、资料和评分规则检查系统。至少分开判断概念是否正确、引用是否支持结论、资料不足时是否恰当说明。', '验收要贯穿开发：资料、提示、模型或检索配置改变后复测，并保留失败。用于反复调试的题与最终独立测试应分开。'],
  example: example('同一道课程题的两份回答都流畅。', ['按预期要点判断内容。', '逐条核对结论与支持片段。', '保留差异与配置，再检查无答案问题的处理。'], '得到逐题三项记录，可解释通过或失败的原因。这里不报告模型得分。'),
  confusions: ['训练损失与课程验收衡量的对象不同。', '总分可能掩盖引用或拒答方面的失败。'],
  check: { question: '改了检索资料后，应复查哪些交接物？', answer: '资料版本、返回片段、提示与回答、引用支持关系，以及固定课程问题的逐题结果。' },
}, [{ map: 'domain', node: 'evaluation-set', label: '用独立问题检验任务收益' }, { map: 'cognition', node: 'loss-test', label: '区分训练信号与任务表现' }]);

point('user-feedback', '反馈与修订', '协作环节', ['E-COLLABORATION'], ['L8'], {
  role: '把失败带回开发', goal: '将一条读者意见转成可复查的修订记录。',
  explanation: ['读者提供具体问题与失败线索，项目成员核对资料和运行条件，再决定改资料、检索、提示还是界面。', '修订记录应包括原问题、失败原因、处理动作与复测结果。真实反馈需要实际读者记录，教学示例不能充当已取得的意见。'],
  example: example('读者报告“答案中的引用打不开”。', ['保存问题、答案、引用地址与发生时间。', '核对是链接错误、权限问题还是资料版本改变。', '修正后复查原问题，并记录处理结果。'], '形成“反馈 → 核实 → 修订 → 复测”的闭环。'),
  confusions: ['读者意见需要核实后再进入修订。', '引用失败不一定需要重新训练模型。'],
  check: { question: '反馈只有“很不好用”四个字，先补什么？', answer: '补具体任务、问题、实际结果和发生条件，才能定位失败并检查修复。' },
}, [{ map: 'domain', node: 'monitoring', label: '将核实失败交给回归检查' }]);

point('official-information', '来源与版本维护', '信息入口', ['E-PUBLICATIONS'], ['S05', 'S07', 'S11', 'L8'], {
  role: '跟进所用依赖', goal: '根据自己的依赖清单选择更新范围。',
  explanation: ['优先维护实际用到的模型卡、官方文档和发布记录：它们分别解释对象、接口与变化。论文提供方法依据，社区讨论提供待复查的故障线索。', '按版本记录变化，判断是否影响当前资料、配置和验收；需要时更新并复测。入门阶段先跟踪少量直接依赖即可。'],
  example: example('所用工具发布了新版本。', ['查正式发布记录，找到影响当前功能的变化。', '保留旧配置，再核对升级条件。', '升级后重跑固定问题，登记改动与剩余问题。'], '得到有范围、有理由的维护记录；会议期刊与扩展学习目录留作后续更新。'),
  confusions: ['仓库热度不是任务适配性。', '社区经验需要带着环境与版本回查。'],
  check: { question: '跟踪十个无关项目，和复核一个正在使用的依赖，哪项更应优先？', answer: '先复核直接影响当前系统的依赖，并说明变化对配置、资料与验收有什么影响。' },
});

point('inference-cost', '资源与费用由谁承担', '资源与成本', ['E-COSTS'], ['L8', 'S21'], {
  role: '明确资源责任', goal: '区分上游投入、平台分发、推理与人工维护。',
  explanation: ['模型发布方投入研发与训练，平台和贡献者承担分发及工具维护；应用运行时还需要设备或 API 用量、网站托管和内容维护。', '自托管由项目承担设备与运行，API 路线依赖供应方服务并按实际条件计费。相同任务质量下分项比较，保留维护与失败处理投入。'],
  example: example('比较自托管和托管调用两条课程助手路线。', ['列一次性设备或配置投入。', '分别列持续运行、调用、托管和人工核实。', '明确由谁承担，并将未知金额留空待测。'], '得到分项责任表，不用“可免费下载”推断整套系统零成本。'),
  confusions: ['上游训练账单与本组推理用量不同。', '较低单次费用不一定意味着较低总投入。'],
  check: { question: '权重免费下载后，本组还可能承担哪些资源？', answer: '设备或服务用量、存储与网络、网站运行，以及资料核实、故障处理和维护时间。' },
}, [{ map: 'cognition', node: 'cost-api', label: '为效果与成本取舍提供责任划分' }]);

const stage = (id: string, title: string, doc: string, members: string[], topic: TopicLesson, handoff: string): MapNode => ({
  id, title, type: '主题', documents: [{ id: doc }], sources: ['L8'], summary: topic.question,
  detail: topic.overview.join(' '), topic, boundary: handoff, children: members.map((id) => nodes[id]),
});
const branches = [
  stage('stage-publish', '模型与研究来源', 'E-PARTICIPANTS', ['qwen', 'research-origins', 'model-releases'], { question: '我们复用谁的什么成果？', overview: ['用一家模型发布方和一张研究贡献卡，分清模型、方法、版本与获取入口。', '先写清复用对象，再把具体条件交给运行环节。'], outcome: '写出对象、版本、来源、条件四项记录。', classification: '发布方提供模型，研究者提供方法；两种贡献分别追溯。' }, '交接物：模型与来源记录。'),
  stage('stage-adapt', '运行与工具', 'E-COLLABORATION', ['huggingface', 'inference-tools', 'api-platforms'], { question: '谁把模型运行起来？', overview: ['先分清加载与适配工具的职责，再比较自托管和托管 API 两条运行路线。', '适配按需决定，运行方案必须与任务、设备和服务条件相匹配。'], outcome: '解释运行路线及供应方、本组各自承担的工作。', classification: '自托管与 API 是运行选择；微调是另外一项按需决策。' }, '交接物：运行路线与接口约定。'),
  stage('stage-apply', '应用与资料', 'E-APP', ['course-data', 'build-application', 'content-cost'], { question: '谁把能力变成有依据的回答？', overview: ['课程资料提供依据，应用团队连接检索、回答与引用，并承担内容核实。', '以一条问题到反馈的最小链路解释交付，先明确责任再增加工具。'], outcome: '画出问题、片段、回答、引用与反馈的交接。', classification: '内容提供者、模型服务方与应用维护者承担不同责任。' }, '交接物：回答、出处与核实记录。'),
  stage('stage-evaluate', '评测与验收', 'E-RESOURCES', ['benchmarks', 'evaluation-tools', 'evaluate-model'], { question: '谁判断它是否满足课程需要？', overview: ['通用基准帮助初筛，框架组织运行，项目用自己的课程问题验收。', '内容、引用和无答案处理分别判断，配置改变后复测。'], outcome: '为一道课程题写出预期要点和逐项评分标准。', classification: '评测贯穿开发与使用；卡片顺序不限制它的执行时间。' }, '交接物：固定问题、设置与逐题结果。'),
  stage('stage-feedback', '反馈与维护', 'E-COSTS', ['user-feedback', 'official-information', 'inference-cost'], { question: '谁持续修正问题，承担投入？', overview: ['把读者问题、依赖更新和资源投入接到同一条维护闭环。', '先核实失败，再记录修订、复测和成本责任。'], outcome: '写一条包含原因、责任与复测的维护记录。', classification: '反馈可能指向资料、配置或界面，处理方式取决于失败原因。' }, '交接物：修订理由、复测与资源责任表。'),
];

const rel = (from: string, to: string, label: string, description: string, category: NonNullable<ConceptRelation['category']>, sources = ['L8'], core = true, basis: ConceptRelation['basis'] = 'editorial', direction: ConceptRelation['direction'] = 'directed'): ConceptRelation => ({ from, to, label, description, category, sources, core, basis, direction });
export const ecosystemRelations: ConceptRelation[] = [
  rel('stage-publish', 'stage-adapt', '交付模型与条件', '将明确的模型对象交给运行方；托管路线由服务方承担加载。', '交接'),
  rel('stage-adapt', 'stage-apply', '交付运行接口', '应用接收模型能力、异常约定与用量信息。', '交接'),
  rel('stage-apply', 'stage-evaluate', '交付待验收回答', '用固定课程问题检查内容和引用；评测贯穿开发。', '交接'),
  rel('stage-evaluate', 'stage-feedback', '交付失败记录', '保留逐题原因，确定后续核实和维护工作。', '交接'),
  rel('stage-feedback', 'stage-apply', '回查并修订', '按失败原因修正资料、配置或界面，再回到验收。', '证据与修订'),
  rel('qwen', 'model-releases', '发布模型与说明', '以 Qwen2.5 历史发布解释贡献关系，不作为当前型号推荐。', '贡献', ['S11'], true, 'material'),
  rel('research-origins', 'huggingface', '方法由工具实现', 'LoRA 可通过 PEFT 使用，具体支持查对应版本。', '贡献', ['S03', 'S05'], true, 'material'),
  rel('model-releases', 'huggingface', '交付匹配对象', '自行运行时核对模型、分词器、格式和版本。', '交接'),
  rel('huggingface', 'inference-tools', '区分加载与服务职责', '模型加载和推理服务有关联；工具组合要具体核对，API 路线无需用户自行组装。', '交接', ['S07', 'S10'], false),
  rel('inference-tools', 'api-platforms', '两种运行路线', '按相同任务质量比较设备、网络、用量和维护责任。', '资源与成本', ['L8'], true, 'editorial', 'undirected'),
  rel('inference-tools', 'build-application', '提供自托管推理', '本组维护运行环境，应用负责资料与引用。', '交接'),
  rel('api-platforms', 'build-application', '提供托管调用', '供应方运行模型，应用仍负责课程内容验收。', '交接'),
  rel('course-data', 'build-application', '提供可回查依据', '资料片段保留出处、版本和使用范围。', '交接'),
  rel('content-cost', 'build-application', '承担内容核实', '项目成员核实资料与引用并维护交付内容。', '资源与成本'),
  rel('benchmarks', 'evaluate-model', '提供初筛线索', '通用成绩需要补充本课程问题、引用与无答案检查。', '交接'),
  rel('evaluation-tools', 'evaluate-model', '组织运行与记录', '框架、课程题库与评分规则各有职责。', '交接', ['S09', 'L8']),
  rel('build-application', 'evaluate-model', '接受课程验收', '分别判断内容、引用和资料不足时的处理。', '交接'),
  rel('evaluate-model', 'user-feedback', '保留可定位的失败', '将失败条件交给核实和修订，并保留独立测试边界。', '证据与修订'),
  rel('user-feedback', 'build-application', '核实后修订', '按实际原因决定改资料、检索、提示还是界面。', '证据与修订'),
  rel('official-information', 'model-releases', '复核来源与版本', '模型卡与发布说明需要对应实际使用对象。', '证据与修订', ['S11', 'L8'], false),
  rel('official-information', 'huggingface', '跟进依赖变化', '升级前查文档与发布记录，升级后复测。', '证据与修订', ['S05', 'S07'], false),
  rel('inference-cost', 'api-platforms', '记录服务与用量', '费用依实际服务条件和使用量核对；本页不报告账单。', '资源与成本', ['S21', 'L8'], false),
  rel('inference-cost', 'inference-tools', '记录设备与运行', '自托管投入包括资源与维护，不能只看下载价格。', '资源与成本', ['L8'], false),
  rel('inference-cost', 'content-cost', '合看运行与人工投入', '在相同质量要求下分项记录，金额未知时保留空缺。', '资源与成本', ['L8'], false),
];

// 旧分享地址只定位到合并后的核心条目，不把储备内容重新带回主图。
export const ecosystemNodeAliases: Record<string, string> = {
  'stage-distribute': 'stage-publish', 'stage-serve': 'stage-adapt',
  'deepseek-team': 'stage-publish', 'llama-team': 'stage-publish', 'glm-team': 'stage-publish', 'kimi-team': 'stage-publish',
  'attention-authors': 'research-origins', 'attention-paper': 'research-origins', 'rag-authors': 'research-origins', 'rag-paper': 'research-origins', 'lora-authors': 'research-origins', 'qlora-authors': 'research-origins', 'lora-paper': 'research-origins',
  'publish-weights': 'model-releases', distribution: 'model-releases', 'distribute-weights': 'model-releases', 'access-observation': 'model-releases', 'access-validation': 'model-releases', 'access-boundaries': 'model-releases',
  transformers: 'huggingface', peft: 'huggingface', trl: 'huggingface', 'load-adapt': 'huggingface', 'maintenance-cost': 'huggingface',
  eleuther: 'evaluation-tools', 'serve-model': 'api-platforms', 'application-tools': 'build-application', 'visitor-role': 'user-feedback',
  'training-cost': 'inference-cost', 'distribution-cost': 'inference-cost', stanford: 'official-information', 'ml-conferences': 'official-information', 'ai-language-conferences': 'official-information', journals: 'official-information', 'community-information': 'official-information',
};
const collection = (id: string, title: string, members: string[], doc: string): LegacyCollection => ({ id, title, summary: '旧分类内容已并入五个核心主题。', members, documents: [{ id: doc }], sources: ['L8'] });
export const ecosystemLegacyCollections = [
  collection('participants', '参与者', ['qwen', 'research-origins', 'huggingface', 'evaluation-tools', 'api-platforms'], 'E-PARTICIPANTS'),
  collection('research-teams', '研究团队', ['research-origins'], 'E-PARTICIPANTS'),
  collection('model-teams', '模型团队', ['qwen'], 'E-PARTICIPANTS'),
  collection('communities', '社区', ['huggingface', 'evaluation-tools'], 'E-PARTICIPANTS'),
  collection('platform-services', '平台与服务', ['model-releases', 'api-platforms'], 'E-PARTICIPANTS'),
  collection('resources', '成果与资源', ['model-releases', 'course-data', 'benchmarks'], 'E-RESOURCES'),
  collection('publications', '信息入口', ['official-information'], 'E-PUBLICATIONS'),
  collection('collaboration', '协作链路', ['build-application', 'evaluate-model', 'user-feedback'], 'E-COLLABORATION'),
  collection('costs', '资源与成本', ['inference-cost', 'content-cost'], 'E-COSTS'),
  collection('access', '获取与条件', ['model-releases', 'api-platforms'], 'E-ACCESS'),
];
export const ecosystemMap: MapDefinition = {
  id: 'ecosystem', title: '生态地图', indexId: 'E-INDEX', number: '02',
  question: '谁把模型变成可用的课程助手？', description: '沿五个主题，看清成果、运行、资料、验收与维护的分工。',
  auxiliary: ['E-PARTICIPANTS', 'E-RESOURCES', 'E-COLLABORATION', 'E-COSTS', 'E-PUBLICATIONS', 'E-ACCESS'].map((id) => ({ id })),
  branches, learningPath: branches.flatMap((stage) => stage.children!.map((node) => node.id)),
  conceptRelations: ecosystemRelations, legacyCollections: ecosystemLegacyCollections, nodeAliases: ecosystemNodeAliases,
};
