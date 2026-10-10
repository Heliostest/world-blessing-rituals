import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyStoreBuild } from './mobile-build-guard.mjs';
test('upload guard rejects other applications, unsigned previews, unfinished builds and wrong platforms', () => {
  const expo = { extra:{eas:{projectId:'own-project'}}, ios:{bundleIdentifier:'own.bundle'}, android:{package:'own.bundle'} };
  const valid = { app:{id:'own-project'}, platform:'IOS', status:'FINISHED', appIdentifier:'own.bundle', distribution:'STORE' };
  assert.equal(verifyStoreBuild(valid,expo,'ios'),'own.bundle');
  for (const change of [{app:{id:'another-project'}},{platform:'ANDROID'},{status:'IN_PROGRESS'},{appIdentifier:'another.bundle'},{distribution:'INTERNAL'}])
    assert.throws(() => verifyStoreBuild({...valid,...change},expo,'ios'));
  assert.equal(verifyStoreBuild({...valid,platform:'ANDROID'},expo,'android'),'own.bundle');
});
