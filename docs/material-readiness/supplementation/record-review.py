"""Save explicit reviewer decisions; never score documents automatically."""
import json
import importlib.util
from pathlib import Path

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('ledger',HERE/'maintain-progress.py')
ledger=importlib.util.module_from_spec(spec); spec.loader.exec_module(ledger)

def record(slug,status,dimensions,rationale,quotes,checkpoint):
    data=ledger.read(HERE/'research'/f'{slug}.sources.json')
    note=f'content/display-notes/{slug}.md'
    lines=(ledger.ROOT/note).read_text(encoding='utf-8-sig').splitlines()
    evidence=[]
    for quote,reason in quotes:
        match=next((n for n,line in enumerate(lines,1) if quote in line),None)
        assert match is not None,(slug,quote)
        evidence.append({'file':note,'line':match,'quote':quote,'reason':reason})
    assert len(evidence)>=2
    baseline=next(i for i in ledger.read(ledger.BASE/'assessment.json')['items'] if i['slug']==slug)
    readiness='ready' if status=='ready' else data.get('reviewReadiness', 'scope_blocked' if status=='scope_blocked' else 'partial')
    if status=='ready':
        assert not data['gaps']
        assert all(dimensions[k]==2 for k in ['context','objects','space','variants','boundaries','provenance'])
        assert dimensions['sequence'] in [2,None] and dimensions['sensory']>=1
    obj={'slug':slug,'title':baseline['title'],'grade':baseline['grade'],'batchId':baseline['batchId'],
        'selectedDisplay':data['selectedDisplay'],'baselineSelectedDisplay':baseline['selectedDisplay'],
        'sliceChangeReason':data.get('sliceChangeReason',''), 'readiness':readiness,'workflowStatus':status,
        'narrativeReady':data.get('narrativeReady',True),'dimensions':dimensions,'semanticReview':rationale,'evidence':evidence,
        'gaps':data['gaps'],'nextWriting':data['nextWriting'],'sourceFiles':baseline['sourceFiles']+[note],
        'checkedAt':ledger.DATE,'sources':data['sources'],'checkpoint':checkpoint,
        'reviewMethod':'主代理实际逐项阅读全文，按可绘制物件、相对位置、起止状态、文化事实与原创决定的区分进行语义判定；脚本仅记录明确决策和真实引文。'}
    ledger.save(HERE/'reviews'/f'{slug}.json',obj)
    ledger.record(slug)
