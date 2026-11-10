import { maps, flattenNodes } from './content';
import { buildEdges } from './catalog';
import type { MapKey } from './types';

export type AtlasNode = { id: string; map: MapKey; title: string; caption: string; href: string; row: number; column: number };
export type AtlasEdge = { from: string; to: string; label: string };

// Each row follows one course-assistant decision across the three maps.
const selected = {
  domain: [['rag', 'RAG'], ['finetuning', '监督微调 SFT'], ['deployment', '部署']],
  ecosystem: [['research-origins', '研究贡献'], ['huggingface', '开源工具协作'], ['api-platforms', '托管模型 API']],
  cognition: [['system-view', '系统观'], ['loss-test', '损失与答疑质量'], ['cost-api', '效果与成本取舍']],
} as const;

export function taskAtlas() {
  const nodes = maps.flatMap((map, column) => {
    const entries = flattenNodes(map.branches);
    return selected[map.id].map(([id, title], row): AtlasNode => {
      const node = entries.find((item) => item.id === id);
      if (!node) throw new Error(`Missing atlas node: ${map.id}/${id}`);
      return { id, map: map.id, title, caption: node.title, href: `/docs/${map.id}/#node-${id}`, row, column };
    });
  });
  const edges: AtlasEdge[] = [];
  for (const map of maps) for (const edge of buildEdges(map)) {
    if (!nodes.some((n) => n.id === edge.from && n.map === map.id) ||
        !nodes.some((n) => n.id === edge.to && n.map === edge.targetMap)) continue;
    if (!edges.some((e) => (e.from === edge.from && e.to === edge.to) || (e.from === edge.to && e.to === edge.from)))
      edges.push({ from: edge.from, to: edge.to, label: edge.label });
  }
  return { nodes, edges };
}
