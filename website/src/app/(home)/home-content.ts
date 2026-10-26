import { BookOpen, Network, ScanEye } from 'lucide-react';

// 首页地图与探索路线统一在这里维护，地址沿用现有文档路由。
export const maps = [
  { id: 'domain', num: '01', name: '领域地图', question: '学什么，怎样构建？', description: '从任务、概念到工具与实践，拆开一个课程助手的构建过程。', href: '/docs/domain', icon: BookOpen },
  { id: 'ecosystem', num: '02', name: '生态地图', question: '谁在推动，如何协作？', description: '连接研究者、模型团队与开源社区，追踪技术和资源怎样流转。', href: '/docs/ecosystem', icon: Network },
  { id: 'cognition', num: '03', name: '认知地图', question: '怎样判断，如何修正？', description: '从 loss、榜单和成本出发，用证据检查判断，再修正认识。', href: '/docs/cognition', icon: ScanEye },
] as const;

export const explorationPaths = [
  {
    num: '01', title: '回答怎样找到依据？', description: '沿着一条回答的证据链，理解检索、研究来源与评测的关系。',
    steps: [
      { name: 'RAG', category: '领域 · 方法', href: '/docs/domain/entries/k-rag' },
      { name: '检索与证据排序', category: '领域 · 工具', href: '/docs/domain/entries/t-retrieval' },
      { name: 'RAG 研究者', category: '生态 · 参与者', href: '/docs/ecosystem/entries/e-rag' },
      { name: '评测案例', category: '认知 · 判断', href: '/docs/cognition/ranking' },
    ],
  },
  {
    num: '02', title: '微调后，回答真的更好了吗？', description: '从参数适配走到训练指标，看看 loss 下降究竟能说明什么。',
    steps: [
      { name: 'LoRA', category: '领域 · 方法', href: '/docs/domain/entries/k-lora' },
      { name: 'PEFT', category: '领域 · 工具', href: '/docs/domain/entries/t-peft' },
      { name: 'LoRA 研究者', category: '生态 · 参与者', href: '/docs/ecosystem/entries/e-lora' },
      { name: 'loss 案例', category: '认知 · 判断', href: '/docs/cognition/loss' },
    ],
  },
  {
    num: '03', title: '怎样兼顾效果与成本？', description: '连接部署方式、资源提供者与成本，比较一个方案是否适合当前任务。',
    steps: [
      { name: '推理与部署', category: '领域 · 实践', href: '/docs/domain/entries/k-deploy' },
      { name: 'API 平台', category: '生态 · 平台', href: '/docs/ecosystem/entries/e-api' },
      { name: '成本分摊', category: '生态 · 资源', href: '/docs/ecosystem/costs' },
      { name: '取舍案例', category: '认知 · 判断', href: '/docs/cognition/tradeoffs' },
    ],
  },
] as const;
