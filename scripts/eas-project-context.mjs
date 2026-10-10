import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// EAS SDK access is pinned with the CLI in the lockfile. Credentials stay in memory.
const require = createRequire(new URL('../apps/mobile-expo/package.json', import.meta.url));
const base = dirname(require.resolve('eas-cli/package.json'));
export const easSdk = path => require(join(base, 'build', path));
export async function getEasProjectContext() {
  if (require(join(base, 'package.json')).version !== '24.12.1') throw Error('Review SDK integration before changing eas-cli version');
  const projectDir = fileURLToPath(new URL('../apps/mobile-expo/', import.meta.url));
  const { expo } = JSON.parse(await readFile(join(projectDir, 'app.json'), 'utf8'));
  const eas = JSON.parse(await readFile(join(projectDir, 'eas.json'), 'utf8'));
  const analytics = { setActor() {}, logEvent() {}, recordEvent() {} };
  const SessionManager = easSdk('user/SessionManager.js').default;
  const { actor, authenticationInfo } = await new SessionManager(analytics).ensureLoggedInAsync({ nonInteractive: true });
  const graphqlClient = easSdk('commandUtils/context/contextUtils/createGraphqlClient.js').createGraphqlClient(authenticationInfo);
  const { CredentialsContext } = easSdk('credentials/context.js');
  const ctx = new CredentialsContext({ projectDir, user: actor, graphqlClient, analytics, projectInfo: { exp: expo, projectId: expo.extra.eas.projectId }, nonInteractive: true });
  const app = await easSdk('credentials/ios/actions/BuildCredentialsUtils.js').getAppLookupParamsFromContextAsync(ctx, { targetName: 'CyberBless', bundleIdentifier: expo.ios.bundleIdentifier, entitlements: {} });
  if (app.account.name !== expo.owner || eas.submit.production.ios.bundleIdentifier !== expo.ios.bundleIdentifier) throw Error('Expo owner or application identity mismatch');
  return { expo, eas, ctx, app, graphqlClient };
}
