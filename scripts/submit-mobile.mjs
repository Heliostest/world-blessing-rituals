import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { verifyStoreBuild } from './mobile-build-guard.mjs';
import { easSdk, getEasProjectContext } from './eas-project-context.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const app = path.join(root, 'apps/mobile-expo');
const require = createRequire(path.join(app, 'package.json'));
const cli = require.resolve('eas-cli/bin/run');
const [platform, id] = process.argv.slice(2);
if (!['ios', 'android'].includes(platform) || !/^[a-f0-9-]{36}$/.test(id ?? ''))
  throw Error('Usage: npm run mobile:eas:submit:ios -- <EAS build UUID> (or android)');
const { expo } = JSON.parse(await readFile(path.join(app, 'app.json'), 'utf8'));
const eas = JSON.parse(await readFile(path.join(app, 'eas.json'), 'utf8'));
if (platform === 'ios' && !eas.submit?.production?.ios?.ascAppId) throw Error('Missing this application ascAppId');
function run(args, capture = false) {
  return new Promise((resolve, reject) => {
    let output = '';
    const child = spawn(process.execPath, [cli, ...args], { cwd: app, stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit' });
    child.stdout?.on('data', bytes => { output += bytes; });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve(output) : reject(Error(`EAS exited ${code}`)));
  });
}
const build = JSON.parse(await run(['build:view', id, '--json'], true));
const identifier = verifyStoreBuild(build, expo, platform);
const { graphqlClient } = await getEasProjectContext();
const submissions = await easSdk('graphql/queries/SubmissionQuery.js').SubmissionQuery.forProjectStatusAsync(graphqlClient, expo.extra.eas.projectId, { limit: 100, offset: 0 });
if (submissions.some(s => s.submittedBuild?.id === id && !['CANCELED', 'ERRORED'].includes(s.status)))
  throw Error('This build already has a successful or active submission. Inspect mobile:eas:submissions before uploading again.');
console.log(`Submitting verified ${identifier} ${build.appVersion} (${build.appBuildVersion}), build ${id}`);
await run(['submit', '-p', platform, '--profile', 'production', '--id', id,
  ...(process.argv.includes('--non-interactive') ? ['--non-interactive'] : [])]);
