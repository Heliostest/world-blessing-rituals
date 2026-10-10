import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { validateMobileEmbed } from './validate-mobile-embed.mjs';

test('rejects missing CSS, changed offline bytes, remote scripts and traversal', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'wbr-embed-test-'));
  try {
    const dom = path.join(root, 'www.bundle');
    await mkdir(dom);
    const bytes = Buffer.from('local model');
    const assets = [{ file: 'model.glb', bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }];
    await writeFile(path.join(root, 'main.bundle'), 'native bundle');
    await writeFile(path.join(dom, 'blessing.html'), '<script src="./app.js"></script><link href="./app.css">');
    await writeFile(path.join(dom, 'app.js'), 'app');
    await writeFile(path.join(dom, 'model.glb'), bytes);
    await assert.rejects(validateMobileEmbed(root, assets), /app.css/);
    await writeFile(path.join(dom, 'app.css'), 'body{}');
    assert.equal((await validateMobileEmbed(root, assets)).assetCount, 1);
    await writeFile(path.join(dom, 'model.glb'), 'changed');
    await assert.rejects(validateMobileEmbed(root, assets), /model.glb/);
    await writeFile(path.join(dom, 'model.glb'), bytes);
    await writeFile(path.join(dom, 'app.js'), 'const chunk="./_expo/static/js/web/missing.js";');
    await assert.rejects(validateMobileEmbed(root, assets), /missing.js/);
    await writeFile(path.join(dom, 'app.js'), 'app');
    for (const src of ['https://cdn.test/app.js', '../app.js']) {
      await writeFile(path.join(dom, 'blessing.html'), `<script src="${src}"></script>`);
      await assert.rejects(validateMobileEmbed(root, assets), /Non-local/);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
