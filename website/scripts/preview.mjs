import { createServer } from 'node:http';
import { readFileSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve('out');
const { basePath } = JSON.parse(readFileSync(path.join(root, '.site-build.json'), 'utf8'));
const port = Number(process.env.PORT ?? 3000);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8' };
createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400); res.end(); return; }
  if (basePath && pathname === '/') { res.writeHead(302, { Location: `${basePath}/` }); res.end(); return; }
  if (basePath && pathname !== basePath && !pathname.startsWith(`${basePath}/`)) { res.writeHead(404); res.end('Not found'); return; }
  const relative = pathname.slice(basePath.length).replace(/^\/+/, '');
  const candidate = path.resolve(root, relative);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) { res.writeHead(403); res.end(); return; }
  const file = [candidate, path.join(candidate, 'index.html')].find((f) => existsSync(f) && statSync(f).isFile());
  if (!file) { res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(readFileSync(path.join(root, '404.html'))); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? (relative.startsWith('api/search') ? 'application/json' : 'application/octet-stream') });
  res.end(readFileSync(file));
}).listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}${basePath}/`));
