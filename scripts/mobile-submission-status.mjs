import { mkdir, writeFile } from 'node:fs/promises';
import { easSdk, getEasProjectContext } from './eas-project-context.mjs';

const { expo, eas, graphqlClient } = await getEasProjectContext();
const submissions = await easSdk('graphql/queries/SubmissionQuery.js').SubmissionQuery.forProjectStatusAsync(graphqlClient, expo.extra.eas.projectId, { limit: 20, offset: 0 });
const report = { checkedAt: new Date().toISOString(), submissions: submissions.map(s => {
  if (s.platform === 'IOS' && s.iosConfig.ascAppIdentifier !== eas.submit.production.ios.ascAppId) throw Error('Wrong App Store record');
  if (s.platform === 'ANDROID' && s.androidConfig.applicationIdentifier !== expo.android.package) throw Error('Wrong Play application');
  return { id: s.id, platform: s.platform, status: s.status, buildId: s.submittedBuild?.id, createdAt: s.createdAt, completedAt: s.completedAt, error: s.error, url: `https://expo.dev/accounts/${expo.owner}/projects/${expo.slug}/submissions/${s.id}` };
}) };
const directory = new URL('../artifacts/mobile-verification/', import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL('submissions.json', directory), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
