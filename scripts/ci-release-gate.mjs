const needs = JSON.parse(process.env.CI_NEEDS);

const scope = needs.changes?.outputs;

if (needs.changes?.result !== 'success' || needs['site-checks']?.result !== 'success') {
  throw new Error('Changed-input routing and site checks must both succeed');
}

if (!['native', 'theme', 'dropins'].every((key) => ['true', 'false'].includes(scope?.[key]))) {
  throw new Error('Consumer selection must contain explicit boolean outputs');
}

for (const [job, selected] of [
  ['native-consumer', scope.native === 'true'],
  ['shadcn-consumers', scope.theme === 'true' || scope.dropins === 'true'],
]) {
  const result = needs[job]?.result;

  if (result !== 'success' && (selected || result !== 'skipped')) {
    throw new Error(`${job} must succeed when selected; observed ${result}`);
  }
}

console.log('Release gate passed: all selected verification owners succeeded.');
