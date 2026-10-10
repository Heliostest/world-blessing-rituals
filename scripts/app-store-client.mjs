import { sign } from 'node:crypto';
import { easSdk, getEasProjectContext } from './eas-project-context.mjs';

export async function getOwnAppStoreClient() {
  const context = await getEasProjectContext();
  const resolved = await easSdk('credentials/ios/actions/AscApiKeyUtils.js').resolveAscApiKeyForAppCredentialsAsync(context);
  if (!resolved?.ascApiKey.issuerId) throw Error('Assign a team App Store Connect API key through EAS credentials first');
  if (resolved.teamId && resolved.teamId !== context.expo.ios.appleTeamId) throw Error('Apple Team mismatch');
  const key = resolved.ascApiKey;
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = `${encode({ alg: 'ES256', kid: key.keyId, typ: 'JWT' })}.${encode({ iss: key.issuerId, iat: now, exp: now + 1100, aud: 'appstoreconnect-v1' })}`;
  const token = `${payload}.${sign('sha256', Buffer.from(payload), { key: key.keyP8, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
  const sdkFetch = easSdk('Fetch.js').default;
  const fetch = async (url, options) => {
    try { return await sdkFetch(url, options); }
    catch (error) {
      if (error.response) return error.response;
      throw Error('App Store Connect network request failed; no credentials logged');
    }
  };
  async function request(path, options = {}) {
    if (!path.startsWith('/v1/')) throw Error('Only official App Store Connect API paths are supported');
    const response = await fetch(`https://api.appstoreconnect.apple.com${path}`, { method: options.method ?? 'GET', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(options.body ? { body: JSON.stringify(options.body) } : {}), timeout: 45000 });
    if (response.status === 204) return {};
    const body = await response.json();
    if (!response.ok) throw Error(`Apple API ${response.status}: ${(body.errors ?? []).map(e => `${e.code}: ${e.detail ?? e.title}`).join('; ')}`);
    return body;
  }
  const appId = context.eas.submit.production.ios.ascAppId;
  const ownApp = (await request(`/v1/apps/${appId}`)).data;
  if (ownApp.attributes.bundleId !== context.expo.ios.bundleIdentifier || ownApp.attributes.sku !== context.eas.submit.production.ios.sku) throw Error('App Store application identity mismatch');
  return { ...context, request, fetch, appId, ownApp };
}
