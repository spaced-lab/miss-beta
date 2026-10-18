// WHAT: Smoke test of the built site without a browser: serve dist, fetch the page, the bundle, the lore
//       index and one chunk; check the CSP meta tag, the module script and bundle size.
// WHY:  GAME_PLAN 26.3 asks for a Playwright smoke test; browsers are a 400 MB download the course does not
//       want as a dependency, so this checks what can be checked from node (see IDEAS.md for the full one).
// HOW:  `vite preview` on a random port, fetches with the global fetch, exit 1 on any failure.
// LORE: C3 (tests)
import { spawn } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';

const port = 4190 + Math.floor(Math.random() * 100);
const server = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
const base = `http://localhost:${port}`;
const fail = (msg) => {
  console.error(`smoke: FAIL ${msg}`);
  server.kill();
  process.exit(1);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  let html = '';
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`${base}/`);
      if (r.ok) {
        html = await r.text();
        break;
      }
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  if (!html) fail('preview did not answer');
  if (!/Content-Security-Policy/.test(html)) fail('no CSP meta tag');
  const m = /src="([^"]+\.js)"/.exec(html);
  if (!m) fail('no module script');
  const js = await (await fetch(new URL(m[1], `${base}/`))).text();
  if (js.length < 50000) fail(`bundle too small (${js.length})`);
  if (/\beval\(|new Function\(/.test(js)) fail('eval in bundle');
  const idx = await fetch(`${base}/lore/index.json`);
  if (!idx.ok) fail('lore index missing (run scripts/build_lore.py before build)');
  const ix = await idx.json();
  if (!Array.isArray(ix.topics) || ix.topics.length < 50) fail('lore index incomplete');
  const chunk = await fetch(`${base}/lore/${ix.topics[0].id}/BEGINNER.json`);
  if (!chunk.ok) fail('lore chunk missing');
  const size = statSync('dist/index.html').size;
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  console.log(`smoke: ok  ${pkg.name} ${pkg.version}  index ${size} B  bundle ${(js.length / 1024).toFixed(0)} KB  topics ${ix.topics.length}`);
  server.kill();
  process.exit(0);
} catch (e) {
  fail(String(e));
}
