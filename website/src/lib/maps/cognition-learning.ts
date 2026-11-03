import type { ConceptRelation, MapDefinition, MapNode, NodeLesson, TopicLesson } from './types';

// 完整原稿与逐项去向：future-updates/cognition-2026-11-02/。
// 方法并入案例，每个主题只保留三个直接知识点。
export const cognitionNodeAliases: Record<string, string> = {
  'system-analysis': 'loss-test', comparison: 'ranking-task', 'tradeoff-method': 'cost-api',
  'check-evidence': 'define-problem', 'learn-from-gaps': 'small-trial',
  'independent-feedback': 'weekly-review', 'revision-open': 'revision-after',
};
const lessons: Record<string, { title: string; summary: string; lesson: NodeLesson }> = {};
function point(id: string, title: string, summary: string, role: string, goal: string, explanation: string[], input: string, steps: string[], output: string, confusions: string[], question: string, answer: string) {
  lessons[id] = { title, summary, lesson: { role, goal, explanation, example: { input, steps, output, materials: [] }, confusions, check: { question, answer } } };
}

point('system-view', '系统观', '沿资料、检索、回答与展示查找错误发生的位置。', '观察结构与联系', '把一个回答错误定位到可检查的交接环节。',
  ['系统观先看整体由哪些环节组成，以及信息怎样传递。答疑可拆成资料、检索、生成和引用展示。', '在交接处保存输入输出，对照实际差异定位问题，再决定修改哪一环。'],
  '资料片段说“仍需独立评测”，回答却写成“已经可靠”。',
  ['确认检索返回了哪个片段。', '对照提示、片段与实际回答。', '检查界面是否完整展示回答与出处。'],
  '先定位到片段使用或展示环节，再提出复验动作。',
  ['系统观提供观察角度，拆解是具体操作。', '发现一个断点仍需检查其他环节。'],
  '正确片段已返回，接下来优先检查什么？', '检查提示如何使用片段、生成的回答及引用展示，保存差异后复验。');

point('development-view', '发展观', '比较方法改变了什么限制，以及引入了什么条件。', '观察变化与条件', '用“原限制—方法改动—新增条件”说明一次技术选择。',
  ['发展观关注方法为什么出现、缓解了什么约束。比较应围绕同一个问题展开。', 'RAG补入外部资料，参数适配调整模型行为，量化改变资源条件；出现时间不能代替任务比较。'],
  '助手缺少课程依据，候选方案是增加检索或进行微调。',
  ['把困难写成“缺少可回查资料”。', '比较两种方法改变的环节。', '列出资料、运行与评测的新要求。'],
  '得到按问题选择方法的理由，并保留未解决的限制。',
  ['新方法需要对应具体困难。', '不同环节的方法可以组合使用。'],
  '比较两种方法时，除发布时间还需写哪三项？', '原来的限制、方法改变的环节，以及新增条件和仍未解决的问题。');

point('third-view', '求真观', '让结论对应证据，并明确什么反例会改变判断。', '观察证据与反例', '区分材料事实、个人推断和待验证判断。',
  ['求真观追问结论凭什么成立。记录支持片段、对象与条件，再寻找可能推翻过宽结论的反例。', '材料只报告一次训练指标时，结论也应限定在相应范围；任务收益需要相应的独立证据。'],
  '记录中只有“训练损失下降”，结论却写成“所有答疑都可靠”。',
  ['分开标出记录事实与扩展推断。', '找出结论缺少的任务证据。', '写出会使当前判断改变的反例或新记录。'],
  '把结论收束到证据支持的范围，并提出下一项检验。',
  ['来源存在与支持当前主张是两项检查。', '缺少证据不能直接证明相反结论。'],
  '“某次设置下改善”应怎样保留到结论里？', '保留对象、任务与设置，明确哪些是观察结果，哪些推广还需验证。');

