import type { DocumentRef, MapDefinition, MapNode, MapRelation } from './types';

// 导图 ID 独立于正文 ID。改标题不会改变分享地址；同一正文可支持多个节点。
const doc = (id: string, anchor?: string): DocumentRef => ({ id, anchor });
const relation = (map: MapRelation['map'], node: string, label: string): MapRelation => ({ map, node, label });
const leaf = (id: string, title: string, summary: string, detail: string, documents: DocumentRef[], sources: string[], boundary?: string, relations?: MapRelation[]): MapNode =>
  ({ id, title, summary, detail, documents, sources, boundary, relations });
const branch = (id: string, title: string, summary: string, document: string, sources: string[], children: MapNode[]): MapNode =>
  ({ id, title, summary, detail: summary, documents: [doc(document)], sources, children });

export const maps: MapDefinition[] = [
  {
    id: 'domain', title: '领域地图', indexId: 'D-INDEX', number: '01',
    question: '模型怎样变成有依据的回答？',
    description: '从问题到可复现的系统，沿五条主干理解模型构建。',
    auxiliary: [doc('D-PIPELINE'), doc('D-CONCEPTS'), doc('D-METHODS'), doc('D-TOOLS'), doc('D-EVALUATION'), doc('D-LEARNING'), doc('D-UNDERSTANDING'), doc('D-FIGURES'), doc('D-ENTRIES')],
    branches: [
      branch('task', '任务', '解决什么问题', 'D-TASK', ['L6', 'L3'], [
        leaf('prediction', '预测', '给定输入，估计可能的输出', '分类、回归和下一个 token 预测都在学习输入与输出之间的关系。先明确模型需要预测什么，再约定怎样判断预测是否有效。', [doc('D-TASK', 'prediction')], ['L6'], '课程助手中，预测下一个 token 是生成机制的一部分，不等于已经核实回答中的事实。'),
        leaf('generation', '生成', '把输入转成解释、摘要或对话', '课程助手根据问题与上下文生成回答。摘要与比较要忠于指定材料，概念解释需要符合读者的基础；两者都需要明确的验收样例。', [doc('D-TASK', 'generation')], ['L6', 'L3'], '回答流畅、篇幅更长，都不能单独证明内容正确。', [relation('cognition', 'ranking-task', '由任务评测检验')]),
        leaf('alignment', '对齐', '让行为符合任务与使用约束', '指令跟随、澄清、引用和恰当拒答共同影响助手的行为。可以通过提示、监督微调或偏好优化等方法改善，先检查任务需要哪一种变化。', [doc('D-TASK', 'alignment'), doc('D-METHODS')], ['L6', 'L3'], '对齐不是正确性的保证；资料缺失时仍应说明不知道。'),
      ]),
      branch('data', '数据', '用什么例子教', 'D-EVALUATION', ['L6', 'L3'], [
        leaf('collection', '采集', '记录授权、出处与数据版本', '收集课程材料时，先确认能否使用，再记录来源、章节或页码。每段材料都应能回到原文，后续的检索与引用才有核查基础。', [doc('D-PIPELINE', 'collection'), doc('K-CARD')], ['L3', 'L6'], '可以访问一份资料，不等于拥有再分发或训练使用的许可。'),
        leaf('cleaning', '清洗', '把可读资料变成可靠输入', '检查解析后的文字、公式和表格，去重并保留来源信息；划分训练与测试材料时，还要排查重复或近似内容，避免把测试答案带进训练。', [doc('D-PIPELINE', 'cleaning'), doc('D-EVALUATION')], ['L3', 'L6'], '自动清洗之后抽样回看原文，避免把关键条件一起删掉。'),
        leaf('evaluation-set', '评测集', '用没见过的问题检查效果', '从真实学习困难构造有答案、无答案和模糊问题，预先写好评分要点与支持片段。固定一套独立问题，才能比较改动前后的效果。', [doc('K-EVAL'), doc('D-EVALUATION')], ['L3', 'L6'], '不要在测试集上反复调参；测试集独立不只意味着文件名不同。', [relation('cognition', 'loss-test', '用于检验泛化'), relation('ecosystem', 'evaluation-tools', '由工具支持评测')]),
      ]),
      branch('model', '模型', '用什么结构学', 'D-CONCEPTS', ['L6', 'S01'], [
        leaf('token', 'Token', '模型读取的文字单元', '分词器将文字转换为 token，再映射到模型可计算的表示。同一句话在不同 tokenizer 下可能有不同切分，上下文长度也通常按 token 计算。', [doc('K-TOKEN')], ['L6', 'S07'], '一个汉字或一个英文单词不一定对应一个 token。'),
        leaf('attention', '注意力', '按相关程度聚合上下文', '注意力用查询 Q 与键 K 的匹配结果，对值 V 做加权聚合。用一个小矩阵例子观察权重，可以把“关注上下文”变成可检查的计算。', [doc('K-TRANSFORMER', 'attention'), doc('D-CONCEPTS')], ['S01', 'L6'], '注意力权重不应直接被当作模型完整的解释。', [relation('ecosystem', 'attention-authors', '由研究团队提出')]),
        leaf('transformer', 'Transformer', '组织注意力与逐层计算的结构', 'Transformer 将注意力、前馈网络等模块组合起来处理序列。注意力是其中的机制，Transformer 是组织这些模块的模型结构，两者不能混为一个概念。', [doc('K-TRANSFORMER', 'transformer'), doc('D-CONCEPTS')], ['S01'], '原始论文不能直接代表每个后续模型的全部实现。', [relation('ecosystem', 'attention-paper', '依据原始论文')]),
      ]),
      branch('training', '训练', '怎么把参数调好', 'D-METHODS', ['L6', 'L3'], [
        leaf('loss', '损失', '训练要优化的数值目标', '损失衡量当前输出与训练目标之间的差距，梯度和优化器据此更新参数。读 loss 曲线时，需要同时知道数据、目标函数和评测条件。', [doc('K-LOSS'), doc('D-CONCEPTS')], ['L6', 'L3'], '训练 loss 下降不能直接推出课程问答更可靠。', [relation('cognition', 'loss-test', '用独立评测检验')]),
        leaf('pretraining', '预训练', '从较大范围的数据学习模式', '预训练形成可复用的模型能力。本项目优先理解并使用已有基座，将资源放在资料、检索与评测；训练基座与构建一个课程助手是不同规模的工作。', [doc('K-PRETRAIN'), doc('M-BASE')], ['L6', 'L3'], '参数量、预训练数据量都不能单独代替任务评测。', [relation('ecosystem', 'qwen', '由模型团队发布基座')]),
        leaf('finetuning', '微调 / LoRA', '区分训练任务与参数适配方法', 'SFT 使用示例进行监督微调；LoRA 冻结基座的大部分参数，用低秩适配器更新少量参数。可以用 LoRA 做 SFT，但二者分别回答“怎么训练”和“更新哪些参数”。', [doc('K-SFT'), doc('K-LORA'), doc('K-QLORA'), doc('T-PEFT')], ['S03', 'S04', 'S05', 'S06'], '先有稳定的行为问题和独立评测，再判断是否值得微调。', [relation('ecosystem', 'lora-authors', '由研究团队提出 LoRA'), relation('ecosystem', 'huggingface', '由 PEFT 实现'), relation('cognition', 'loss-test', '用任务表现检验')]),
      ]),
      branch('system', '系统', '怎么让它可用', 'D-PIPELINE', ['L6', 'L3'], [
        leaf('rag', 'RAG', '先找依据，再组织回答', '把问题交给检索系统，取回相关资料，再让模型结合这些片段回答。保留引用和召回记录，才能区分“没找到依据”与“有依据却答错”。', [doc('K-RAG'), doc('T-RETRIEVAL')], ['S02', 'L3'], 'RAG 仍可能检索错误或错误使用证据，必须检查引用能否支持结论。', [relation('ecosystem', 'rag-authors', '由研究团队提出'), relation('cognition', 'system-view', '用系统拆解排查')]),
        leaf('deployment', '部署', '让模型成为可访问的服务', '部署要处理模型加载、推理接口、时延、失败和预算。可以比较托管 API 与本地服务，按照实际任务和设备条件选择。', [doc('K-DEPLOY'), doc('T-VLLM'), doc('T-OLLAMA')], ['S10', 'L3'], '开放权重不意味着推理没有成本；本网站的静态导图本身不调用模型。', [relation('ecosystem', 'api-platforms', '由平台提供推理服务'), relation('cognition', 'cost-api', '用效果与成本权衡')]),
        leaf('monitoring', '监控', '从失败和反馈继续修订', '上线后记录失败类型、引用可用性、时延与资源使用，并把真实问题送回评测集。资料和模型版本变化后，重跑对照评测，再决定是否更新。', [doc('D-PIPELINE', 'monitoring'), doc('D-EVALUATION')], ['L3', 'L6'], '只记录总访问量不足以判断回答质量；反馈需要核实后再采用。', [relation('cognition', 'independent-feedback', '由独立反馈推动修订')]),
      ]),
    ],
  },
  {
    id: 'ecosystem', title: '生态地图', indexId: 'E-INDEX', number: '02',
    question: '依靠谁的成果，又与谁协作？',
    description: '把研究、开源工具、平台与使用者放回同一张关系网。',
    auxiliary: [doc('E-PARTICIPANTS'), doc('E-RESOURCES'), doc('E-PUBLICATIONS'), doc('E-COLLABORATION'), doc('E-COSTS'), doc('E-ACCESS'), doc('E-ENTRIES')],
    branches: [
      branch('participants', '参与者', '谁提出、实现与维护', 'E-PARTICIPANTS', ['L4'], [
        branch('research-teams', '研究团队', '从原始工作找到方法的来处', 'E-PARTICIPANTS', ['L4'], [
          leaf('attention-authors', 'Transformer 研究者', 'Vaswani 等原始论文作者', '从 Attention Is All You Need 追溯 Transformer 的结构设计与实验背景。这里标识历史论文的作者关系，不把整个研究方向归于单个人。', [doc('E-ATTN')], ['S01'], undefined, [relation('domain', 'transformer', '提出 Transformer')]),
          leaf('rag-authors', 'RAG 研究者', 'Patrick Lewis 等', '原始 RAG 工作连接检索得到的外部知识与生成模型。本项目借用检索后生成的应用思路，具体系统需要独立设计与评测。', [doc('E-RAG')], ['S02'], '采用思路不等于复现论文全部训练设计。', [relation('domain', 'rag', '提出 RAG')]),
          leaf('lora-authors', 'LoRA 研究者', 'Edward J. Hu 等', 'LoRA 提供冻结基座、训练低秩适配器的参数高效适配方法。理解其假设与实验条件后，再判断是否适用于本组任务。', [doc('E-LORA')], ['S03'], undefined, [relation('domain', 'finetuning', '提出 LoRA')]),
          leaf('qlora-authors', 'QLoRA 研究者', 'Tim Dettmers、Artidoro Pagnoni 等', 'QLoRA 将量化冻结基座与低秩适配结合，讨论更节省显存的适配方法。资源结论要连同模型、设置和设备一起阅读。', [doc('E-QLORA')], ['S04'], '不能把论文中的显存结果直接当作本组设备保证。'),
          leaf('stanford', 'CS336 课程团队', '从数据到语言模型的学习入口', 'Stanford CS336 提供语言模型构建、训练与评测的课程资料，可用于后续系统学习；先按当前问题选取内容，再逐步补齐基础。', [doc('E-STANFORD'), doc('D-LEARNING')], ['S12'], '课程年度与基础要求应对应具体资料，不作为本次作业的先修门槛。'),
        ]),
        branch('model-teams', '模型团队', '谁发布可复用的基座', 'E-PARTICIPANTS', ['L4'], [
          leaf('qwen', 'Qwen 团队', '模型发布、技术报告与模型卡', 'Qwen 的历史发布展示了企业模型如何通过权重、报告和社区工具被复用。选择基座时仍要核对具体型号、revision、许可及适配条件。', [doc('E-QWEN')], ['S11'], '此处为历史案例，不表示最新型号推荐。', [relation('domain', 'pretraining', '发布预训练基座')]),
        ]),
        branch('communities', '社区', '谁维护可复用工具', 'E-PARTICIPANTS', ['L4'], [
          leaf('huggingface', 'Hugging Face 与贡献者', '加载、适配与文档生态', 'Transformers、PEFT 和 TRL 等工具把模型加载与训练方法转为可运行的流程。使用时记录版本和配置，并回到原论文理解方法边界。', [doc('E-HF'), doc('T-PEFT')], ['S05', 'S06', 'S07'], undefined, [relation('domain', 'finetuning', '通过 PEFT 实现 LoRA')]),
          leaf('eleuther', 'EleutherAI', '可复用的评测工具', 'lm-evaluation-harness 提供任务配置和评测运行入口，帮助保存可比较的设置。评测框架不等于题库本身，也不代替本课程任务设计。', [doc('E-ELEUTHER')], ['S09'], undefined, [relation('domain', 'evaluation-set', '提供评测实现')]),
        ]),
        branch('platform-services', '平台服务', '让成果被分发和使用', 'E-PARTICIPANTS', ['L4'], [
          leaf('inference-tools', '推理工具', 'vLLM / Ollama / llama.cpp', '这些候选工具帮助在不同设备与服务形态下运行模型。比较版本支持、显存、并发、时延和部署复杂度，按本组条件选用。', [doc('E-DEPLOY')], ['S10', 'L4'], '候选清单不等于本组已部署或验证。', [relation('domain', 'deployment', '支持推理部署')]),
          leaf('distribution', '模型分发平台', 'ModelScope / Hugging Face', '模型分发连接发布者与使用者，提供权重、模型卡及版本入口。下载之前核对发布者、文件、许可与 revision。', [doc('E-DISTRIBUTION')], ['L4'], '镜像可用性和下载速度需要在实际网络中验证。'),
          leaf('api-platforms', 'API 平台', '百炼、硅基流动等候选', '托管推理把模型运行交给服务平台，小组负责请求、预算和应用体验。按具体模型及接口测试质量、引用、时延和费用。', [doc('E-API')], ['L4', 'S21'], '没有实测账单，不在地图中给出固定价格。', [relation('domain', 'deployment', '提供托管推理'), relation('cognition', 'cost-api', '用于方案比较')]),
          leaf('application-tools', '应用工具', 'Dify / Open WebUI 等候选', '应用工具可提供问答界面与流程编排入口。选用前检查检索、引用展示、部署方式和维护成本是否适合课程任务。', [doc('E-APP')], ['L4'], '接入工具不能代替资料核实和答案质量评测。'),
        ]),
      ]),
      branch('resources', '成果与资源', '哪些成果可以被复用', 'E-RESOURCES', ['L4'], [
        leaf('attention-paper', 'Attention 论文', '序列信息怎样交互', 'Attention Is All You Need 是理解 Transformer 的原始入口。阅读时连接结构、问题背景、实验设置与局限，而不是只记住名称。', [doc('E-RESOURCES'), doc('E-ATTN')], ['S01'], undefined, [relation('domain', 'attention', '解释注意力机制')]),
        leaf('rag-paper', 'RAG 论文', '外部知识怎样参与生成', 'RAG 原始研究把外部检索记忆与生成模型结合。课程助手关注检索命中、依据使用和引用正确性，需要以本组数据验证。', [doc('E-RESOURCES'), doc('E-RAG')], ['S02'], undefined, [relation('domain', 'rag', '提供方法依据')]),
        leaf('lora-paper', 'LoRA / QLoRA 论文', '适配参数与显存怎样减少', '两篇工作分别讨论低秩适配和量化基座上的适配。将训练参数、量化条件和资源预算分开比较，避免把方法名称当作效果保证。', [doc('E-RESOURCES'), doc('E-LORA'), doc('E-QLORA')], ['S03', 'S04']),
        leaf('model-releases', '模型与技术报告', '把发布信息接到可复现版本', '模型卡、技术报告和具体权重版本共同界定可复用的对象。Qwen 的历史发布是本地图的示例，最终实验还要记录实际 revision。', [doc('E-RESOURCES'), doc('E-QWEN')], ['S11']),
        leaf('course-data', '授权课程资料', '最贴近课程的问答依据', '课程原文、自建问答与评分要点连接真实学习困难和模型评测。小组需要建设独立测试并保留出处，不能把收集材料等同于已完成评测。', [doc('E-RESOURCES'), doc('D-EVALUATION')], ['L3', 'L4'], undefined, [relation('domain', 'collection', '作为数据采集对象')]),
        leaf('benchmarks', 'C-Eval / MMLU', '通用能力的初筛入口', '通用题库可帮助初筛候选模型，但课程中的解释、引用和拒答是另外的检查对象。榜单结果必须结合评测条件阅读。', [doc('E-RESOURCES')], ['L4'], undefined, [relation('cognition', 'ranking-task', '需以课程任务复核')]),
        leaf('evaluation-tools', '评测框架', 'lm-evaluation-harness / OpenCompass', '框架帮助规范任务配置和运行过程。先核对具体任务支持与版本，再用固定设置记录结果和失败案例。', [doc('E-RESOURCES'), doc('E-ELEUTHER')], ['S09', 'L4'], '框架与题库是不同对象。', [relation('domain', 'evaluation-set', '用于运行评测')]),
      ]),
      branch('publications', '会议与信息入口', '在哪里追溯和跟进', 'E-PUBLICATIONS', ['S14', 'L4'], [
        leaf('ml-conferences', 'NeurIPS / ICML / ICLR', '模型、优化与表征学习', '从与选题直接相关的正式论文出发，追踪方法和实验条件。会议声誉只能帮助筛选入口，不能代替对单篇论文证据的判断。', [doc('E-PUBLICATIONS')], ['S14', 'L4'], '正文保留 CCF 2022 版口径与待核实标签，不称为最新目录。'),
        leaf('ai-language-conferences', 'ACL / AAAI', '语言任务与人工智能应用', '围绕语言模型、评测和综合应用寻找工作。核对具体论文类别与正式发表信息，避免把预印本与已发表论文混用。', [doc('E-PUBLICATIONS')], ['S14', 'L4']),
        leaf('journals', 'JMLR / TACL', '从期刊追问题与方法', 'JMLR 连接机器学习及部分软件工作，TACL 关注计算语言学与自然语言处理。阅读时优先检查任务相关性和实验依据。', [doc('E-PUBLICATIONS')], ['L4']),
        leaf('official-information', '论文 / 模型卡 / 文档', '按用途选择第一手依据', '论文解释方法，模型卡说明对象与许可，项目文档解释支持范围。遇到版本变化时，从 Releases 和 Changelog 追踪，再按实际配置复核。', [doc('E-PUBLICATIONS'), doc('P-SOURCES')], ['L4']),
        leaf('community-information', 'Issue / 博客', '发现问题后回到证据', '社区讨论可提供故障线索和经验，但需要回到代码、文档或可重复实验核实。固定跟进少量项目，比泛泛追踪整个领域更可持续。', [doc('E-PUBLICATIONS')], ['L4']),
      ]),
      branch('collaboration', '协作链路', '成果怎样走到使用者', 'E-COLLABORATION', ['L4'], [
        leaf('publish-weights', '发布权重与模型卡', '发布者说明对象和边界', '模型机构发布权重、技术信息与许可，使用者据此判断是否可以下载、适配与部署。明确对象版本是协作链的起点。', [doc('E-COLLABORATION')], ['L4', 'S11']),
        leaf('distribute-weights', '分发与下载', '平台连接发布者和开发者', '分发渠道影响模型的可获得性。核对来源和版本之后，再记录下载、许可及环境约束，使后续实验可以追溯。', [doc('E-COLLABORATION'), doc('E-DISTRIBUTION')], ['L4']),
        leaf('load-adapt', '加载与适配', '开源工具把方法变成流程', '开发者通过模型加载、数据处理和适配工具连接研究方法与实际任务；工具版本、训练设置与数据切分共同影响结果。', [doc('E-COLLABORATION'), doc('E-HF')], ['S05', 'S07', 'L4'], undefined, [relation('domain', 'finetuning', '实现适配流程')]),
        leaf('serve-model', '推理服务', '本地推理或托管 API', '推理层把模型能力暴露为服务，应用层需要处理预算、异常和响应时间。模型可运行只是可用系统的一环。', [doc('E-COLLABORATION'), doc('E-API')], ['L4'], undefined, [relation('domain', 'deployment', '实现服务接口')]),
        leaf('user-feedback', '助手与用户反馈', '从使用结果回到资料与评测', '应用将检索、回答与引用交给同学使用。收集真实问题，核实反馈，再修订材料、提示或服务设置，形成可追踪的更新。', [doc('E-COLLABORATION')], ['L4'], undefined, [relation('domain', 'monitoring', '反馈用于监控与修订')]),
      ]),
      branch('costs', '资源与成本', '谁投入、谁使用、谁承担', 'E-COSTS', ['L4'], [
        leaf('training-cost', '预训练与发布', '机构投入数据与算力', '复用基座将已有训练成果带进课程项目，但不代表原始训练没有成本。缺少公开账单时，不推算单次训练的确定费用。', [doc('E-COSTS')], ['L4']),
        leaf('distribution-cost', '权重分发', '发布者、平台与镜像维护者', '带宽、存储和维护让权重能被下载。免费访问是使用条件，不是平台无成本或未来永久免费的证明。', [doc('E-COSTS')], ['L4']),
        leaf('maintenance-cost', '工具维护', '社区、公司与研究者', '适配、文档和问题修复需要持续投入。选工具时检查任务适配与维护情况，不只比较热度。', [doc('E-COSTS')], ['L4']),
        leaf('inference-cost', '推理成本', '调用方或自托管者付出资源', 'API 费用、设备占用和运维时间都需要进入预算。用相同问题记录质量、时延与用量，再比较方案。', [doc('E-COSTS')], ['L4', 'S21'], undefined, [relation('cognition', 'cost-api', '用于成本取舍')]),
        leaf('content-cost', '内容与应用维护', '资料权利人、组员与运营者', '整理、核实、托管和修订是小组的持续工作。调用模型 API 无法替代内容责任，也不能替代独立用户反馈。', [doc('E-COSTS')], ['L4']),
        leaf('visitor-role', '访客使用与反馈', '同学带来真实问题', '课程项目计划让同学免费使用，由小组或课程资源承担服务费用。使用反馈是改进线索，不默认访客愿意提供个人资料或密钥。', [doc('E-COSTS')], ['L4'], '这是项目方案，不是已经验证的商业模式。'),
      ]),
      branch('access', '网络与访问', '可获得性也有条件', 'E-ACCESS', ['L4'], [
        leaf('access-observation', '一次访问观察', '时间、网络与入口一起记录', '素材包含 2026-10-25 的个人访问观察。它只能说明当次条件下的结果，不代表所有地区、所有时间都可访问或不可访问。', [doc('E-ACCESS')], ['L4'], '当前尚未重新实测，不将旧观察显示为实时状态。'),
        leaf('access-validation', '实际环境复核', '在最终使用网络上验证', '部署前分别检查站点、模型下载与 API，并记录时间、网络、版本和错误信息。一次超时不应被扩展为地区性结论。', [doc('E-ACCESS')], ['L4']),
        leaf('access-boundaries', '许可与服务边界', '可下载、可用与可再分发不同', '模型许可、服务地域和分发渠道共同影响方案可行性。先确认实际任务允许的使用方式，再把验证结果写入项目记录。', [doc('E-ACCESS'), doc('E-COSTS')], ['L4']),
      ]),
    ],
  },
  {
    id: 'cognition', title: '认知地图', indexId: 'C-INDEX', number: '03',
    question: '我们凭什么相信，又怎样修正？',
    description: '把认识方法落到具体比较、检查动作和改变判断的证据上。',
    auxiliary: [doc('C-PERSPECTIVES'), doc('C-LOSS'), doc('C-RANKING'), doc('C-COST'), doc('C-HABITS'), doc('C-REVISION')],
    branches: [
      branch('perspectives', '认识方法', '先看关系，再找证据', 'C-PERSPECTIVES', ['L1', 'L5'], [
        leaf('system-view', '系统拆解 · 系统观', '错误发生在哪一环', '回答出错时，把资料、检索、模型和界面分开检查。保留每个环节的输入输出，先定位瓶颈，再改变方案。', [doc('C-PERSPECTIVES')], ['L1', 'L5'], '素材引用的课堂原件尚待补充。', [relation('domain', 'rag', '用于排查检索与生成')]),
        leaf('development-view', '发展背景 · 发展观', '新方法缓解了什么限制', '从全参微调到 LoRA/QLoRA、从闭卷回答到检索增强，比较各自的收益和新增边界。时间更晚不自动意味着对所有任务都更好。', [doc('C-PERSPECTIVES')], ['L1', 'S02', 'S03', 'S04']),
        leaf('third-view', '第三个观 · 待核实', '课堂正式名称仍待原文确认', '素材使用“求真观”，但原课件尚未提供。当前保留打开原文、检查反例、区分事实与推断这些可执行动作，不认定该名称就是课堂原名。', [doc('C-PERSPECTIVES')], ['L5'], '提交前补充正式名称与原文页码。'),
        leaf('comparison', '对照比较', '让变化可以归因', '使用同一批问题、明确的评分标准和固定设置比较方案。先控制其他变量，再观察某项改动带来的收益与失败。', [doc('C-PERSPECTIVES'), doc('C-LOSS')], ['L5']),
        leaf('tradeoff-method', '多目标取舍', '质量、时延、成本一起看', '模型方案受到预算、设备和维护能力约束。把多个目标放在同一张对照表里，说明为什么接受某些损失来换取另一些收益。', [doc('C-PERSPECTIVES'), doc('C-COST')], ['L5']),
      ]),
      branch('loss-case', 'loss 案例', '训练更低，回答就更好吗', 'C-LOSS', ['L5'], [
        leaf('loss-signal', '先看训练信号', 'loss 回答的是训练目标问题', '训练 loss 反映当前训练数据和目标上的优化情况。不能从这一个数字推断新问题的正确性、引用或使用体验。', [doc('C-LOSS')], ['L5', 'L6'], undefined, [relation('domain', 'loss', '对应损失概念')]),
        leaf('loss-test', '再看独立评测', '用同一批新问题比较', '固定独立测试问题，比较微调前后回答的正确性、引用、拒答与延迟。保存失败例子，才能判断 loss 的变化是否变成任务收益。', [doc('C-LOSS')], ['L5'], '当前是检验方案，尚无本组完成实验的证据。', [relation('domain', 'evaluation-set', '使用独立评测集'), relation('domain', 'finetuning', '检验微调效果')]),
        leaf('loss-counterexample', '寻找反例与泄漏', '低 loss 也可能来自记住答案', '检查重复材料、训练测试泄漏和过拟合。若换一批问题就失效，应修订“训练更低就更好”的判断，并保留条件与错误记录。', [doc('C-LOSS')], ['L5', 'L6']),
      ]),
      branch('ranking-case', '榜单案例', '排名高，适合课程吗', 'C-RANKING', ['L5'], [
        leaf('ranking-screen', '通用榜单初筛', '先缩小候选范围', '通用榜单提供部分能力线索，阅读时要确认模型版本、任务和评测条件。它可以帮助筛选候选，不能完成本课程的最终验收。', [doc('C-RANKING')], ['L5'], undefined, [relation('ecosystem', 'benchmarks', '参考通用题库')]),
        leaf('ranking-task', '课程任务复核', '检查解释、引用和拒答', '把真实课程问题、无答案问题和模糊问题放在同一套评测中。比较回答是否帮助读者理解，以及每个关键结论是否有依据。', [doc('C-RANKING')], ['L5'], undefined, [relation('domain', 'evaluation-set', '使用课程评测集')]),
        leaf('ranking-controls', '固定比较条件', '区分模型与系统的变化', '对照时固定提示、检索资料、问题和评分规则；必要时分别比较只检索、直接回答和检索后回答，避免把多个变化都归因于模型。', [doc('C-RANKING')], ['L5'], '当前框架需要补充本组实际对照记录。'),
      ]),
      branch('cost-case', '成本取舍', '怎样兼顾效果与可用性', 'C-COST', ['L5'], [
        leaf('cost-api', 'API + 检索', '较快接入，按用量与服务约束评估', '托管 API 可减少自行维护推理服务的工作，同时需要考虑调用费用、网络、服务限制与资料使用边界。用相同问题测质量、时延和用量。', [doc('C-COST')], ['L5', 'S21'], '当前没有实测账单，不给出确定费用。', [relation('ecosystem', 'api-platforms', '由 API 平台提供服务'), relation('ecosystem', 'inference-cost', '对应推理成本')]),
        leaf('cost-local', '本地模型 / 自托管 GPU', '控制更多，也承担设备与维护', '本地或自托管方案需要评估显存、并发、部署时间和维护能力。设备已有并不意味着运行和排障的成本为零。', [doc('C-COST')], ['L5'], undefined, [relation('domain', 'deployment', '对应部署选择')]),
        leaf('cost-adaptation', 'LoRA / QLoRA', '先确认适配收益是否值得投入', '适配增加数据、训练与评测工作，可能改善稳定的格式或行为问题。先定义要改善的指标，再比较效果收益与额外维护成本。', [doc('C-COST')], ['L5', 'S03', 'S04'], '不能把减少可训练参数直接解释为端到端总成本一定最低。', [relation('domain', 'finetuning', '对应微调方法')]),
      ]),
      branch('habits', '成长习惯', '让每次行动留下证据', 'C-HABITS', ['L5'], [
        leaf('define-problem', '先定义问题', '选工具前写一张任务卡', '记录读者、困难、输入输出和验收条件。范围变化时保留修改原因，用任务卡检查后续工作是否仍在解决同一个问题。', [doc('C-HABITS')], ['L5']),
        leaf('check-evidence', '找依据和反例', '为判断保留出处与条件', '重要结论打开原文，留下页码、支持条件和可能改变判断的反例。找不到依据时明确标记待核实。', [doc('C-HABITS')], ['L5']),
        leaf('small-trial', '小规模试跑', '先用少量资料跑通一轮', '保存环境、输入输出、成功与失败记录。先确认任务能够端到端运行，再判断需要扩大数据、模型或服务规模。', [doc('C-HABITS')], ['L5']),
        leaf('learn-from-gaps', '从困难反查知识', '知识缺口连接到课程和再尝试', '把讲不清或做不出的点写出来，选择对应教程或课程，学后回到同一个小任务复验，避免只积累学习清单。', [doc('C-HABITS'), doc('D-LEARNING')], ['L5', 'L6']),
        leaf('weekly-review', '每周分工与检查', '谁修改、谁复核、何时发布', '每周留下简短的修改说明、负责人和复核记录。完成与待办要以产物和检查结果区分，不只写“已经学习”。', [doc('C-HABITS'), doc('P-UPDATES')], ['L5']),
        leaf('independent-feedback', '独立反馈再修订', '让非组员先自行使用', '先观察同学能否独立完成查询，再解释和讨论。保留原始问题、核实过程、处理结果与理由，让反馈成为可追踪的修订。', [doc('C-HABITS')], ['L5'], '这些是执行规则，尚无记录的项目不能称为已经形成的习惯。', [relation('domain', 'monitoring', '推动系统更新')]),
      ]),
      branch('revision', '认识修正', '什么证据改变了理解', 'C-REVISION', ['L5'], [
        leaf('revision-before', '原来的理解', '曾沿心理学 cognitive map 搜集资料', '素材自述曾把课程中的认知地图理解为空间认知与心理学意义上的 cognitive map，因此搜集了不同方向的材料。', [doc('C-REVISION')], ['L5'], '经历与日期仍需相关成员确认。'),
        leaf('revision-evidence', '改变判断的依据', '重新对照作业与课件说明', '对照作业认知地图要求及素材所指课件第 11、28 页，发现关注点是思考方法、分析案例和成长习惯，资料边界因此需要改变。', [doc('C-REVISION')], ['L5'], '原课件与查阅记录尚待补充。'),
        leaf('revision-after', '现在的理解', '围绕本组选题中的判断与检验', '用损失、榜单和成本等问题组织案例，说明如何提出问题、依据什么判断，以及怎样检验和修正。定义、案例和资料筛选随之调整。', [doc('C-REVISION')], ['L5']),
        leaf('revision-open', '仍不知道什么', '把未确认的地方留在图上', '第三个观的正式名称、课堂原文，以及技术实验能否带来新的认识修正，都需要后续核实或实践。未经确认的自述不能当作已完成的真实经历提交。', [doc('C-REVISION'), doc('P-GAPS')], ['L5']),
      ]),
    ],
  },
];

export function getMap(id: string) {
  const map = maps.find((item) => item.id === id);
  if (!map) throw new Error(`Unknown map: ${id}`);
  return map;
}

export function flattenNodes(nodes: MapNode[]): MapNode[] {
  return nodes.flatMap((node) => [node, ...flattenNodes(node.children ?? [])]);
}

export function documentKey(ref: DocumentRef) {
  return `${ref.id}${ref.anchor ? `#${ref.anchor}` : ''}`;
}
