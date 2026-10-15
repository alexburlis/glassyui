import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const [event, base, head, ...extra] = process.argv.slice(2);

if (extra.length || !['pull_request', 'push', 'workflow_dispatch'].includes(event)) {
  throw new Error('Expected pull_request, push or workflow_dispatch and two full Git revisions');
}

if (![base, head].every((revision) => /^[a-f0-9]{40}$/.test(revision ?? ''))) {
  throw new Error('CI scope requires full base/head Git revisions');
}

// Disable rename detection so both the deleted and added path select coverage.
const revisions = event === 'pull_request' ? [`${base}...${head}`] : [base, head];

const changedFiles = execFileSync(
  'git',
  ['diff', '--name-only', '--no-renames', '-z', ...revisions, '--'],
  { encoding: 'utf8' },
)
  .split('\0')
  .filter(Boolean);

const scope = { site: false, visual: false, native: false, theme: false, dropins: false };

const documentation =
  /^(?:README|CONTRIBUTING|AGENTS|SECURITY|CODE_OF_CONDUCT|THIRD_PARTY_NOTICES)\.md$|^LICENSE$|^docs\/.*\.md$|^\.github\/ISSUE_TEMPLATE\//;

for (const file of changedFiles) {
  if (documentation.test(file)) continue;

  scope.site = true;

  if (file === 'scripts/smoke-registry-install.mjs') {
    scope.visual = true;
    continue;
  }

  // These paths are covered by the static, served and consent/error base checks.
  if (
    /^(?:src\/lib\/(?:analytics|diagnostics)\/|src\/components\/site\/analytics-consent\.tsx$|src\/app\/api\/analytics-config\/route\.ts$)/.test(
      file,
    ) ||
    /^scripts\/(?:check-(?:agent-discovery|analytics-consent|error-reports|generated-registry|registry)|smoke-(?:docs-routes|launch|pro-links|registry-routes)|test-(?:analytics-consent|braces-security|build-upload|error-startup|server-error-reports))\.mjs$/.test(
      file,
    )
  ) {
    continue;
  }

  if (
    /^(?:registry\/glassyui-native\/|public\/r\/native\/|fixtures\/expo-consumer\/)/.test(file) ||
    /^(?:registry-native\.json|scripts\/(?:check-native-registry|smoke-expo-consumer)\.mjs)$/.test(
      file,
    )
  ) {
    scope.native = true;
    scope.visual ||= file.startsWith('fixtures/expo-consumer/usage/');
    continue;
  }

  if (
    /^(?:registry\/glassyui\/themes\/|registry\/glassyui\/lib\/|registry\/glassyui\/styles\/|fixtures\/shadcn-theme-consumer\/)/.test(
      file,
    ) ||
    /^(?:scripts\/(?:build-shadcn-theme|shadcn-theme-lens|check-shadcn-theme)\.mjs|registry\.json|public\/r\/registry\.json|public\/r\/glassy-theme\.json)$/.test(
      file,
    )
  ) {
    scope.visual = scope.theme = scope.dropins = true;
    continue;
  }

  if (
    file.startsWith('registry/glassyui-shadcn/') ||
    file === 'registry/glassyui/glassy-engine.tsx' ||
    /^public\/r\/glassy-ui-.*\.json$/.test(file)
  ) {
    scope.visual = scope.dropins = true;
    continue;
  }

  if (file.startsWith('src/lib/liquid/')) {
    scope.visual = scope.theme = scope.dropins = true;
    continue;
  }

  if (
    /^(?:src\/|public\/|registry\/glassyui\/|fixtures\/shadcn-consumer\/|link-previews\/)/.test(
      file,
    )
  ) {
    scope.visual = true;
    continue;
  }

  // Toolchain/CI changes and new, unclassified inputs select every owner.
  scope.visual = scope.native = scope.theme = scope.dropins = true;
}

if (event === 'workflow_dispatch' || changedFiles.length === 0) {
  scope.site = scope.visual = scope.native = scope.theme = scope.dropins = true;
}

if (event === 'push') {
  // Protected main accepts only a verified PR or exact locally verified candidate.
  // Rerun its cheap final-source checks without repeating pre-merge consumers.
  scope.visual = scope.native = scope.theme = scope.dropins = false;
}

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(
    process.env.GITHUB_OUTPUT,
    Object.entries(scope)
      .map(([key, value]) => `${key}=${value}\n`)
      .join(''),
  );
}

console.log(JSON.stringify({ ...scope, changedFiles }, null, 2));
