import { readFile } from 'node:fs/promises';
import { getOwnAppStoreClient } from './app-store-client.mjs';

const id = process.argv[2];
if (!/^[a-f0-9-]{36}$/.test(id ?? '')) throw Error('Pass the explicit Apple build UUID (not an EAS build UUID)');
const c = await getOwnAppStoreClient();
const builds = await c.request(`/v1/builds?filter[app]=${c.appId}&include=preReleaseVersion&limit=200`);
const build = builds.data.find(b => b.id === id);
const version = builds.included?.find(r => r.id === build?.relationships.preReleaseVersion.data.id);
if (!build || build.attributes.processingState !== 'VALID' || version?.attributes.version !== c.expo.version) throw Error('Build is not valid for this application/version');
const listing = JSON.parse(await readFile(new URL('../store/ios/zh-Hans.json', import.meta.url), 'utf8'));
const current = (await c.request(`/v1/builds/${id}/betaBuildLocalizations`)).data.find(l => l.attributes.locale === listing.locale);
const body = { data: { type: 'betaBuildLocalizations', ...(current ? { id: current.id } : {}), attributes: { whatsNew: listing.betaWhatToTest, ...(current ? {} : { locale: listing.locale }) }, ...(current ? {} : { relationships: { build: { data: { type: 'builds', id } } } }) } };
const saved = await c.request(current ? `/v1/betaBuildLocalizations/${current.id}` : '/v1/betaBuildLocalizations', { method: current ? 'PATCH' : 'POST', body });
console.log(JSON.stringify({ appId: c.appId, appleBuildId: id, buildNumber: build.attributes.version, testInformationId: saved.data.id, locale: listing.locale }));