point('loss-test', '损失下降与答疑质量', '用系统拆解与反例检查，区分训练信号和任务表现。', '系统拆解＋反例检查', '说明判断微调收益还需要哪一组任务证据。',
  ['系统拆解＋反例检查：先把训练损失、未见题回答和引用质量分开，避免用局部指标代表整个任务。', '固定问题、资料与评分规则比较适配前后表现，并检查训练测试重合与失败类型。'],
  '训练损失下降，训练题回答正确，新的课程题却引用错误。',
  ['按内容、引用、无答案处理拆分验收。', '以新题引用错误检验“损失下降就保证可靠”的说法。', '保留设置与逐题回答，补独立问题复测。'],
  '这个反例限制了原结论；实际收益还需固定条件下的任务记录。',
  ['训练题与独立测试承担不同用途。', '一个反例约束具体主张，不否定所有微调。'],
  '训练与测试题只是换了措辞，应该先排查什么？', '检查内容和答案是否近似重合，以及测试是否参与训练或调参，重新确认独立性。');

point('ranking-task', '榜单与课程适配', '先定义课程任务，再以相同问题和评分口径比较候选。', '问题定义＋对照比较', '写出一次可解释的课程模型比较条件。',
  ['问题定义＋对照比较：通用榜单提供初筛线索，课程答疑还要求解释指定概念、引用材料和处理无答案问题。', '先定义读者与验收标准，再保留相同问题、可用资料和判分口径；模型或提示差异要记录。'],
  '候选甲公开排名较高，候选乙的课程引用更完整。',
  ['定义课程解释与引用的验收项。', '让两者使用同一组问题和可比资料。', '逐题记录内容、引用、拒答与设置差异。'],
  '依据课程记录解释选择，并保留通用榜单未覆盖的部分。',
  ['排名与课程适配性回答不同问题。', '同一道题也可能使用了不同资料与提示。'],
  '甲可查资料、乙闭卷回答，分数差能直接归因于模型吗？', '需要区分模型与资料获取的影响；可以比较整套系统，但须明确条件和结论范围。');

point('cost-api', '效果与成本取舍', '在共同质量要求下，分项比较运行、资料与维护投入。', '多目标取舍＋演进分析', '写出有条件的路线选择理由和待补记录。',
  ['多目标取舍＋演进分析：先确定不能牺牲的质量要求，再比较时延、用量、设备与维护投入。', '自托管和API是运行路线，RAG和适配改变其他环节。按各自作用组合，不把它们混成同一种商品。'],
  'API调用便宜但引用常需人工修正，自托管需要设备与维护。',
  ['使用相同课程问题和质量标准。', '分列运行用量、设备及人工核实工作。', '比较已知条件，标出缺少的用量或工时记录。'],
  '得到包含质量约束和未知项的选择理由，不生成虚构账单。',
  ['免费获取权重仍可能需要运行资源。', '减少一项投入不保证总投入最低。'],
  '缺少访问量时，成本比较应怎样表达？', '列出各项投入、承担者和变化条件，保留用量缺口，暂不给出确定最低成本结论。');

point('define-problem', '定义问题与记录证据', '把任务、验收标准和可回查依据写在同一张记录中。', '行动一：任务与证据', '写出可检查的任务卡，并给关键判断绑定依据。',
  ['开始选工具前，写明读者困难、输入、可用材料、预期输出和验收条件。', '为关键判断保存出处、版本、页码与支持片段，区分直接证据和自己的推断。'],
  '准备让助手解释一个课程概念并给出引用。',
  ['写清读者、问题与合格回答标准。', '登记允许使用的材料与支持片段。', '为资料不足和可能反例留下检查项。'],
  '一张同时包含任务、依据与验收条件的记录。',
  ['“使用RAG”是实现选择，还需说明解决什么困难。', '收集链接后仍要核对它支持哪一句判断。'],
  '“让回答更好”应该补充哪些字段？', '补读者和问题、输入与资料、预期输出、评分标准，以及重要判断的支持出处。');

