import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const app = fileURLToPath(new URL('../apps/mobile-expo/', import.meta.url));
const require = createRequire(new URL('../apps/mobile-expo/package.json', import.meta.url));
const {expo} = JSON.parse(await readFile(new URL('../apps/mobile-expo/app.json',import.meta.url),'utf8'));
const child = spawn(process.execPath,[require.resolve('eas-cli/bin/run'),...process.argv.slice(2)],{
  cwd:app, stdio:'inherit', env:{...process.env,EXPO_APPLE_TEAM_ID:expo.ios.appleTeamId,EXPO_APPLE_TEAM_TYPE:'INDIVIDUAL'}
});
child.on('error', error => { console.error(error.message); process.exitCode=1; });
child.on('exit', code => { process.exitCode=code ?? 1; });
