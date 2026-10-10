import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { getOwnAppStoreClient } from './app-store-client.mjs';

// Updates only the editable version of this app. Never submits a review or invites testers.
const c = await getOwnAppStoreClient();
const listing = JSON.parse(await readFile(new URL('../store/ios/zh-Hans.json', import.meta.url), 'utf8'));
const version = (await c.request(`/v1/apps/${c.appId}/appStoreVersions?filter[platform]=IOS`)).data.find(v => v.attributes.versionString === c.expo.version);
if (!version || !['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED'].includes(version.attributes.appStoreState)) throw Error('No editable current version; no changes made');
const localizations = (await c.request(`/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations`)).data;
const locale = localizations.find(l => l.attributes.locale === listing.locale);
if (!locale) throw Error('Create the current app locale first');
const info = (await c.request(`/v1/apps/${c.appId}/appInfos`)).data.find(i => i.attributes.state === 'PREPARE_FOR_SUBMISSION');
if (!info) throw Error('Editable app information missing');
const appLocale = (await c.request(`/v1/appInfos/${info.id}/appInfoLocalizations`)).data.find(l => l.attributes.locale === listing.locale);
if (!appLocale) throw Error('App information locale missing');
await c.request(`/v1/appStoreVersionLocalizations/${locale.id}`, { method: 'PATCH', body: { data: { type: 'appStoreVersionLocalizations', id: locale.id, attributes: Object.fromEntries(['description', 'keywords', 'promotionalText'].map(k => [k, listing[k]])) } } });
await c.request(`/v1/appInfoLocalizations/${appLocale.id}`, { method: 'PATCH', body: { data: { type: 'appInfoLocalizations', id: appLocale.id, attributes: { subtitle: listing.subtitle } } } });
await c.request(`/v1/appInfos/${info.id}`, { method: 'PATCH', body: { data: { type: 'appInfos', id: info.id, relationships: { primaryCategory: { data: { type: 'appCategories', id: 'LIFESTYLE' } } } } } });
const age = (await c.request(`/v1/appInfos/${info.id}/ageRatingDeclaration`)).data;
const ageAttributes = JSON.parse(await readFile(new URL('../store/ios/age-rating.json', import.meta.url), 'utf8'));
await c.request(`/v1/ageRatingDeclarations/${age.id}`, { method: 'PATCH', body: { data: { type: 'ageRatingDeclarations', id: age.id, attributes: ageAttributes } } });
const review = (await c.request(`/v1/appStoreVersions/${version.id}/appStoreReviewDetail`)).data;
let reviewNotesSaved = false;
try {
  await c.request(`/v1/appStoreReviewDetails/${review.id}`, { method: 'PATCH', body: { data: { type: 'appStoreReviewDetails', id: review.id, attributes: { demoAccountRequired: false, notes: listing.reviewNotes } } } });
  reviewNotesSaved = true;
} catch (error) {
  if (!error.message.startsWith('Apple API 409:') || !error.message.includes('ENTITY_ERROR.ATTRIBUTE.REQUIRED')) throw error;
  console.log(`Review notes require completed contact facts: ${error.message}`);
}
const sets = (await c.request(`/v1/appStoreVersionLocalizations/${locale.id}/appScreenshotSets`)).data;
let set = sets.find(s => s.attributes.screenshotDisplayType === listing.screenshotDisplayType);
if (!set) set = (await c.request('/v1/appScreenshotSets', { method: 'POST', body: { data: { type: 'appScreenshotSets', attributes: { screenshotDisplayType: listing.screenshotDisplayType }, relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: locale.id } } } } } })).data;
const screenshots = (await c.request(`/v1/appScreenshotSets/${set.id}/appScreenshots`)).data;
const results = [];
for (const fileName of listing.screenshots) {
  const file = new URL(`../store/screenshots/ios/zh-Hans/${fileName}`, import.meta.url);
  const bytes = await readFile(file);
  const metadata = await sharp(bytes).metadata();
  if (metadata.width !== 1206 || metadata.height !== 2622 || metadata.hasAlpha) throw Error(`Screenshot dimensions/alpha mismatch: ${fileName}`);
  const checksum = createHash('md5').update(bytes).digest('hex');
  let screenshot = screenshots.find(s => s.attributes.fileName === fileName);
  if (screenshot && screenshot.attributes.sourceFileChecksum && screenshot.attributes.sourceFileChecksum !== checksum) throw Error(`Existing screenshot differs; review it before replacing: ${fileName}`);
  if (screenshot?.attributes.assetDeliveryState.state === 'COMPLETE') { results.push({ id: screenshot.id, fileName, state: 'COMPLETE' }); continue; }
  if (!screenshot) screenshot = (await c.request('/v1/appScreenshots', { method: 'POST', body: { data: { type: 'appScreenshots', attributes: { fileName, fileSize: bytes.length }, relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: set.id } } } } } })).data;
  const state = screenshot.attributes.assetDeliveryState.state;
  if (state === 'AWAITING_UPLOAD') {
    for (const operation of screenshot.attributes.uploadOperations) {
      const response = await c.fetch(operation.url, { method: operation.method, headers: Object.fromEntries(operation.requestHeaders.map(h => [h.name, h.value])), body: bytes.subarray(operation.offset, operation.offset + operation.length), timeout: 45000 });
      if (!response.ok) throw Error(`Apple screenshot upload failed (${response.status}): ${fileName}`);
    }
    screenshot = (await c.request(`/v1/appScreenshots/${screenshot.id}`, { method: 'PATCH', body: { data: { type: 'appScreenshots', id: screenshot.id, attributes: { uploaded: true, sourceFileChecksum: checksum } } } })).data;
  }
  results.push({ id: screenshot.id, fileName, state: screenshot.attributes.assetDeliveryState.state });
  console.log(`${fileName}: ${screenshot.attributes.assetDeliveryState.state}`);
}
const directory = new URL('../artifacts/mobile-verification/', import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL('store-preparation.json', directory), JSON.stringify({ at: new Date().toISOString(), appId: c.appId, versionId: version.id, localeId: locale.id, screenshotSetId: set.id, displayType: listing.screenshotDisplayType, reviewNotesSaved, screenshots: results }, null, 2) + '\n');
console.log('Saved own editable listing and screenshot uploads. Review/contact/privacy/pricing/territory completion remains separate.');