point('small-trial', '小规模试验与复验', '用少量问题发现断点，补知识后回到原任务检查。', '行动二：试验与复验', '保留一次小试验的输入输出，并说明下一轮检查。',
  ['先用少量固定问题检查路径，记录环境、片段、回答与失败。手工演练和真实模型运行分别标明。', '将失败转成具体知识缺口，补学后回到同一问题复验，保留前后差别与未覆盖范围。'],
  '首次核对发现回答误用了资料中的限制条件。',
  ['保存问题、支持片段与错误句子。', '回查检索或生成知识，缩小待改环节。', '在相同条件下重查原题，并保留独立题。'],
  '得到可复查的前后对照及下一轮任务。',
  ['少量成功只能说明当前覆盖范围。', '调试题应与最终独立测试分别保存。'],
  '补看教程后怎样判断它是否帮助了学习？', '回到原任务解释或修订，比较前后输出；仍失败时继续缩小知识缺口。');

point('weekly-review', '独立反馈与每周复盘', '先观察独立使用，再记录核实、修订与复测责任。', '行动三：反馈与复盘', '把读者意见转成有处理结果的修改记录。',
  ['先让非组员独立完成任务，再收集具体困难，避免提前解释掩盖操作问题。', '每周把反馈、证据、修改者、复核者和复测结果接起来，说明采纳或保留的理由。'],
  '一位读者独立查找概念时找不到引用入口。',
  ['记录任务、设备和实际卡住的位置。', '核对是内容还是入口问题，安排修改与复核。', '请对方重试，将结果写入周记录。'],
  '形成“独立使用—核实—修改—复查”的协作记录。',
  ['计划中的反馈不能计为实际访客意见。', '更新日期本身不能证明内容已经复核。'],
  '周记录只有“已优化页面”时，还缺什么？', '缺具体问题、依据、修改内容、责任人与复核结果，以及剩余问题。');

point('revision-before', '保留原判断', '写清原来相信什么，以及当时依据与适用范围。', '修正一：原判断', '留下可以与新判断比较的起点。',
  ['认识修正先保留原主张和当时依据，避免知道结果后重写自己的起点。', '原判断应具体到对象与范围，才能看出后来究竟改了哪一部分。'],
  '教学中的初始主张：“训练损失下降，所以所有课程题都能答好。”',
  ['保留原句，不替它补上事后限制。', '标明依据只有训练指标。', '圈出“所有课程题”这一待验证推广。'],
  '得到原主张、原依据与推广范围的对照起点。',
  ['教学初始主张与成员真实经历分别记录。', '修正可以缩小范围，无须将旧判断全盘推翻。'],
  '为什么要保留原句而不直接展示正确结论？', '保留原句才能解释新证据改变了什么，并避免事后把旧判断写得更合理。');

point('revision-evidence', '指认变化证据', '指出哪条新记录改变了原判断，而不只是增加链接。', '修正二：新证据', '说明证据针对原主张的哪一部分。',
  ['新依据可以是原文、逐题记录或可复验的失败。应说明对象、条件和它支持的判断范围。', '将证据与原主张逐项对照，分清需要保留、撤回或增加条件的部分。'],
  '原主张认为训练损失下降就能保证全部答疑可靠。',
  ['找到一条未见题引用错误的教学反例。', '保留问题、片段、回答与核对理由。', '指出它约束了原主张中的普遍保证。'],
  '得到证据与结论变化的明确对应。',
  ['更多链接不等于更多相关证据。', '单个反例约束主张，不自动证明全部相反结论。'],
  '一条失败记录怎样才能成为修正依据？', '它应能定位问题与条件，说明如何核对，并指出与原主张冲突的具体部分。');

