import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Unit tests live in src/__tests__ — eval/ contains benchmark suites, not CI tests.
    exclude: [...configDefaults.exclude, '**/eval/**'],
  },
});
