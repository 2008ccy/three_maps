import { ecosystemMap } from './ecosystem-learning.ts';
import { domainMap } from './domain-learning.ts';
import type { DocumentRef, MapDefinition, MapNode, MapRelation } from './types';

// 导图 ID 独立于正文 ID。改标题不会改变分享地址；同一正文可支持多个节点。
const doc = (id: string, anchor?: string): DocumentRef => ({ id, anchor });
const relation = (map: MapRelation['map'], node: string, label: string): MapRelation => ({ map, node, label });
const leaf = (id: string, title: string, summary: string, detail: string, documents: DocumentRef[], sources: string[], boundary?: string, relations?: MapRelation[]): MapNode =>
  ({ id, title, summary, detail, documents, sources, boundary, relations });
const branch = (id: string, title: string, summary: string, document: string, sources: string[], children: MapNode[]): MapNode =>
  ({ id, title, summary, detail: summary, documents: [doc(document)], sources, children });

export const maps: MapDefinition[] = [
  domainMap,
  ecosystemMap,
  {
    id: 'cognition', layout: 'directed', title: '认知地图', indexId: 'C-INDEX', number: '03',
    question: '探索和判断的方法 · 怎样理解、比较、检验',
    description: '认知地图＝探索和判断的方法。从三个观选择视角，用分析方法检验案例，再将认识修正反哺成长习惯。',
    auxiliary: [doc('C-PERSPECTIVES'), doc('C-LOSS'), doc('C-RANKING'), doc('C-COST'), doc('C-HABITS'), doc('C-REVISION')],
    connections: [
      { from: 'perspectives', to: 'analysis-methods', label: '指导选方法' },
      { from: 'loss-test', to: 'revision', label: '跑过后修正' },
      { from: 'ranking-task', to: 'revision', label: '跑过后修正' },
      { from: 'cost-api', to: 'revision', label: '跑过后修正' },
      { from: 'revision', to: 'habits', label: '反哺习惯' },
    ],
    branches: [
      branch('perspectives', '三个观', '看问题的三个侧面', 'C-PERSPECTIVES', ['L7', 'L1', 'L5'], [
        leaf('system-view', '系统观', '结构 · 瓶颈在哪一环', '回答出错时，先看资料、检索、模型和界面之间的结构与联系，再逐环保存输入输出，定位瓶颈。系统观提供观察整体的视角，具体检查可以用系统拆解与反例检查落实。', [doc('C-PERSPECTIVES', 'three-views')], ['L7', 'L1', 'L5'], '素材引用的课堂原件尚待补充。', [relation('domain', 'rag', '用于观察检索与生成')]),
        leaf('development-view', '发展观', '历史 · 新方法带来新限制', '从全参到 LoRA/QLoRA、从闭卷回答到检索增强，比较新方法缓解的限制、带来的收益与新增边界。沿演进过程理解取舍，不能仅按出现时间判断优劣。', [doc('C-PERSPECTIVES', 'three-views')], ['L7', 'L1', 'S02', 'S03', 'S04']),
        leaf('third-view', '求真观', '真伪 · 凭什么信、怎么检验', '新版关系图将第三个视角命名为求真观，关注结论的证据、检验方法与可能反例。执行时打开原文、保留反例，区分事实与推断；遇到新证据时重新判断。', [doc('C-PERSPECTIVES', 'three-views')], ['L7', 'L5'], '这里沿用新版关系图的名称；课堂正式名称与原文页码仍需对照课件核验。'),
      ]),
      branch('analysis-methods', '分析方法', '六选二到三', 'C-PERSPECTIVES', ['L7', 'L5'], [
        branch('system-analysis', '系统拆解 ＋ 反例检查', '从结构和失败例子检验判断', 'C-LOSS', ['L7', 'L5'], [
          leaf('loss-test', '案例① 损失下降 ≠ 回答更好', '把训练信号放回真实任务检查', '训练 loss 只反映当前数据与训练目标上的优化情况。先拆解资料、训练、检索和回答环节，再寻找重复、泄漏、过拟合等反例；用同一套独立问题比较正确性、引用、拒答与时延，判断训练信号是否变成实际收益。', [doc('C-LOSS')], ['L7', 'L5', 'L6'], '这是待执行的检验框架，尚无本组完成实验的证据。跑过后记录判断如何改变，再进入认识修正。', [relation('domain', 'loss', '对应损失概念'), relation('domain', 'evaluation-set', '使用独立评测集'), relation('domain', 'finetuning', '检验微调效果'), relation('cognition', 'revision', '跑过后修正')]),
        ]),
        branch('comparison', '对照比较 ＋ 问题定义', '先定义答疑任务，再比较候选', 'C-RANKING', ['L7', 'L5'], [
          leaf('ranking-task', '案例② 榜单排名 ≠ 适合答疑', '用课程问题复核通用排名', '先定义课程读者、问题类型和验收标准，再用固定的提示、检索资料与评分规则比较候选模型。通用榜单可以初筛，但解释是否易懂、引用是否支持结论、无答案时能否拒答，需要用真实课程问题重新检查。', [doc('C-RANKING')], ['L7', 'L5'], '比较框架仍需补本组实际记录；排名高不自动说明适合当前课程。', [relation('ecosystem', 'benchmarks', '参考通用题库'), relation('domain', 'evaluation-set', '使用课程评测集'), relation('cognition', 'revision', '跑过后修正')]),
        ]),
        branch('tradeoff-method', '多目标取舍 ＋ 演进分析', '沿方法演进比较收益与新限制', 'C-COST', ['L7', 'L5'], [
          leaf('cost-api', '案例③ 效果与成本的取舍', '质量、时延、费用与维护一起比较', '比较 API 加检索、本地模型、自托管 GPU 和 LoRA/QLoRA 等方案，记录任务质量、时延、用量、设备与维护代价。再沿方法演进分析：新方案解决了什么限制，又增加了什么成本，从而说明当前条件下的选择。', [doc('C-COST')], ['L7', 'L5', 'S21'], '当前没有实测账单，不给出确定费用；适配参数更少也不能直接证明端到端总成本最低。', [relation('ecosystem', 'api-platforms', '由 API 平台提供服务'), relation('ecosystem', 'inference-cost', '对应推理成本'), relation('domain', 'deployment', '对应部署选择'), relation('cognition', 'revision', '跑过后修正')]),
        ]),
      ]),
      branch('habits', '成长习惯', '六类', 'C-HABITS', ['L7', 'L5'], [
        leaf('define-problem', '先定义问题', '选工具前写一张任务卡', '记录读者、困难、输入输出和验收条件。范围变化时保留修改原因，用任务卡检查后续工作是否仍在解决同一个问题。', [doc('C-HABITS')], ['L7', 'L5']),
        leaf('check-evidence', '找依据和反例', '为判断保留出处与条件', '重要结论打开原文，留下页码、支持条件和可能改变判断的反例。找不到依据时明确标记待核实。', [doc('C-HABITS')], ['L7', 'L5']),
        leaf('small-trial', '小规模试跑', '先用少量资料跑通一轮', '保存环境、输入输出、成功与失败记录。先确认任务能够端到端运行，再判断需要扩大数据、模型或服务规模。', [doc('C-HABITS')], ['L7', 'L5']),
        leaf('learn-from-gaps', '从困难反查知识', '知识缺口连接到课程和再尝试', '把讲不清或做不出的点写出来，选择对应教程或课程，学后回到同一个小任务复验，避免只积累学习清单。', [doc('C-HABITS'), doc('D-LEARNING')], ['L7', 'L5', 'L6']),
        leaf('weekly-review', '每周分工与检查', '谁修改、谁复核、何时发布', '每周留下简短的修改说明、负责人和复核记录。完成与待办要以产物和检查结果区分，不只写“已经学习”。', [doc('C-HABITS'), doc('P-UPDATES')], ['L7', 'L5']),
        leaf('independent-feedback', '独立反馈再修订', '让非组员先自行使用', '先观察同学能否独立完成查询，再解释和讨论。保留原始问题、核实过程、处理结果与理由，让反馈成为可追踪的修订。', [doc('C-HABITS')], ['L7', 'L5'], '这些是执行规则，尚无记录的项目不能称为已经形成的习惯。认识修正得到的经验还应反过来修改这些规则。', [relation('domain', 'monitoring', '推动系统更新')]),
      ]),
      branch('revision', '认识修正', '四问', 'C-REVISION', ['L7', 'L5'], [
        leaf('revision-before', '原来怎样理解', '先说清旧判断与当时的依据', '素材自述曾把课程中的认知地图理解为空间认知与心理学意义上的 cognitive map，因此搜集了不同方向的材料。技术案例也应先记录原来的判断，而不是事后重写起点。', [doc('C-REVISION')], ['L7', 'L5'], '经历与日期仍需相关成员确认。'),
        leaf('revision-evidence', '什么带来变化', '指出改变判断的具体证据', '素材案例通过对照作业说明及所指课件第 11、28 页改变理解。技术案例则应保留实际比较、失败样例和新证据，说明它们怎样影响判断。', [doc('C-REVISION')], ['L7', 'L5'], '原课件与查阅记录尚待补充。'),
        leaf('revision-after', '现在怎样理解', '说明新判断及资料边界的变化', '用损失、榜单和成本等问题组织案例，说明如何提出问题、依据什么判断，以及怎样检验和修正。定义、案例和资料筛选随之调整，并将经验反哺成长习惯。', [doc('C-REVISION')], ['L7', 'L5'], undefined, [relation('cognition', 'habits', '反哺习惯')]),
        leaf('revision-open', '仍不知道什么', '把未确认的地方留在图上', '第三个观的课堂正式名称、课堂原文，以及技术实验能否带来新的认识修正，都需要后续核实或实践。未经确认的自述不能当作已完成的真实经历提交。', [doc('C-REVISION'), doc('P-GAPS')], ['L7', 'L5']),
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
