"""Structural audit only; never infer cultural readiness or score prose."""
import hashlib
import json
import re
import subprocess
import tempfile
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / 'docs/material-readiness/2026-10-04'
HERE = Path(__file__).resolve().parent

def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def hash_manifest(filename):
    path = Path(tempfile.gettempdir()) / filename
    rows = read(path)
    for row in rows:
        p = Path(row['Path'])
        assert p.is_file(), p
        assert hashlib.sha256(p.read_bytes()).hexdigest().upper() == row['Hash'], p
    return len(rows)

p = read(BASE / 'progress.json')
baseline = read(BASE / 'assessment.json')
original = {i['slug']: i for i in baseline['items']}
assert len(original) == len(baseline['items']) == 506
assert len({i['slug'] for i in p['items']}) == len(p['items']) == 506
assert set(original) == {i['slug'] for i in p['items']}
assert len(p['batchOrder']) == len(set(p['batchOrder'])) == 27
assert set(p['batchOrder']) == {b['batchId'] for b in p['batches']}
assert all(i['status'] in p['workflowStatuses'] for i in p['items'])
rows = [i for i in p['items'] if i['batchId'] == 'C01']
assert len(rows) == 20
assert {i['slug'] for i in rows} == {i['slug'] for i in baseline['items'] if i['batchId'] == 'C01'}
evidence_count = 0
source_fields = {'url','title','institution','accessedAt','locator','claims','verified'}
dimensions = {'context','objects','space','sequence','sensory','variants','boundaries','provenance'}

for i in p['items']:
    assert i['grade'] == original[i['slug']]['grade']
    assert i['batchId'] == original[i['slug']]['batchId']
    if i['batchId'] != 'C01':
        expected = 'baseline_ready' if original[i['slug']]['readiness'] == 'ready' else 'pending'
        assert i['status'] == expected, i['slug']
        continue
    assert i['status'] in {'ready','needs_research','scope_blocked'}, i['slug']
    assert i['updatedAt'] == '2026-10-04' and i['checkpoint']
    assert len(i['outputFiles']) == 1
    note = ROOT / i['outputFiles'][0]
    assert note.is_file()
    r = read(ROOT / i['reviewFile'])
    s = read(HERE / 'research' / (i['slug'] + '.sources.json'))
    assert r['slug'] == s['slug'] == i['slug']
    assert r['batchId'] == s['batchId'] == i['batchId']
    assert r['workflowStatus'] == i['status']
    assert r['selectedDisplay'] == i['selectedDisplay'] == s['selectedDisplay']
    assert r['baselineSelectedDisplay'] == original[i['slug']]['selectedDisplay']
    assert r['checkedAt'] == '2026-10-04'
    assert set(r['dimensions']) == dimensions
    assert all(v in (0,1,2,None) for v in r['dimensions'].values())
    assert isinstance(r['narrativeReady'], bool)
    assert len(r['evidence']) >= 2 and r['semanticReview'] and r['nextWriting']
    for e in r['evidence']:
        assert e['file'] == i['outputFiles'][0]
        lines = (ROOT / e['file']).read_text(encoding='utf-8-sig').splitlines()
        assert 1 <= e['line'] <= len(lines)
        assert e['quote'] in lines[e['line']-1] and e['reason']
        evidence_count += 1
    for filename in r['sourceFiles']:
        assert (ROOT / filename).is_file(), filename
    for source in r['sources']:
        assert source_fields <= source.keys(), (i['slug'],source)
        assert all(source[k] for k in source_fields - {'claims','verified'})
        assert isinstance(source['verified'], bool) and isinstance(source['claims'], list)
        if source['verified']:
            assert source['claims'] and source['url'] in note.read_text(encoding='utf-8-sig')
    assert r['sources'] == s['sources']
    assert i['verifiedSources'] == [x for x in r['sources'] if x['verified']]
    assert i['remainingGaps'] == r['gaps'] == s['gaps']
    if i['status'] == 'ready':
        assert r['readiness'] == 'ready' and r['narrativeReady'] and not r['gaps']
        assert all(r['dimensions'][k] == 2 for k in dimensions - {'sequence','sensory'})
        assert r['dimensions']['sequence'] in (2,None) and r['dimensions']['sensory'] >= 1
        if r['dimensions']['sequence'] is None:
            assert '静态' in note.read_text(encoding='utf-8-sig')
    else:
        assert r['readiness'] != 'ready' and r['gaps']

counts = Counter(i['status'] for i in p['items'])
assert counts == Counter({'pending':483,'ready':12,'needs_research':7,'baseline_ready':3,'scope_blocked':1})
summary = p['summary']
assert summary['total'] == 506 and summary['baselineReady'] == counts['baseline_ready']
assert summary['newlyReady'] == counts['ready']
assert summary['remainingNotReady'] == 506 - counts['ready'] - counts['baseline_ready'] == 491
assert summary['newDocuments'] == sum(bool(i['outputFiles']) for i in p['items']) == 20
assert summary['verifiedSourceUrls'] == len({s['url'] for i in p['items'] for s in i['verifiedSources']})
assert summary['statusCounts'] == {k:counts[k] for k in p['workflowStatuses']}
for b in p['batches']:
    c = Counter(i['status'] for i in p['items'] if i['batchId'] == b['batchId'])
    for key,status in [('baselineReady','baseline_ready'),('newlyReady','ready'),('pending','pending'),('needsResearch','needs_research'),('scopeBlocked','scope_blocked')]:
        assert b[key] == c[status], (b['batchId'],key)
    assert b['processedNonReady'] == c['needs_research'] + c['scope_blocked']
assert p['nextAction']['batchId'] == 'C02' and p['nextAction']['slug'] == 'breton-pardons'
assert next(b for b in p['batches'] if b['batchId']=='C01')['status'] == 'processed_with_gaps'
for folder,suffix in [('reviews','.json'),('research','.sources.json')]:
    assert len(list((HERE/folder).glob('*'+suffix))) == 20
assert len(list((ROOT/'content/display-notes').glob('*.md'))) == 20
for document in [BASE/'progress.md',HERE/'batches/C01.md']:
    for link in re.findall(r'\]\(([^)]+)\)',document.read_text(encoding='utf-8-sig')):
        if '://' not in link:
            assert (document.parent / link.split('#')[0]).resolve().is_file(), link

base_count = hash_manifest('world-blessing-baseline-hashes.json')
card_count = hash_manifest('world-blessing-tradition-hashes.json')
check = subprocess.run(['git','diff','--check'],cwd=ROOT,capture_output=True,text=True)
assert check.returncode == 0, check.stdout + check.stderr
result = {
    'checkedAt':'2026-10-04', 'batchId':'C01', 'structuralValidation':'passed',
    'semanticValidation':'20项由主代理实际阅读后逐项决策；结构脚本不替代语义判定。',
    'processed':20, 'newlyReady':12, 'needsResearch':7, 'scopeBlocked':1,
    'notes':20, 'reviews':20, 'researchRecords':20, 'validNewEvidenceQuotes':evidence_count,
    'verifiedSourceUrls':summary['verifiedSourceUrls'], 'ledgerUnits':506,
    'baselineReady':3, 'totalReady':15, 'remainingNotReady':491,
    'baselineSnapshotFilesHashUnchanged':base_count, 'traditionCardsHashUnchanged':card_count,
    'gitDiffCheck':'passed', 'nextAction':p['nextAction'],
    'limits':'文字齐备性，非模型实现、上线许可或图片音频授权；8项未通过均不计完成。'
}
(HERE/'validation-C01.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result,ensure_ascii=True,indent=2))