point('revision-after', '修正结论与下一步', '更新有条件的结论，把仍未知的问题接回复验。', '修正三：新判断与行动', '同时写清改变、保留部分和下一项验证。',
  ['新判断应与证据范围匹配，说明原结论的哪部分被限制、哪部分仍可保留。', '将剩余未知转成具体任务，写明所需材料或记录，再交给下一轮小规模复验。'],
  '教学反例显示训练指标改善时仍可能引用错误。',
  ['将结论改为“训练信号改善，任务可靠性仍需独立检验”。', '保留训练记录的意义，撤回普遍可靠性保证。', '列出独立问题、引用核对与资料不足处理的复验任务。'],
  '形成“旧判断—变化证据—新判断—下一步”的完整记录。',
  ['未知项应落实到可执行问题。', '暂缺运行条件时可以保留分析，实际收益继续待验证。'],
  '新判断只写“还需要研究”，怎样让它可执行？', '写明哪个未知问题、需要什么依据、怎样取得，以及回到哪组固定问题复验。');

const topics: Record<string, TopicLesson> = {
  perspectives: { question: '从什么角度看待一个判断？', overview: ['从结构、变化和证据三个侧面，选择下一步检查动作。', '视角帮助提出问题，结论仍由具体依据检验。'], outcome: '为一个问题选视角，并说出检查什么。', classification: '保留系统、发展、求真三个视角；课堂正式术语仍需原件对照。' },
  'analysis-methods': { question: '怎样把方法用在具体问题上？', overview: ['在损失、榜单、成本三个案例中直接使用分析方法。', '每个案例保留问题、检查步骤与有条件的判断。'], outcome: '给出比较条件、可能反例与所需记录。', classification: '选择一个案例，检查比较条件、可能反例与尚缺的记录。' },
  habits: { question: '怎样把一次分析变成持续行动？', overview: ['用任务与证据、试验与复验、独立反馈与复盘组织行动。', '每次留下可检查的产物，再决定下一步。'], outcome: '为一个行动写清产物与复核方式。', classification: '三组行动整合原六项建议；是否形成习惯要看持续记录。' },
  revision: { question: '什么证据让你改变了哪部分判断？', overview: ['保留原判断，指认变化依据，再写新判断与下一步。', '把尚未覆盖的问题交回试验和学习。'], outcome: '说明改了什么、凭什么改、接下来验证什么。', classification: '教学推演与成员实际经历分别记录，历史自述在来源区保留待确认。' },
};

