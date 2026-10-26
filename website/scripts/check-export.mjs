import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { load } from 'cheerio';
import { filesIn, readPages } from './content-utils.mjs';

const root = path.resolve('out');
const { basePath } = JSON.parse(readFileSync('out/.site-build.json', 'utf8'));
const errors = [];
const htmlFiles = filesIn(root).filter((file) => file.endsWith('.html'));
const cache = new Map();
function document(file) {
  if (!cache.has(file)) cache.set(file, load(readFileSync(file, 'utf8')));
  return cache.get(file);
}
function locate(relative) {
  const p = path.join(root, relative);
  return [p, path.join(p, 'index.html'), `${p}.html`].find((file) => existsSync(file) && statSync(file).isFile());
}
for (const { url } of readPages()) if (!locate(url)) errors.push(`Not exported: ${url}`);
let links = 0;
for (const file of htmlFiles) {
  const $ = document(file);
  const route = path.relative(root, file).replace(/index\.html$/, '');
  const current = `https://local.test${basePath}/${route}`;
  for (const element of $('a[href], img[src], script[src], link[href]').toArray()) {
    const href = $(element).attr('href') ?? $(element).attr('src');
    if (!href || /^(mailto:|tel:|data:|javascript:)/.test(href)) continue;
    const target = new URL(href, current);
    if (target.origin !== 'https://local.test') continue;
    links++;
    if (basePath && target.pathname !== basePath && !target.pathname.startsWith(`${basePath}/`)) {
      errors.push(`${route}: missing deployment prefix: ${href}`); continue;
    }
    const resolved = locate(decodeURIComponent(target.pathname.slice(basePath.length)));
    if (!resolved) { errors.push(`${route}: missing file: ${href}`); continue; }
    if (target.hash && resolved.endsWith('.html')) {
      const id = decodeURIComponent(target.hash.slice(1));
      if (!document(resolved)('[id]').toArray().some((el) => document(resolved)(el).attr('id') === id)) errors.push(`${route}: missing anchor: ${href}`);
    }
  }
  if ($('a[href^="node:"], a[href^="ref:"]').length) errors.push(`${route}: unresolved content reference`);
}
if (errors.length) { console.error([...new Set(errors)].join('\n')); process.exit(1); }
console.log(`Export OK: ${htmlFiles.length} HTML files, ${links} links/assets checked, basePath=${basePath || '/'}.`);
