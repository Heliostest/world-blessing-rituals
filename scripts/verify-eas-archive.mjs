import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const app = path.join(root, 'apps/mobile-expo');
const require = createRequire(path.join(app, 'package.json'));
const parent = path.join(root, 'artifacts');
await mkdir(parent, { recursive: true });
const task = await mkdtemp(path.join(parent, 'eas-archive-'));
const source = path.join(task, 'source');
const npmCli = process.env.npm_execpath;
if (!npmCli) throw Error('Run through npm run mobile:archive:verify so the current npm CLI is reused');
function run(cli, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], { cwd, env: { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1' }, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(Error(`${args.join(' ')} failed: ${code}`)));
  });
}
await run(require.resolve('eas-cli/bin/run'), ['build:inspect', '-p', 'ios', '-s', 'archive', '-o', source], app);
for (const file of ['package-lock.json', 'scripts/prepare-app-assets.mjs', 'content/woodfish/bundled.json',
  'assets/fonts/OFL.txt', 'assets/fonts/nunito-OFL.txt', 'assets/woodfish/bundled-v1/woodfish.glb', 'apps/mobile-expo/assets/icon.png']) {
  if (!(await stat(path.join(source, file))).size) throw Error(`Missing archive input: ${file}`);
}
await run(npmCli, ['ci'], source);
await run(npmCli, ['run', 'assets:prepare', '-w', '@wbr/mobile'], source);
await run(npmCli, ['run', 'mobile:verify'], source);
const evidence = JSON.parse(await readFile(path.join(source, 'artifacts/mobile-verification/latest.json'), 'utf8'));
await writeFile(path.join(parent, 'eas-archive-latest.json'), JSON.stringify({ at: new Date().toISOString(), source, ...evidence }, null, 2) + '\n');
console.log(`EAS upload archive installed and both platforms exported in a clean directory: ${source}`);