const metadata: Record<string, Pick<MapNode, 'documents' | 'sources' | 'relations' | 'boundary'>> = {
  "system-view": {
    "documents": [
      {
        "id": "C-PERSPECTIVES",
        "anchor": "three-views"
      }
    ],
    "sources": [
      "L7",
      "L1",
      "L5"
    ],
    "relations": [
      {
        "map": "domain",
        "node": "rag",
        "label": "用于观察检索与生成"
      }
    ]
  },
  "development-view": {
    "documents": [
      {
        "id": "C-PERSPECTIVES",
        "anchor": "three-views"
      }
    ],
    "sources": [
      "L7",
      "L1",
      "S02",
      "S03",
      "S04",
      "L5"
    ],
    "relations": []
  },
  "third-view": {
    "documents": [
      {
        "id": "C-PERSPECTIVES",
        "anchor": "three-views"
      }
    ],
    "sources": [
      "L7",
      "L5"
    ],
    "relations": [],
    "boundary": "沿用素材中的“求真观”；课堂正式名称与原文页码仍待课件核验。"
  },
  "loss-test": {
    "documents": [
      {
        "id": "C-LOSS"
      }
    ],
    "sources": [
      "L7",
      "L5",
      "L6"
    ],
    "relations": [
      {
        "map": "domain",
        "node": "retrieval",
        "label": "检查检索交接物"
      },
      {
        "map": "domain",
        "node": "loss",
        "label": "对应损失概念"
      },
      {
        "map": "domain",
        "node": "evaluation-set",
        "label": "使用独立评测集"
      },
      {
        "map": "domain",
        "node": "finetuning",
        "label": "检验微调效果"
      }
    ]
  },
  "ranking-task": {
    "documents": [
      {
        "id": "C-RANKING"
      }
    ],
    "sources": [
      "L7",
      "L5"
    ],
    "relations": [
      {
        "map": "ecosystem",
        "node": "evaluate-model",
        "label": "对应任务验收与逐题记录"
      },
      {
        "map": "ecosystem",
        "node": "benchmarks",
        "label": "参考通用题库"
      },
      {
        "map": "domain",
        "node": "evaluation-set",
        "label": "使用课程评测集"
      }
    ]
  },
  "cost-api": {
    "documents": [
      {
        "id": "C-COST"
      }
    ],
    "sources": [
      "L7",
      "L5",
      "S21"
    ],
    "relations": [
      {
        "map": "ecosystem",
        "node": "content-cost",
        "label": "把内容核实与维护纳入投入"
      },
      {
        "map": "ecosystem",
        "node": "api-platforms",
        "label": "由 API 平台提供服务"
      },
      {
        "map": "ecosystem",
        "node": "inference-cost",
        "label": "对应推理成本"
      },
      {
        "map": "domain",
        "node": "deployment",
        "label": "对应部署选择"
      }
    ]
  },
  "define-problem": {
    "documents": [
      {
        "id": "C-HABITS"
      }
    ],
    "sources": [
      "L7",
      "L5"
    ],
    "relations": [
      {
        "map": "ecosystem",
        "node": "official-information",
        "label": "从官方入口定位原始资料"
      }
    ]
  },
  "small-trial": {
    "documents": [
      {
        "id": "C-HABITS"
      },
      {
        "id": "D-LEARNING"
      }
    ],
    "sources": [
      "L7",
      "L5",
      "L6"
    ],
    "relations": [
      {
        "map": "domain",
        "node": "evaluation-set",
        "label": "为独立问题设计保留边界"
      },
      {
        "map": "domain",
        "node": "loss",
        "label": "回查训练信号的概念"
      },
      {
        "map": "domain",
        "node": "evaluation-set",
        "label": "回查独立任务检验的概念"
      }
    ]
  },
  "weekly-review": {
    "documents": [
      {
        "id": "C-HABITS"
      },
      {
        "id": "P-UPDATES"
      }
    ],
    "sources": [
      "L7",
      "L5"
    ],
    "relations": [
      {
        "map": "ecosystem",
        "node": "content-cost",
        "label": "记录内容修订与核实投入"
      },
      {
        "map": "domain",
        "node": "monitoring",
        "label": "推动系统更新"
      },
      {
        "map": "ecosystem",
        "node": "user-feedback",
        "label": "把问题线索交给核实与修订"
      }
    ]
  },
  "revision-before": {
    "documents": [
      {
        "id": "C-REVISION"
      }
    ],
    "sources": [
      "L7",
      "L5"
    ],
    "relations": []
  },
  "revision-evidence": {
    "documents": [
      {
        "id": "C-REVISION"
      }
    ],
    "sources": [
      "L7",
      "L5"
    ],
    "relations": [
      {
        "map": "ecosystem",
        "node": "evaluate-model",
        "label": "寻找判断变化所需的逐题证据"
      }
    ]
  },
  "revision-after": {
    "documents": [
      {
        "id": "C-REVISION"
      },
      {
        "id": "P-GAPS"
      }
    ],
    "sources": [
      "L7",
      "L5"
    ],
    "relations": []
  }
};

