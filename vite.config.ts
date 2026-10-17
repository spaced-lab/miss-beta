// WHAT: Vite + vitest configuration for MISS β.
// WHY:  One config file keeps the dependency list at three packages (vite, typescript, vitest).
// HOW:  Relative base so the build also runs from a GitHub Pages sub-path. Tests live in tests/ and run
//       in node (no DOM); anything that needs a canvas is kept out of the pure modules. Setting
//       MISS_BENCH=1 swaps the include pattern to the timing tests in bench/ (`npm run bench`).
//       The csp() plugin injects a strict Content-Security-Policy meta tag into the PRODUCTION html only:
//       in dev it would block the HMR client and browser-extension tooling.
// LORE: C1 (how the game is built), C3 (tests and the two-language trick)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';

const bench = process.env['MISS_BENCH'] === '1';

export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

function csp(): Plugin {
  return {
    name: 'miss-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace('<meta charset="utf-8" />', `<meta charset="utf-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`);
    },
  };
}

/**
 * Dev-only screenshot sink. A page running under `vite` can POST a PNG to /__dev/shot and it lands at
 * MISS_SHOT_PATH (default .dev/shot.png). Used for automated visual checks when a browser screenshot tool
 * is unavailable. Never part of the build: apply: 'serve', same-origin localhost only, body capped at 8 MB,
 * fixed output path. Documented in docs/WARNINGS.md.
 */
function devShot(): Plugin {
  return {
    name: 'miss-dev-shot',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__dev/shot', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        // Same-origin only: the browser sends Origin on POST, so a page from any other origin on the
        // machine is refused. See docs/WARNINGS.md.
        const host = req.headers.host ?? '';
        const origin = req.headers.origin ?? '';
        const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
        if (!local || origin !== `http://${host}`) {
          res.statusCode = 403;
          res.end('dev shot: same-origin localhost only');
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        req.on('data', (c: Buffer) => {
          size += c.length;
          if (size > 8 * 1024 * 1024) req.destroy();
          else chunks.push(c);
        });
        req.on('end', () => {
          const out = resolve(process.env['MISS_SHOT_PATH'] ?? '.dev/shot.png');
          mkdirSync(dirname(out), { recursive: true });
          writeFileSync(out, Buffer.concat(chunks));
          res.setHeader('content-type', 'text/plain');
          res.end(out);
        });
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [csp(), devShot()],
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    include: bench ? ['bench/**/*.bench.ts'] : ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30000,
  },
});
