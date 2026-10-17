// WHAT: Vite + vitest configuration for MISS β.
// WHY:  One config file keeps the dependency list at three packages (vite, typescript, vitest).
// HOW:  Relative base so the build also runs from a GitHub Pages sub-path. Tests live in tests/ and
//       bench/ and run in node (no DOM); anything that needs a canvas is kept out of the pure modules.
// LORE: C1 (how the game is built), C3 (tests and the two-language trick)
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    benchmark: { include: ['bench/**/*.bench.ts'] },
    environment: 'node',
  },
});