export const cognitionRelations: ConceptRelation[] = [
  {
    "from": "system-view",
    "to": "loss-test",
    "label": "用系统拆解检查训练判断",
    "description": "拆开训练信号、回答与引用，寻找可检查的交接差异。",
    "core": true,
    "direction": "directed",
    "category": "认识视角",
    "sources": [
      "L7",
      "L5"
    ],
    "basis": "editorial"
  },
  {
    "from": "third-view",
    "to": "loss-test",
    "label": "用反例限制过宽结论",
    "description": "把独立问题的失败与原主张对照，保留证据及范围。",
    "core": true,
    "direction": "directed",
    "category": "认识视角",
    "sources": [
      "L7",
      "L5"
    ],
    "basis": "editorial"
  },
  {
    "from": "development-view",
    "to": "cost-api",
    "label": "引导演进与取舍比较",
    "description": "解释方法缓解的限制与新增条件，再比较当前路线。",
    "core": true,
    "direction": "directed",
    "category": "认识视角",
    "sources": [
      "L7",
      "L5"
    ],
    "basis": "editorial"
  },
  {
    "from": "third-view",
    "to": "define-problem",
    "label": "为任务核对证据",
    "description": "任务中的重要判断应能回到原文、版本和支持片段。",
    "core": false,
    "direction": "directed",
    "category": "认识视角",
    "sources": [
      "L7",
      "L5"
    ],
    "basis": "editorial"
  },
  {
    "from": "define-problem",
    "to": "ranking-task",
    "label": "先确定比较对象与标准",
    "description": "任务卡提供读者、材料、预期输出与评分口径。",
    "core": true,
    "direction": "directed",
    "category": "检验方法",
    "sources": [
      "L7",
      "L5"
    ],
    "basis": "editorial"
  },
  {
    "from": "define-problem",
    "to": "revision-evidence",
    "label": "保留改变判断的依据",
    "description": "将可定位的证据与原主张逐项对照。",
    "core": true,
    "direction": "directed",
    "category": "反馈修订",
    "sources": [
      "L7",
      "L5"
    ],
    "basis": "editorial"
  },
  {
    "from": "small-trial",
    "to": "loss-test",
    "label": "用逐题记录复查训练收益",
    "description": "实际试验保留环境与失败；手工演练分别标明。",
    "core": false,
    "direction": "directed",
    "category": "检验方法",
    "sources": [
      "L7",
      "L5"
    ],
    "basis": "editorial"
  },
  {
    "from": "small-trial",
    "to": "cost-api",
    "label": "保留运行与投入条件",
    "description": "比较调用、设备和人工核实时，同时记录任务质量。",
    "core": false,
    "direction": "directed",
    "category": "检验方法",
    "sources": [
      "L7",
      "L5"
    ],
    "basis": "editorial"
  },
  {
    "from": "weekly-review",
    "to": "revision-evidence",
    "label": "提供独立反馈与核实记录",
    "description": "先保存独立使用中的问题，再核对条件与原因。",
    "core": true,
    "direction": "directed",
    "category": "反馈修订",
    "sources": [
      "L7",
      "L5"
    ],
    "basis": "editorial"
  },
  {
    "from": "loss-test",
    "to": "revision-before",
    "label": "显化原有训练判断",
    "description": "若原判断把训练指标当作全部质量，先保留原句与依据；本教学初始判断不是成员真实经历。",
    "core": false,
    "direction": "directed",
    "category": "检验方法",
    "sources": [
      "L7",
      "L5"
    ],
    "basis": "editorial"
  },
  {
    "from": "ranking-task",
    "to": "revision-before",
    "label": "显化榜单选型假设",
    "description": "把“排名高就适合”写成可检查主张，而非事后重写起点；没有比较记录时仍不能宣布选型结果。",
    "core": false,
    "direction": "directed",
    "category": "检验方法",
    "sources": [
      "L7",
      "L5"
    ],
    "basis": "editorial"
  },
  {
    "from": "cost-api",
    "to": "revision-after",
    "label": "暴露未知资源条件",
    "description": "缺少用量、设备与人工记录时保留未知；缺证据不等于证明某条路线不可用。",
    "core": false,
    "direction": "directed",
    "category": "检验方法",
    "sources": [
      "L7",
      "L5"
    ],
    "basis": "editorial"
  },
  {
    "from": "revision-before",
    "to": "revision-evidence",
    "label": "对照原判断寻找变化依据",
    "description": "新依据应针对原主张的对象和范围；仅列更多资料不能说明为什么需要修正。",
    "core": true,
    "direction": "directed",
    "category": "反馈修订",
    "sources": [
      "L7",
      "L5"
    ],
    "basis": "editorial"
  },
  {
    "from": "revision-evidence",
    "to": "revision-after",
    "label": "在成立范围内更新判断",
    "description": "说清证据支持保留、撤回或增加哪些条件；教学材料不自动成为实际实验结论。",
    "core": true,
    "direction": "directed",
    "category": "反馈修订",
    "sources": [
      "L7",
      "L5"
    ],
    "basis": "editorial"
  },
  {
    "from": "revision-after",
    "to": "small-trial",
    "label": "将剩余未知交给复验",
    "description": "把新判断未覆盖的问题改写为具体的输入、检查与记录。",
    "core": true,
    "direction": "directed",
    "category": "反馈修订",
    "sources": [
      "L7",
      "L5"
    ],
    "basis": "editorial"
  },
  {
    "from": "revision-after",
    "to": "weekly-review",
    "label": "把结论变化交给复盘",
    "description": "记录修改理由、复核人和下一轮检查。",
    "core": false,
    "direction": "directed",
    "category": "反馈修订",
    "sources": [
      "L7",
      "L5"
    ],
    "basis": "editorial"
  },
  {
    "from": "define-problem",
    "to": "loss-test",
    "label": "为反例检查保留任务条件",
    "description": "把主张、支持片段和验收要求一起交给损失案例检查。",
    "core": false,
    "direction": "directed",
    "category": "检验方法",
    "sources": [
      "L7",
      "L5"
    ],
    "basis": "editorial"
  },
  {
    "from": "system-view",
    "to": "development-view",
    "label": "互补观察结构与变化",
    "description": "两种视角关注不同侧面，可以组合；无箭头表示互补，不表示其中一种是另一种的技术前置。",
    "core": false,
    "direction": "undirected",
    "category": "认识视角",
    "sources": [
      "L7",
      "L5"
    ],
    "basis": "editorial"
  },
  {
    "from": "loss-test",
    "to": "ranking-task",
    "label": "共同警惕替代指标冒充任务质量",
    "description": "训练指标和通用名次都需回到课程要求核对，但它们不是同一指标，也不要求得到相同结果。",
    "core": false,
    "direction": "undirected",
    "category": "检验方法",
    "sources": [
      "L7",
      "L5"
    ],
    "basis": "editorial"
  },
  {
    "from": "define-problem",
    "to": "small-trial",
    "label": "提供小试验的验收条件",
    "description": "明确哪些输出算满足需求，失败如何留痕；任务卡不能代替真实运行记录。",
    "core": true,
    "direction": "directed",
    "category": "检验方法",
    "sources": [
      "L7",
      "L5"
    ],
    "basis": "editorial"
  },
  {
    "from": "revision-after",
    "to": "habits",
    "label": "反哺习惯",
    "description": "把有依据的新判断转成后续执行规则，并继续复验；这里只保留原反馈方向，不宣称习惯已经形成。",
    "core": true,
    "direction": "directed",
    "category": "反馈修订",
    "sources": [
      "L7",
      "L5"
    ],
    "basis": "editorial"
  }
];

