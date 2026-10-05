"""Validate persisted review structure and frozen inputs; never score prose."""
import argparse
import hashlib
import json
import re
import subprocess
import tempfile
from collections import Counter
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]
BASE=ROOT/'docs/material-readiness/2026-10-04'
HERE=Path(__file__).resolve().parent

def read(path):
 return json.loads(path.read_text(encoding='utf-8-sig'))

def git(*args):
 result=subprocess.run(['git',*args],cwd=ROOT,capture_output=True,text=True,encoding='utf-8')
 assert result.returncode==0,result.stdout+result.stderr
 return result.stdout

def hash_manifest(name):
 manifest=Path(tempfile.gettempdir())/name
 if not manifest.exists(): return None
 rows=read(manifest)
 for row in rows:
  path=Path(row['Path'])
  assert path.is_file() and hashlib.sha256(path.read_bytes()).hexdigest().upper()==row['Hash'],path
 return len(rows)

def validate(batch):
 p=read(BASE/'progress.json'); baseline=read(BASE/'assessment.json')
 original={i['slug']:i for i in baseline['items']}
 assert len(original)==len(baseline['items'])==len(p['items'])==506
 assert len({i['slug'] for i in p['items']})==506
 assert set(original)=={i['slug'] for i in p['items']}
 assert len(set(p['batchOrder']))==len(p['batchOrder'])==27
 assert set(p['batchOrder'])=={b['batchId'] for b in p['batches']}
 rows=[i for i in p['items'] if i['batchId']==batch]
 assert rows and all(i['status'] in {'ready','needs_research','scope_blocked','baseline_ready'} for i in rows)
 fields={'url','title','institution','accessedAt','locator','claims','verified'}
 dims={'context','objects','space','sequence','sensory','variants','boundaries','provenance'}
 reviewed=[i for i in p['items'] if i['reviewFile']]
 evidence_count=0; batch_evidence=0
 for item in p['items']:
  slug=item['slug']; old=original[slug]
  assert item['grade']==old['grade'] and item['batchId']==old['batchId']
  assert item['status'] in p['workflowStatuses']
  if not item['reviewFile']:
   assert item['status']==('baseline_ready' if old['readiness']=='ready' else 'pending'),slug
   assert not item['outputFiles'] and not item['verifiedSources']
   continue
  assert item['status'] in {'ready','needs_research','scope_blocked'}
  assert len(item['outputFiles'])==1 and item['checkpoint']
  note=ROOT/item['outputFiles'][0]; assert note.is_file()
  text=note.read_text(encoding='utf-8-sig')
  review=read(ROOT/item['reviewFile']); source=read(HERE/'research'/f'{slug}.sources.json')
  assert review['slug']==source['slug']==slug
  assert review['batchId']==source['batchId']==item['batchId']
  assert review['workflowStatus']==item['status']
  assert review['selectedDisplay']==source['selectedDisplay']==item['selectedDisplay']
  assert review['baselineSelectedDisplay']==old['selectedDisplay']
  assert review['checkedAt']==item['updatedAt']
  assert set(review['dimensions'])==dims
  assert all(v in [0,1,2,None] for v in review['dimensions'].values())
  assert isinstance(review['narrativeReady'],bool)
  assert review['semanticReview'] and review['nextWriting'] and len(review['evidence'])>=2
  for evidence in review['evidence']:
   assert evidence['file']==item['outputFiles'][0]
   lines=(ROOT/evidence['file']).read_text(encoding='utf-8-sig').splitlines()
   assert 1<=evidence['line']<=len(lines)
   assert evidence['quote'] in lines[evidence['line']-1] and evidence['reason']
   evidence_count+=1; batch_evidence+=int(item['batchId']==batch)
  for file in review['sourceFiles']: assert (ROOT/file).is_file(),file
  assert review['sources']==source['sources']
  assert len({s['id'] for s in review['sources']})==len(review['sources'])
  for s in review['sources']:
   assert fields<=s.keys(),(slug,s)
   assert isinstance(s['verified'],bool) and isinstance(s['claims'],list)
   assert all(s[k] for k in fields-{'verified','claims'})
   if s['verified']: assert s['claims'] and s['url'] in text,(slug,s['id'])
  assert item['verifiedSources']==[s for s in review['sources'] if s['verified']]
  assert item['remainingGaps']==review['gaps']==source['gaps']
  if item['status']=='ready':
   assert review['readiness']=='ready' and review['narrativeReady'] and not review['gaps']
   assert all(review['dimensions'][d]==2 for d in dims-{'sequence','sensory'})
   assert review['dimensions']['sequence'] in [2,None] and review['dimensions']['sensory']>=1
   if review['dimensions']['sequence'] is None: assert '静态' in text
  else: assert review['readiness']!='ready' and review['gaps']
 counts=Counter(i['status'] for i in p['items']); summary=p['summary']
 assert summary['total']==506 and summary['baselineReady']==counts['baseline_ready']==3
 assert summary['newlyReady']==counts['ready']
 assert summary['remainingNotReady']==506-counts['ready']-counts['baseline_ready']
 assert summary['newDocuments']==sum(bool(i['outputFiles']) for i in p['items'])==len(reviewed)
 assert summary['verifiedSourceUrls']==len({s['url'] for i in p['items'] for s in i['verifiedSources']})
 assert summary['statusCounts']=={k:counts[k] for k in p['workflowStatuses']}
 for b in p['batches']:
  c=Counter(i['status'] for i in p['items'] if i['batchId']==b['batchId'])
  for key,state in [('baselineReady','baseline_ready'),('newlyReady','ready'),('pending','pending'),('needsResearch','needs_research'),('scopeBlocked','scope_blocked')]: assert b[key]==c[state],(b['batchId'],key)
  assert b['processedNonReady']==c['needs_research']+c['scope_blocked']
 expected=None
 for bid in p['batchOrder']:
  group=[i for i in p['items'] if i['batchId']==bid]
  expected=next((i for state in ['researching','drafted','pending'] for i in group if i['status']==state),None)
  if expected: break
 assert p['nextAction']['batchId']==(expected['batchId'] if expected else None)
 assert p['nextAction']['slug']==(expected['slug'] if expected else None)
 for folder,suffix in [('reviews','.json'),('research','.sources.json')]: assert len(list((HERE/folder).glob('*'+suffix)))==len(reviewed)
 assert len(list((ROOT/'content/display-notes').glob('*.md')))==len(reviewed)
 for file in [BASE/'progress.md',HERE/f'batches/{batch}.md']:
  for link in re.findall(r'\]\(([^)]+)\)',file.read_text(encoding='utf-8-sig')):
   if '://' not in link: assert (file.parent/link.split('#')[0]).resolve().is_file(),(file,link)
 # Frozen Git snapshot is reproducible even if the original temporary SHA manifests expire.
 protected=['content/traditions','docs/material-readiness/2026-10-04/assessment.json',
  'docs/material-readiness/2026-10-04/reviews','docs/material-readiness/2026-10-04/batches']
 protected += [f'docs/material-readiness/2026-10-04/{f}' for f in ['README.md','rubric.md','writing-template.md','review-notes.md','next-session-prompt.md']]
 assert not git('diff','--name-only','e69824e','--',*protected).strip(),'baseline/card changes'
 c01=[i['slug'] for i in baseline['items'] if i['batchId']=='C01']
 c01files=[f'content/display-notes/{s}.md' for s in c01]
 c01files += [f'docs/material-readiness/supplementation/{folder}/{s}{suffix}' for s in c01 for folder,suffix in [('research','.sources.json'),('reviews','.json')]]
 c01files += ['docs/material-readiness/supplementation/batches/C01.md','docs/material-readiness/supplementation/validation-C01.json']
 assert not git('diff','--name-only','e69824e','--',*c01files).strip(),'frozen C01 changes'
 base_count=hash_manifest('world-blessing-baseline-hashes.json')
 card_count=hash_manifest('world-blessing-tradition-hashes.json')
 git('diff','--check')
 c=Counter(i['status'] for i in rows)
 result={'checkedAt':p['updatedAt'],'batchId':batch,'structuralValidation':'passed',
  'semanticValidation':'主代理逐项阅读全文并作显式八维判断；本脚本仅验证记录结构，不能自动证明文化齐备。',
  'processed':len(rows),'newlyReady':c['ready'],'needsResearch':c['needs_research'],'scopeBlocked':c['scope_blocked'],
  'notes':len(rows),'reviews':len(rows),'researchRecords':len(rows),'validNewEvidenceQuotes':batch_evidence,
  'batchVerifiedSourceUrls':len({s['url'] for i in rows for s in i['verifiedSources']}),
  'cumulativeDocuments':len(reviewed),'cumulativeEvidenceQuotes':evidence_count,'ledgerUnits':506,
  'newlyReadyTotal':summary['newlyReady'],'baselineReady':3,'totalReady':summary['newlyReady']+3,
  'remainingNotReady':summary['remainingNotReady'],'baselineSnapshotFilesHashUnchanged':base_count,
  'traditionCardsHashUnchanged':card_count,'frozenC01FilesUnchangedAgainstCommit':'e69824e',
  'gitDiffCheck':'passed','nextAction':p['nextAction'],
  'limits':'通过仅对应选定文字切片；静态sequence=null不表示动态场景或礼仪齐备；未通过项均不计完成。'}
 (HERE/f'validation-{batch}.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(json.dumps(result,ensure_ascii=True,indent=2))

if __name__=='__main__':
 parser=argparse.ArgumentParser(); parser.add_argument('batch'); validate(parser.parse_args().batch)
