"""Record a manually reviewed item and rebuild continuation ledgers.

This script does no semantic grading. Reviews must already contain the human/
agent reader's decision, dimensions, real quotations, and reasons.
"""
import json
from collections import Counter
from pathlib import Path
import argparse

ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / 'docs/material-readiness/2026-10-04'
SUP = ROOT / 'docs/material-readiness/supplementation'
DATE = '2026-10-04'

def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def save(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

def rebuild(p):
    counts = Counter(i['status'] for i in p['items'])
    p['updatedAt'] = DATE
    p['summary'].update(newlyReady=counts['ready'], remainingNotReady=len(p['items'])-counts['ready']-counts['baseline_ready'],
        newDocuments=sum(bool(i['outputFiles']) for i in p['items']),
        verifiedSourceUrls=len({s['url'] for i in p['items'] for s in i['verifiedSources']}),
        statusCounts={k:counts[k] for k in p['workflowStatuses']})
    candidate=None
    for bid in p['batchOrder']:
        rows=[i for i in p['items'] if i['batchId']==bid]
        candidate=next((i for state in ['researching','drafted','pending'] for i in rows if i['status']==state),None)
        if candidate: break
    p['nextAction']={'batchId':candidate['batchId'] if candidate else None,'slug':candidate['slug'] if candidate else None,
        'instruction':'优先续接本批 researching/drafted，再处理 pending；needs_research/scope_blocked 不计完成，留待新增证据。' if candidate else '所有批次已处理；汇总待研究与范围阻断项。'}
    for b in p['batches']:
        rows=[i for i in p['items'] if i['batchId']==b['batchId']]
        c=Counter(i['status'] for i in rows)
        b.update(baselineReady=c['baseline_ready'], newlyReady=c['ready'], pending=c['pending'],
            needsResearch=c['needs_research'],scopeBlocked=c['scope_blocked'],processedNonReady=c['needs_research']+c['scope_blocked'])
        active=c['researching']+c['drafted']
        b['status']='ready' if c['ready']+c['baseline_ready']==len(rows) else ('in_progress' if active or (c['pending'] and any(i['outputFiles'] for i in rows)) else ('pending' if c['pending']==len(rows)-c['baseline_ready'] else 'processed_with_gaps'))
        if any(i['reviewFile'] for i in rows):
            report=f'docs/material-readiness/supplementation/batches/{b["batchId"]}.md'
            b['reportFile']=report
            text=[f'# {b["batchId"]} 展示材料补写与复评', '',f'更新：{DATE}。状态：{b["status"]}；新增通过 {c["ready"]}/{len(rows)}；待研究 {c["needs_research"]}；范围阻断 {c["scope_blocked"]}；未处理/处理中 {c["pending"]+active}。', '', '基线报告和原卡片保留；以下结论只对应各项选定切片。每项的来源与逐维理由见复评文件。', '', '| 条目与说明 | 复评 | 补齐内容／未解决问题与下一步 |','| --- | --- | --- |']
            for i in rows:
                slug=i['slug']
                note=f'[{slug}](../../../../content/display-notes/{slug}.md)' if i['outputFiles'] else slug
                review=f'[{i["status"]}](../reviews/{slug}.json)' if i['reviewFile'] else i['status']
                extra='；缺口：'+'；'.join(i['remainingGaps']) if i['remainingGaps'] else '；无阻断缺口'
                if i['reviewFile']:
                    review_data=read(ROOT/i['reviewFile'])
                    extra+='；下一步：'+'；'.join(review_data['nextWriting'])
                text.append(f'| {note} | {review} | {i["checkpoint"]}{extra} |')
            text += ['', '## 续接', '', f'当前下一位置：{p["nextAction"]["batchId"]} / `{p["nextAction"]["slug"]}`。已处理但未通过项保留为待办；无新增证据时，按 progress.json 的 nextAction 继续下一未开始批次。', '', '## 验收说明', '', '主代理逐项阅读新说明后判定八维，结构脚本仅校验枚举、门槛、文件、行号与计数，不根据篇幅或标题给分。']
            if b['batchId']=='C01' and not c['pending'] and not active:
                text += ['', '本批结构核对及基线哈希结果：[validation-C01.json](../validation-C01.json)。']
            (ROOT/report).parent.mkdir(parents=True,exist_ok=True)
            (ROOT/report).write_text('\n'.join(text)+'\n',encoding='utf-8')
    save(BASE/'progress.json',p)
    lines=['# 展示材料补齐进度记录','',f'更新日期：{DATE}。研究、补写与复评已启动。机器台账：[progress.json](progress.json)。','',
        '## 当前统计','', '| 范围 | 总数 | 原齐备 | 本轮通过 | 仍未齐备 |','| --- | --- | --- | --- | --- |']
    for label,grade in [('C 档传统候选','C'),('B 档传统候选','B'),('App 专题','seed')]:
        rows=[i for i in p['items'] if i['grade']==grade]; c=Counter(i['status'] for i in rows)
        lines.append(f'| {label} | {len(rows)} | {c["baseline_ready"]} | {c["ready"]} | {len(rows)-c["baseline_ready"]-c["ready"]} |')
    s=p['summary']; lines += [f'| 合计评估单位 | {s["total"]} | {s["baselineReady"]} | {s["newlyReady"]} | {s["remainingNotReady"]} |','',
        f'新增说明 {s["newDocuments"]} 份；已访问并核验的去重来源网址 {s["verifiedSourceUrls"]} 个。待研究 {counts["needs_research"]}；范围阻断 {counts["scope_blocked"]}；未开始 {counts["pending"]}；研究中 {counts["researching"]}；待复评 {counts["drafted"]}。', '',
        '498 个传统候选与 8 个 App 专题分开评估，题材部分重叠；原齐备 3 项不计本轮新增，也不表示其外部来源已重新核验。原始待补 503 项。', '',
        '## 当前续接位置','',f'下一批 **{p["nextAction"]["batchId"]}**；条目 **`{p["nextAction"]["slug"]}`**。', '',p['nextAction']['instruction'],'',
        '## 批次台账','', '| 批次 | 状态 | 本轮通过 | 待研究 | 范围阻断 | 未开始 |','| --- | --- | --- | --- | --- | --- |']
    for b in p['batches']:
        link=f'[{b["batchId"]}](../supplementation/batches/{b["batchId"]}.md)' if b['reportFile'] else b['batchId']
        lines.append(f'| {link} | {b["status"]} | {b["newlyReady"]} | {b["needsResearch"]} | {b["scopeBlocked"]} | {b["pending"]} |')
    gaps=[i for i in p['items'] if i['status'] in ['needs_research','scope_blocked']]
    lines += ['', '## 已处理但未通过的待办','']
    lines += [f'- `{i["slug"]}`：'+'；'.join(i['remainingGaps']) for i in gaps] or ['暂无已复评的阻断待办。']
    lines += ['', '## 基线与工作边界','',
        '[原评估](README.md)、[assessment.json](assessment.json)、原 reviews 与 batches、原传统卡片均保留。只补文字、研究记录和复评，不实现 Three.js、模型或交互脚本，不改变 A/B/C 资格。', '',
        '[口径](rubric.md) · [模板](writing-template.md) · [审阅备注](review-notes.md) · [完整续接要求](next-session-prompt.md)。', '',
        '状态定义：baseline_ready 原齐备；pending 未开始；researching 研究中；drafted 待复评；needs_research 关键资料不足；scope_blocked 范围／归属阻断；ready 新说明通过八维。只有 ready 计本轮完成。批次 processed_with_gaps 表示全部处理过但有未完成项。', '',
        '已知后续范围问题仍保留：C08 Yazidi 的动作与教育边界；B04 Chol 与 Yokot\'anob 归属；S01 yeondeunghoe 与圆佛教及“上浮”关系。', '',
        '## 更新日志','', '- 2026-10-04：建立 506 项基线与续接台账，原齐备 3 项，待补 503 项。',
        f'- {DATE}：C01 按项保存研究、补写与复评；最新累计通过 {s["newlyReady"]} 项，输出 {s["newDocuments"]} 份说明；详情见逐项台账。']
    (BASE/'progress.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')

def record(slug):
    p=read(BASE/'progress.json')
    i=next(i for i in p['items'] if i['slug']==slug)
    path=SUP/'reviews'/f'{slug}.json'; r=read(path)
    assert r['slug']==slug and r['batchId']==i['batchId']
    status=r.get('workflowStatus','ready' if r['readiness']=='ready' else 'needs_research')
    i.update(status=status, selectedDisplay=r['selectedDisplay'],outputFiles=[f'content/display-notes/{slug}.md'],
        reviewFile=path.relative_to(ROOT).as_posix(),verifiedSources=[s for s in r['sources'] if s.get('verified',True)],
        checkpoint=r['checkpoint'],remainingGaps=r['gaps'],updatedAt=DATE)
    rebuild(p)
    print(slug,status,p['summary']['newlyReady'],p['nextAction']['slug'])

if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('slug',nargs='?'); args=parser.parse_args()
    if args.slug: record(args.slug)
    else: rebuild(read(BASE/'progress.json'))
