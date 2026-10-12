import http from 'node:http';
import path from 'node:path';
import { readFile, readdir, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { build, root } from './build.mjs';

const output = path.join(root, '.preview');
const port = Number(process.env.PORT || 3005);
const instanceId = randomUUID();
let revision = 0;

async function alreadyRunning() {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/__preview_version`, { signal: AbortSignal.timeout(1500) });
    return response.ok && response.headers.get('X-Samirbuilds-Preview') === '1';
  } catch { return false; }
}
function showExistingServer() {
  console.log(`Your website is already running at http://localhost:${port}`);
  console.log('Save your edits with Command-S. The browser updates automatically; refresh once if it is an older page.');
}
if (await alreadyRunning()) { showExistingServer(); process.exit(0); }

let signature = '';
let pending;
async function fingerprint(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const parts = await Promise.all(entries.sort((a, b) => a.name.localeCompare(b.name)).map(async entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? fingerprint(file) : `${file}:${(await stat(file)).mtimeMs}`;
  }));
  return parts.join('|');
}
async function refresh() {
  if (pending) return pending;
  pending = (async () => {
    const next = (await Promise.all(['content', 'posts', 'public', 'fonts'].map(folder => fingerprint(path.join(root, folder))))).join('|');
    if (next !== signature) { await build({ includeDrafts: true, outputDir: output }); signature = next; revision++; }
  })();
  try { await pending; } finally { pending = undefined; }
}
await refresh();
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
function liveReload(version) {
  return `<script>
(() => {
  const version = ${JSON.stringify(version)};
  let warning;
  async function check() {
    try {
      const response = await fetch('/__preview_version', { cache: 'no-store' });
      if (!response.ok) {
        if (!warning) {
          warning = document.createElement('div');
          warning.setAttribute('role', 'alert');
          warning.style.cssText = 'position:fixed;bottom:16px;left:16px;right:16px;z-index:1000;background:#fff3ef;color:#7d2920;border:1px solid #edc9bd;padding:16px;border-radius:6px;font:14px/1.5 system-ui;max-height:35vh;overflow:auto';
          document.body.appendChild(warning);
        }
        warning.textContent = await response.text();
      } else {
        if (warning) { warning.remove(); warning = undefined; }
        const next = await response.json();
        if (next.version !== version) { location.reload(); return; }
      }
    } catch { /* Keep the current page visible during a server restart. */ }
    setTimeout(check, 1000);
  }
  setTimeout(check, 1000);
})();
</script>`;
}
const server = http.createServer(async (request, response) => {
  try {
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end('Method not allowed'); return; }
    await refresh();
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/__preview_version') {
      response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Samirbuilds-Preview': '1' });
      response.end(JSON.stringify({ version: `${instanceId}:${revision}` }));
      return;
    }
    let file = path.resolve(output, `.${pathname}`);
    if (file !== output && !file.startsWith(`${output}${path.sep}`)) { response.writeHead(403); response.end('Forbidden'); return; }
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    let data = await readFile(file);
    if (path.extname(file) === '.html') data = data.toString().replace('</body>', `${liveReload(`${instanceId}:${revision}`)}</body>`);
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(request.method === 'HEAD' ? undefined : data);
  } catch (error) {
    const missing = error.code === 'ENOENT';
    response.writeHead(missing ? 404 : 500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(missing ? 'Page not found' : `Preview build failed: ${error.message}`);
    if (!missing) console.error(error.message);
  }
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Local: http://localhost:${port}`);
  console.log('Draft posts are visible locally. Save your edits with Command-S; the browser updates automatically.');
});
server.on('error', async error => {
  if (error.code === 'EADDRINUSE' && await alreadyRunning()) { showExistingServer(); process.exit(0); }
  console.error(error.code === 'EADDRINUSE' ? `Port ${port} is busy with another application. Run PORT=3006 node server.js.` : error);
  process.exit(1);
});
