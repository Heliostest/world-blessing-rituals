import { mkdir, writeFile } from 'node:fs/promises';
import { getOwnAppStoreClient } from './app-store-client.mjs';

const { request, ownApp, appId, expo } = await getOwnAppStoreClient();
const [versions, builds, groups] = await Promise.all([
  request(`/v1/apps/${appId}/appStoreVersions?filter[platform]=IOS&limit=10`),
  request(`/v1/builds?filter[app]=${appId}&include=preReleaseVersion,buildBetaDetail&limit=20`),
  request(`/v1/apps/${appId}/betaGroups?limit=20`),
]);
const report = {
  checkedAt: new Date().toISOString(), projectId: expo.extra.eas.projectId,
  app: { id: appId, name: ownApp.attributes.name, bundleId: ownApp.attributes.bundleId, sku: ownApp.attributes.sku },
  versions: versions.data.map(v => ({ id: v.id, ...v.attributes })),
  builds: builds.data.map(b => ({ id: b.id, version: b.attributes.version, uploadedDate: b.attributes.uploadedDate, expirationDate: b.attributes.expirationDate, expired: b.attributes.expired, minOsVersion: b.attributes.minOsVersion, processingState: b.attributes.processingState, buildAudienceType: b.attributes.buildAudienceType, usesNonExemptEncryption: b.attributes.usesNonExemptEncryption, preReleaseVersion: builds.included?.find(r => r.id === b.relationships.preReleaseVersion.data?.id)?.attributes, beta: builds.included?.find(r => r.id === b.relationships.buildBetaDetail.data?.id)?.attributes })),
  groups: groups.data.map(g => ({ id: g.id, name: g.attributes.name, isInternalGroup: g.attributes.isInternalGroup, publicLinkEnabled: g.attributes.publicLinkEnabled, publicLink: g.attributes.publicLink ?? null })),
};
const directory = new URL('../artifacts/mobile-verification/', import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL('app-store-status.json', directory), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
