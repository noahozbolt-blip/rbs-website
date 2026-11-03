import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'dist');
const { build } = await import('esbuild');
await build({ entryPoints: [resolve(root, 'portal/app.mjs')], bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true, outfile: resolve(root, 'portal/app.js') });
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
const names = await readdir(root);
for (const name of names.filter(name => name.endsWith('.html') || ['assets', '3d', 'downloads', 'portal', 'robots.txt', 'sitemap.xml', 'favicon.ico', 'favicon-16x16.png', 'favicon-32x32.png', 'apple-touch-icon.png'].includes(name))) {
  await cp(resolve(root, name), resolve(out, name), { recursive: true });
}
await rm(resolve(out, 'portal/app.mjs'), { force: true });
// Exact static files keep Netlify Pretty URLs. Unknown routes remain real 404s.
await writeFile(resolve(out, '_redirects'), '/index / 301\n');
console.log(JSON.stringify({ publish: 'dist', staticFilesOnly: true }));
