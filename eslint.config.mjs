import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitalsConfig from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const nextVitals = nextVitalsConfig.map((config) => ({
  ...config,
  rules: Object.fromEntries(
    Object.entries(config.rules ?? {}).filter(([rule]) => !rule.startsWith('react/')),
  ),
}));

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    'git-worktrees/**',
    'tools/oxlint/anti-slop/**',
    // Generated evidence and browser-agent scratch files are not application source.
    '.artifacts/**',
    // Stock shadcn/ui apps written by the shadcn CLI; they are kept as generated.
    'fixtures/shadcn-theme-consumer/**',
    '.playwright-mcp/**',
    'docs/seo/28day-*/**',
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'research/**',
  ]),
]);

export default eslintConfig;
