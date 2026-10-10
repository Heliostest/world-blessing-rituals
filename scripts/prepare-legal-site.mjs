import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { supportEmail, legalEffectiveDate, privacySections, supportSections } from '../packages/app/src/legal-content.ts';
const root = new URL('../sites/cyber-bless-support/dist/',import.meta.url);
const site = JSON.parse(await readFile(new URL('../store/support-site.json',import.meta.url),'utf8'));
const metadataDirectory = new URL('../sites/cyber-bless-support/.openai/',import.meta.url);
await mkdir(metadataDirectory,{recursive:true});
await writeFile(new URL('hosting.json',metadataDirectory),JSON.stringify({project_id:site.projectId,static:{directory:'dist'}})+'\n');
const escape = value => value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const styles = 'body{margin:0;background:#ecf7f1;color:#25473e;font:17px/1.85 system-ui,sans-serif}main{max-width:760px;margin:32px auto;padding:32px;background:#fffdf5;border-radius:24px}nav{display:flex;gap:24px;flex-wrap:wrap}a{color:#196c53}h1{font-size:30px}h2{font-size:21px;margin-top:32px}footer{font-size:14px;border-top:1px solid #dbe8df;margin-top:32px;padding-top:16px}@media(max-width:600px){main{margin:0;border-radius:0;padding:24px}}';
function page(title, sections) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>一日一念 · ${title}</title><meta name="description" content="一日一念应用的隐私说明和技术支持"><style>${styles}</style></head><body><main><nav><a href="/">一日一念</a><a href="/privacy/">隐私政策</a><a href="/support/">技术支持</a></nav><h1>${title}</h1><p>一日一念 · 生效日期 ${legalEffectiveDate}</p>${sections.map(s=>`<section><h2>${escape(s.title)}</h2>${s.paragraphs.map(p=>`<p>${escape(p)}</p>`).join('')}</section>`).join('')}<footer>${supportEmail?`联系邮箱：<a href="mailto:${escape(supportEmail)}">${escape(supportEmail)}</a>`:'技术支持联系邮箱尚待开发者确认，此页为发布准备稿。'}</footer></main></body></html>`;
}
for(const [directory,title,sections] of [['privacy','隐私政策',privacySections],['support','技术支持',supportSections],['','把一点心意留给自己',[{title:'一日一念',paragraphs:['写下心愿，完成一段轻松小仪式，在自己的小天地珍藏日常收获。无需账号，没有广告、订阅或应用内购买。基础内容可离线使用，心愿与记录保存在本机。','这些体验用于日常放松、创意互动与文化欣赏，不承诺实现愿望、宗教效力或健康改善。']}]]]) {
  const target = new URL(directory?`${directory}/`:'./',root);
  await mkdir(target,{recursive:true}); await writeFile(new URL('index.html',target),page(title,sections));
}
console.log(`Prepared public legal pages; contact ${supportEmail?'confirmed':'pending'}`);
