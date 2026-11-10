import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { buildCatalog, understandingOptions } from '../src/lib/maps/catalog.ts';
import { maps } from '../src/lib/maps/content.ts';
import { readPages } from './content-utils.mjs';

const documents = Object.fromEntries(readPages().map(({ data }) => [data.id, data.status]));
const cards = maps.flatMap((map) => buildCatalog(map, documents).map((node) => ({
  map: map.id, mapTitle: map.title, node: node.id, title: node.title, original: node.understanding,
})));
const manifest = { statuses: understandingOptions, cards };
const file = 'card-editor/manifest.json';
if (process.argv.includes('--write')) {
  writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
} else {
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), manifest, '卡片清单已过期，请运行 npm run cards:sync。');
}

const keys = new Set(cards.map(({ map, node }) => map + ':' + node));
const overrides = JSON.parse(readFileSync('card-editor/overrides.json', 'utf8'));
assert.ok(overrides && typeof overrides === 'object' && !Array.isArray(overrides), '学习状态文件必须是 JSON 对象。');
for (const [key, value] of Object.entries(overrides)) {
  assert.ok(keys.has(key) && understandingOptions.includes(value), '无效的卡片或学习状态：' + key);
}
console.log(`卡片清单与网站一致，共 ${cards.length} 张。`);
