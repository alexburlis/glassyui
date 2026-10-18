const needs = JSON.parse(process.env.CI_NEEDS);

const event = process.env.CI_EVENT;

const scope = needs.changes?.outputs;

if (!['pull_request', 'push', 'workflow_dispatch'].includes(event)) {
  throw new Error(`The release gate needs a known CI event; observed ${event}`);
}

if (needs.changes?.result !== 'success' || needs['site-checks']?.result !== 'success') {
  throw new Error('Changed-input routing and site checks must both succeed');
}

if (
  !['site', 'visual', 'native', 'theme', 'dropins'].every((key) =>
    ['true', 'false'].includes(scope?.[key]),
  )
) {
  throw new Error('Verification selection must contain explicit boolean outputs');
}

if (
  scope.site === 'false' &&
  ['visual', 'native', 'theme', 'dropins'].some((key) => scope[key] === 'true')
) {
  throw new Error('Expensive verification requires site checks');
}

// The release sweep runs only when dispatched by hand, each part in its own job.
const release = event === 'workflow_dispatch';

for (const [job, selected] of [
  ['install-smoke', scope.visual === 'true' && !release],
  ['native-consumer', scope.native === 'true'],
  ['shadcn-consumers', scope.theme === 'true' || scope.dropins === 'true'],
  ['release-smokes', release],
  ['release-install', release],
  ['release-visuals', release],
  ['release-material', release],
  ['release-ui', release],
]) {
  const result = needs[job]?.result;

  if (result !== 'success' && (selected || result !== 'skipped')) {
    throw new Error(`${job} must succeed when selected; observed ${result}`);
  }
}

console.log('Release gate passed: all selected verification owners succeeded.');