const connections: NonNullable<MapDefinition['connections']> = [
  {
    "from": "perspectives",
    "to": "analysis-methods",
    "label": "指导选方法",
    "description": "原关系图的指导方向：认识视角帮助选择具体分析方法，不是按某个视角必然得到正确答案。",
    "sources": [
      "L7",
      "L5"
    ],
    "core": true,
    "basis": "material",
    "direction": "directed",
    "category": "反馈修订"
  },
  {
    "from": "loss-test",
    "to": "revision",
    "label": "跑过后修正",
    "description": "原关系图的反馈方向：实际取得训练与独立任务记录后再修正；本页教学推演不表示已经跑完实验。",
    "sources": [
      "L7",
      "L5"
    ],
    "core": true,
    "basis": "material",
    "direction": "directed",
    "category": "反馈修订"
  },
  {
    "from": "ranking-task",
    "to": "revision",
    "label": "跑过后修正",
    "description": "原关系图的反馈方向：课程同题比较可能改变原有选型判断；还需要保存设置和逐题依据。",
    "sources": [
      "L7",
      "L5"
    ],
    "core": true,
    "basis": "material",
    "direction": "directed",
    "category": "反馈修订"
  },
  {
    "from": "cost-api",
    "to": "revision",
    "label": "跑过后修正",
    "description": "原关系图的反馈方向：取得质量、用量与投入证据后再更新取舍理由，不编造账单或收益。",
    "sources": [
      "L7",
      "L5"
    ],
    "core": true,
    "basis": "material",
    "direction": "directed",
    "category": "反馈修订"
  },
  {
    "from": "revision",
    "to": "habits",
    "label": "反哺习惯",
    "description": "原关系图的反馈方向：有依据的认识变化应影响下一轮执行规则；不自动说明习惯已经长期形成。",
    "sources": [
      "L7",
      "L5"
    ],
    "core": true,
    "basis": "material",
    "direction": "directed",
    "category": "反馈修订"
  }
];

