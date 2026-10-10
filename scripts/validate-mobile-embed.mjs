import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

export async function walk(directory) {
  return (await Promise.all((await readdir(directory, { withFileTypes: true })).map(entry =>
    entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]))).flat();
}

export async function validateMobileEmbed(root, assets) {
  if (!(await stat(path.join(root, 'main.bundle'))).size) throw Error('Missing native main.bundle');
  const files = await walk(root);
  const pages = files.filter(file => file.endsWith('.html') && file.includes('www.bundle'));
  if (pages.length !== 1) throw Error(`Expected one BlessingDom HTML, found ${pages.length}`);
  const dom = path.dirname(pages[0]);
  const html = await readFile(pages[0], 'utf8');
  const references = [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/g)].map(match => match[1]);
  if (!references.some(file => /\.js(?:\?|$)/.test(file))) throw Error('Missing DOM JavaScript');
  for (const reference of references) {
    if (!reference.startsWith('./') || reference.includes('..')) throw Error(`Non-local DOM dependency: ${reference}`);
    if (!(await stat(path.join(dom, reference.split('?')[0]))).size) throw Error(`Empty DOM dependency: ${reference}`);
  }
  for (const asset of assets) {
    if (!asset.file || path.isAbsolute(asset.file) || asset.file.split('/').includes('..')) throw Error('Invalid asset path');
    const bytes = await readFile(path.join(dom, asset.file));
    if (bytes.length !== asset.bytes || createHash('sha256').update(bytes).digest('hex') !== asset.sha256)
      throw Error(`Embedded asset mismatch: ${asset.file}`);
  }
  const domScripts = files.filter(file => file.startsWith(dom + path.sep) && file.endsWith('.js'));
  for (const file of domScripts) {
    const source = await readFile(file, 'utf8');
    if (!source.length) throw Error(`Empty DOM chunk: ${file}`);
    for (const match of source.matchAll(/["'](\.\/_expo\/static\/js\/web\/[^"']+\.js)["']/g)) {
      if (!(await stat(path.join(dom, match[1]))).size) throw Error(`Empty dynamic DOM chunk: ${match[1]}`);
    }
  }
  for (const file of files.filter(file => file.endsWith('.css'))) {
    const css = await readFile(file, 'utf8');
    for (const match of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
      const ref = match[1].trim();
      if (ref.startsWith('data:') || ref.startsWith('#')) continue;
      if (/^(?:https?:|\/\/)/.test(ref)) throw Error(`Remote CSS resource: ${ref}`);
      const candidate = path.resolve(path.dirname(file), ref.split(/[?#]/)[0]);
      if (path.relative(dom, candidate).startsWith('..')) throw Error(`Non-local CSS resource: ${ref}`);
      if (!(await stat(candidate)).size) throw Error(`Empty CSS resource: ${ref}`);
    }
  }
  return { page: path.relative(root, pages[0]), domScriptCount: domScripts.length, assetCount: assets.length, assetBytes: assets.reduce((total, asset) => total + asset.bytes, 0) };
}
