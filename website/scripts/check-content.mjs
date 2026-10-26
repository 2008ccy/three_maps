import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { filesIn, readPages } from './content-utils.mjs';

const pages = readPages();
const ids = new Set();
const errors = [];
const routes = new Set(pages.map((page) => page.url));
const sourcePage = pages.find((page) => page.data.id === 'P-SOURCES');
const refs = new Set([...sourcePage.content.matchAll(/^## ([SL]\d+)$/gm)].map((m) => m[1]));
for (const { file, data } of pages) {
  for (const key of ['id', 'title', 'description', 'updated', 'status']) {
    if (typeof data[key] !== 'string' || !data[key]) errors.push(`${file}: missing ${key}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.updated)) errors.push(`${file}: date must be YYYY-MM-DD`);
  if (ids.has(data.id)) errors.push(`${file}: duplicate ID ${data.id}`);
  ids.add(data.id);
  if (!Array.isArray(data.related)) errors.push(`${file}: related must be an array`);
}
for (const { file, data, content } of pages) {
  const targets = [...(data.related ?? []), ...[...content.matchAll(/node:([A-Z][A-Z0-9-]+)/g)].map((m) => m[1])];
  for (const match of content.matchAll(/<NodeGrid ids=\{(\[[^\]]*\])\}/g)) targets.push(...JSON.parse(match[1]));
  for (const id of targets) if (!ids.has(id)) errors.push(`${file}: unknown ID ${id}`);
  for (const match of content.matchAll(/ref:([SL]\d+)/g)) if (!refs.has(match[1])) errors.push(`${file}: missing source ${match[1]}`);
  for (const match of content.matchAll(/\]\(([^\s)]+)\)/g)) {
    const href = match[1];
    if (/^(https?:|mailto:|node:|ref:|#)/.test(href)) continue;
    if (href.startsWith('/images/') || href.startsWith('/sources/')) {
      if (!existsSync(`public${href}`)) errors.push(`${file}: missing local asset ${href}`);
    } else if (href.startsWith('/docs')) {
      if (!routes.has(href.split('#')[0].replace(/\/$/, ''))) errors.push(`${file}: missing page ${href}`);
    } else errors.push(`${file}: use a node: ID or an absolute /docs link: ${href}`);
  }
}
for (const file of filesIn('content/docs').filter((f) => f.endsWith('meta.json'))) {
  const meta = JSON.parse(readFileSync(file, 'utf8'));
  for (const entry of meta.pages ?? []) {
    if (typeof entry !== 'string' || !/^[a-z0-9-]+$/.test(entry)) continue;
    const dest = path.join(path.dirname(file), entry);
    if (![dest, `${dest}.md`, `${dest}.mdx`].some(existsSync)) errors.push(`${file}: missing navigation entry ${entry}`);
  }
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`Content OK: ${pages.length} pages, ${ids.size} unique IDs, ${refs.size} source anchors.`);
