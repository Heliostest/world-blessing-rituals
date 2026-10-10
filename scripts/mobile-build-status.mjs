import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../apps/mobile-expo/package.json',import.meta.url));
const app = fileURLToPath(new URL('../apps/mobile-expo/',import.meta.url));
const cli = require.resolve('eas-cli/bin/run');
const {expo} = JSON.parse(await readFile(new URL('../apps/mobile-expo/app.json',import.meta.url),'utf8'));
const output = await new Promise((resolve,reject) => {
  let result='';
  const child=spawn(process.execPath,[cli,'build:list','--json','--non-interactive','--limit','10'],{cwd:app,stdio:['ignore','pipe','inherit']});
  child.stdout.on('data',bytes => {result+=bytes;}); child.on('error',reject);
  child.on('exit',code => code===0?resolve(result):reject(Error(`EAS exited ${code}`)));
});
const builds = JSON.parse(output).map(build => {
  if (build.app.id!==expo.extra.eas.projectId || build.appIdentifier!==(build.platform==='IOS'?expo.ios.bundleIdentifier:expo.android.package)) throw Error('Application identity mismatch');
  return {id:build.id,platform:build.platform,profile:build.buildProfile,status:build.status,version:build.appVersion,buildNumber:build.appBuildVersion,createdAt:build.createdAt,completedAt:build.completedAt ?? null,url:`https://expo.dev/accounts/${expo.owner}/projects/${expo.slug}/builds/${build.id}`,artifact:build.artifacts.applicationArchiveUrl ?? build.artifacts.buildUrl ?? null};
});
const directory=new URL('../artifacts/mobile-verification/',import.meta.url);
await mkdir(directory,{recursive:true});
const report={checkedAt:new Date().toISOString(),projectId:expo.extra.eas.projectId,builds};
await writeFile(new URL('cloud-builds.json',directory),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
