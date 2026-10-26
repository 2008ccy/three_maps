import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

export function filesIn(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const name = path.join(dir, entry.name);
    return entry.isDirectory() ? filesIn(name) : [name];
  });
}

export function readPages() {
  return filesIn('content/docs').filter((file) => /\.mdx?$/.test(file)).map((file) => {
    const { data, content } = matter(readFileSync(file, 'utf8'));
    const slug = file.replace(/^content\/docs\//, '').replace(/\.mdx?$/, '').replace(/(^|\/)index$/, '');
    return { file, data, content, url: `/docs/${slug}`.replace(/\/$/, '') };
  });
}
