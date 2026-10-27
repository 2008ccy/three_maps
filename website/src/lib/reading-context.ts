import { readFileSync } from 'node:fs';
import { getNode, source } from './source';
import { maps, flattenNodes } from './maps/content';
import { buildCatalog, buildEdges } from './maps/catalog';

export function documentStatuses() {
  return Object.fromEntries(source.getPages().map((page) => [page.data.id, page.data.status]));
}

export function sourceTitles(): Record<string, string> {
  const raw = readFileSync('content/docs/sources/index.mdx', 'utf8');
  return Object.fromEntries([...raw.matchAll(/^## ([SL]\d+)\s*\n([\s\S]*?)(?=\n## |$)/gm)].map((match) => {
    const first = match[2].trim().split('\n')[0];
    const title = first.match(/\[([^\]]+)\]/)?.[1] ?? first.replace(/\*\*/g, '');
    return [match[1], title];
  }));
}

export function readingContext(id: string) {
  const section = getNode(id).url.split('/')[2];
  const owner = maps.flatMap((map) => buildCatalog(map).map((node) => ({ map, node })))
    .filter(({ map, node }) => map.id === section && node.documents.some((ref) => ref.id === id))
    .sort((a, b) => Number(a.node.documents[0]?.id !== id) - Number(b.node.documents[0]?.id !== id) || b.node.depth - a.node.depth)[0];
  const related: { title: string; href: string; label: string }[] = [];
  const add = (title: string, href: string, label: string) => { if (!related.some((item) => item.href === href && item.label === label)) related.push({ title, href, label }); };
  if (owner) {
    for (const edge of buildEdges(owner.map)) {
      if (edge.from !== owner.node.id && !(edge.targetMap === owner.map.id && edge.to === owner.node.id)) continue;
      const outgoing = edge.from === owner.node.id;
      const targetMap = outgoing ? maps.find((map) => map.id === edge.targetMap)! : owner.map;
      const target = flattenNodes(targetMap.branches).find((node) => node.id === (outgoing ? edge.to : edge.from));
      if (target) add(target.title, `/docs/${targetMap.id}/#node-${target.id}`, outgoing ? edge.label : `来自「${target.title}」：${edge.label}`);
    }
  }
  for (const relatedId of getNode(id).data.related) {
    const page = getNode(relatedId);
    add(page.data.title, `${page.url}/`, '关联阅读');
  }
  return { owner, related };
}