const revisionRecords: NonNullable<MapNode['records']> = [
  {
    "title": "原素材的认识变化自述",
    "date": "素材经历与日期待确认",
    "source": "L5",
    "locator": "认识修正段落；第11、28页为素材所指课件页码",
    "text": "原材料自述曾将认知地图理解为空间认知，后对照作业说明改变理解。经历、日期、原课件及查阅记录尚待成员确认。本页另用课程助手构造教学判断，不据此替成员确认真实经历。"
  }
];

const groups = [
  ['perspectives', '三个观', 'C-PERSPECTIVES', ['system-view', 'development-view', 'third-view']],
  ['analysis-methods', '分析方法', 'C-PERSPECTIVES', ['loss-test', 'ranking-task', 'cost-api']],
  ['habits', '成长习惯', 'C-HABITS', ['define-problem', 'small-trial', 'weekly-review']],
  ['revision', '认识修正', 'C-REVISION', ['revision-before', 'revision-evidence', 'revision-after']],
] as const;
const branches: MapNode[] = groups.map(([id, title, doc, members]) => ({
  id, title, summary: topics[id].question, detail: topics[id].overview.join(' '), topic: topics[id],
  documents: [{ id: doc }], sources: ['L7', 'L5'], type: '主题',
  records: id === 'revision' ? revisionRecords : undefined,
  children: members.map((key) => ({
    id: key, ...metadata[key], ...lessons[key], detail: lessons[key].lesson.explanation[0],
    relations: metadata[key].relations?.filter((edge, index, all) => all.findIndex((item) => item.map === edge.map && item.node === edge.node) === index),
    type: id === 'perspectives' ? '认识视角' : id === 'analysis-methods' ? '分析案例' : id === 'habits' ? '成长习惯' : '认识修正',
    understanding: '待自评', verification: '待核实',
  })),
}));
export const cognitionMap: MapDefinition = {
  id: 'cognition', title: '认知地图', indexId: 'C-INDEX', number: '03', layout: 'directed',
  question: '怎样作出判断，又凭什么修正？', description: '从三个视角、三个案例到行动与修正，走完一条学习回路。',
  branches, learningPath: branches.flatMap((root) => root.children!.map((node) => node.id)),
  auxiliary: ['C-PERSPECTIVES', 'C-LOSS', 'C-RANKING', 'C-COST', 'C-HABITS', 'C-REVISION'].map((id) => ({ id })),
  connections, conceptRelations: cognitionRelations, nodeAliases: cognitionNodeAliases,
};
