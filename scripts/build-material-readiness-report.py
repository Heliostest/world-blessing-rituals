"""Validate and render human/agent-authored semantic audits, never infer scores."""
import argparse
import csv
import hashlib
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs/material-readiness/2026-10-04"
DIMENSIONS = {
    "context": "文化范围", "objects": "物件材质", "space": "空间关系",
    "sequence": "过程变化", "sensory": "声画表现", "variants": "变体选择",
    "boundaries": "展示边界", "provenance": "来源对应",
}
LABELS = {"ready": "文字齐备", "partial": "部分齐备", "insufficient": "明显不足", "scope_blocked": "范围待厘清"}
REQUIRED = {"slug", "title", "grade", "batchId", "selectedDisplay", "readiness", "narrativeReady", "dimensions", "evidence", "gaps", "nextWriting", "sourceFiles"}
APP_IDS = ("woodfish", "crane", "lantern", "celtic-folk-spring", "theravada-water", "tanzaku-tanabata", "yeondeunghoe", "furin-wind-chime")


def load_reviews():
    records = []
    for path in sorted(OUT.glob("reviews-*.jsonl")):
        for index, line in enumerate(path.read_text(encoding="utf-8-sig").splitlines(), 1):
            if line.strip():
                try:
                    records.append(json.loads(line))
                except json.JSONDecodeError as exc:
                    raise ValueError(f"{path.name}:{index}: invalid JSON: {exc}") from exc
    records.extend(json.loads((OUT / "seed-reviews.json").read_text(encoding="utf-8-sig")))
    records.extend(json.loads((OUT / "app-reviews.json").read_text(encoding="utf-8-sig")))
    return records


def validate(records, inventory, require_complete=False):
    expected = {x["slug"]: x for x in inventory}
    expected.update({f"app-{name}": {"grade": "seed", "batchId": "S01"} for name in APP_IDS})
    errors, seen = [], set()
    for record in records:
        slug = record.get("slug", "<missing>")
        def fail(message):
            errors.append(f"{slug}: {message}")
        if not REQUIRED <= record.keys():
            fail(f"missing fields {sorted(REQUIRED - record.keys())}")
            continue
        if slug not in expected:
            fail("unknown inventory item")
            continue
        if slug in seen:
            fail("duplicate review")
        seen.add(slug)
        for key in ("grade", "batchId"):
            if record[key] != expected[slug][key]:
                fail(f"{key} mismatch")
        if record["grade"] != "seed":
            if record["title"] != expected[slug]["title"]:
                fail("title does not match source inventory")
            if expected[slug]["sourceFile"] not in record["sourceFiles"]:
                fail("primary tradition card missing in sourceFiles")
        if record["readiness"] not in LABELS:
            fail("invalid readiness")
        if type(record["narrativeReady"]) is not bool:
            fail("narrativeReady must be boolean")
        for key in ("selectedDisplay", "title"):
            if not isinstance(record[key], str) or not record[key].strip():
                fail(f"{key} must be nonempty string")
        dims = record["dimensions"]
        if not isinstance(dims, dict) or set(dims) != set(DIMENSIONS):
            fail("dimensions must contain exactly the eight rubric keys")
        else:
            if any(v is not None and (type(v) is not int or v not in (0, 1, 2)) for v in dims.values()):
                fail("dimension values must be 0/1/2/null")
            if any(v is None for v in dims.values()):
                # Older incremental records explain non-applicability in gaps;
                # the rubric requires an explanation, not a specific field name.
                explained = record.get("notApplicableReason") or any("不适用" in x for x in record["gaps"])
                if not explained:
                    fail("null dimension requires an explicit non-applicability explanation")
            if record["readiness"] == "ready":
                for key in ("context", "objects", "space", "variants", "boundaries", "provenance"):
                    if dims[key] != 2:
                        fail(f"ready requires {key}=2")
                if dims["sequence"] != 2 and dims["sequence"] is not None:
                    fail("ready requires sequence=2 or explained not applicable")
                if dims["sensory"] not in (1, 2):
                    fail("ready requires sensory>=1")
        for key in ("gaps", "nextWriting", "sourceFiles"):
            allow_empty = key == "gaps" and record["readiness"] == "ready"
            if not isinstance(record[key], list) or (not record[key] and not allow_empty) or any(not isinstance(x, str) or not x.strip() for x in record[key]):
                fail(f"{key} must be nonempty string list")
        for source in record["sourceFiles"]:
            path = (ROOT / source).resolve()
            if not path.is_relative_to(ROOT) or not path.is_file():
                fail(f"source file missing or outside repository: {source}")
        evidence = record["evidence"]
        if not isinstance(evidence, list) or len(evidence) < 2:
            fail("at least two evidence citations required")
            continue
        for item in evidence:
            if not isinstance(item, dict) or not {"file", "line", "quote", "reason"} <= item.keys():
                fail("invalid evidence schema")
                continue
            if item["file"] not in record["sourceFiles"]:
                fail(f"evidence source missing in sourceFiles: {item['file']}")
            path = (ROOT / item["file"]).resolve()
            if not path.is_relative_to(ROOT) or not path.is_file():
                fail(f"invalid evidence source: {item['file']}")
                continue
            lines = path.read_text(encoding="utf-8-sig").splitlines()
            number, quote = item["line"], item["quote"]
            if type(number) is not int or not 1 <= number <= len(lines):
                fail(f"evidence line out of range: {item['file']}:{number}")
            elif not isinstance(quote, str) or not quote.strip() or quote not in lines[number - 1]:
                fail(f"quote does not occur on declared line: {item['file']}:{number}: {quote}")
            if not isinstance(item["reason"], str) or not item["reason"].strip():
                fail("evidence reason missing")
    missing = sorted(set(expected) - seen)
    if require_complete and missing:
        errors.append(f"missing {len(missing)} reviews: {', '.join(missing[:15])}")
    if errors:
        raise ValueError("\n".join(errors))
    return missing


def relative_link(source, line=None, from_batch=True):
    prefix = "../../../../" if from_batch else "../../../"
    # GitHub line anchors remain useful in exported repository reports.
    return f"{prefix}{source}" + (f"#L{line}" if line else "")


def render_record(record):
    grade_label = "不适用（App 独立专题）" if record["grade"] == "seed" else record["grade"]
    lines = [f"## {record['title']}", "", f"- ID：`{record['slug']}`；原档位：{grade_label}。",
             f"- 结论：**{LABELS[record['readiness']]}**；文化介绍卡：{'可编辑' if record['narrativeReady'] else '需补基本范围后编辑'}。",
             f"- 选定展示切片：{record['selectedDisplay']}", "",
             "| 文化范围 | 物件材质 | 空间关系 | 过程变化 | 声画表现 | 变体选择 | 展示边界 | 来源对应 |",
             "| --- | --- | --- | --- | --- | --- | --- | --- |",
             "| " + " | ".join("不适用" if record['dimensions'][key] is None else str(record['dimensions'][key]) for key in DIMENSIONS) + " |", ""]
    if record.get("notApplicableReason"):
        lines.extend([f"不适用说明：{record['notApplicableReason']}", ""])
    lines.extend(["已有文字与判断证据：", ""])
    for item in record["evidence"]:
        lines.append(f"- [{item['file']}:{item['line']}]({relative_link(item['file'], item['line'])})：「{item['quote']}」——{item['reason']}")
    lines.extend(["", "材料缺口：", ""])
    lines.extend(f"- {gap}" for gap in record["gaps"])
    if not record["gaps"]:
        lines.append("- 本次选定切片未发现阻断性文字缺口，后续编辑任务见下。")
    lines.extend(["", "下一步补写：", ""])
    lines.extend(f"- {task}" for task in record["nextWriting"])
    lines.extend(["", "评估读取文件：" + "、".join(f"[{source}]({relative_link(source)})" for source in record["sourceFiles"]), ""])
    return lines


def render(records, inventory, missing):
    batches = defaultdict(list)
    for record in records:
        batches[record["batchId"]].append(record)
    for items in batches.values():
        items.sort(key=lambda x: x["slug"])
    batch_keys = [f"C{i:02d}" for i in range(1, 9)] + [f"B{i:02d}" for i in range(1, 19)] + ["S01"]
    (OUT / "batches").mkdir(exist_ok=True)
    expected_by_batch = Counter(x["batchId"] for x in inventory)
    expected_by_batch["S01"] = len(APP_IDS)
    for key in batch_keys:
        items = batches.get(key, [])
        counts = Counter(x["readiness"] for x in items)
        lines = [f"# 展示材料齐备性评估 · {key}", "", "日期：2026-10-04。评估现有文字，不要求模型、素材文件、代码或交互脚本的具体实现。", "",
                 f"已审阅 {len(items)}/{expected_by_batch[key]} 项。" + "；".join(f"{LABELS[k]} {counts[k]}" for k in LABELS) + "。", "",
                 "[总览](../README.md) · [评估口径](../rubric.md)", "", "维度：0 缺失，1 概念／存在关键歧义，2 具体可用。来源对应评价只针对仓库文字，不表示本次访问或验证了外网。", ""]
        if len(items) != expected_by_batch[key]:
            lines.extend(["**本批尚未全部审阅；未审项不计入齐备结论。**", ""])
        for item in items:
            lines.extend(render_record(item))
        (OUT / "batches" / f"{key}.md").write_text("\n".join(lines), encoding="utf-8")
    order = {key: i for i, key in enumerate(batch_keys)}
    records.sort(key=lambda x: (order[x["batchId"]], x["slug"]))
    source_files = sorted(set(x for record in records for x in record["sourceFiles"]))
    source_hashes = {source: hashlib.sha256((ROOT / source).read_bytes()).hexdigest() for source in source_files}
    counts = {grade: dict(Counter(x["readiness"] for x in records if x["grade"] == grade)) for grade in ("C", "B", "seed")}
    result = {"schemaVersion": 1, "assessedAt": "2026-10-04", "scope": {"C": 156, "B": 342, "seed": len(APP_IDS)},
              "method": "逐项本地文字语义审阅；未重新核验外网；不评估代码和实际资产实现",
              "complete": not missing, "counts": counts, "missing": missing,
              "sourceSha256": source_hashes, "items": records}
    (OUT / "assessment.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    with (OUT / "assessment.csv").open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["批次", "slug", "名称", "原档位", "文字齐备性", "可编辑文化卡", "展示切片", *DIMENSIONS.values(), "缺口", "补写任务"])
        for item in records:
            writer.writerow([item["batchId"], item["slug"], item["title"], item["grade"], LABELS[item["readiness"]], item["narrativeReady"],
                             item["selectedDisplay"], *[item["dimensions"][x] for x in DIMENSIONS], "；".join(item["gaps"]), "；".join(item["nextWriting"])])
    lines = ["# 展示材料齐备性评估", "", "日期：2026-10-04。", "",
             f"本轮逐项审阅 **{len(records)}/506** 项：498 个 B／C 档传统候选与 8 个 App 已接入体验专题。两种评估单位分开计数，部分展示切片重合，不表示共有 506 种习俗；每张传统卡选一个明确允许的展示切片。", "",
             "**评估目标：文字足以支撑后续展示设计与开发。** 不要求 Three.js 场景、模型、贴图、音频或交互脚本实现；过程与状态变化仍须用文字说明。原 A／B／C 档位未修改。227 个 A 档和比较总览不在本轮候选范围内。", "",
             "评估读取现有仓库资料，未补写新的民俗事实，未再次访问外部来源；已有 Notebook 验证不能等同于开发材料齐备。具体标准见[评估口径](rubric.md)。", "",
             "## 总体结论", "", "| 范围 | 已审／总数 | 文字齐备 | 部分齐备 | 明显不足 | 范围待厘清 | 可编辑文化介绍卡 |",
             "| --- | --- | --- | --- | --- | --- | --- |"]
    for grade, total, title in (("C", 156, "C 档短互动候选"), ("B", 342, "B 档图文／氛围候选"), ("seed", len(APP_IDS), "App 已接入体验专题")):
        group = [x for x in records if x["grade"] == grade]
        c = Counter(x["readiness"] for x in group)
        lines.append(f"| {title} | {len(group)}/{total} | {c['ready']} | {c['partial']} | {c['insufficient']} | {c['scope_blocked']} | {sum(x['narrativeReady'] for x in group)} |")
    if missing:
        lines.extend(["", f"**仍有 {len(missing)} 项未审，不将其按缺失材料或已齐备计数。**"])
    lines.extend(["", "“可编辑文化介绍卡”与“文字齐备”是两个独立结论：已有地域、含义与边界可以支持简短科普，但不代表器物、空间和过程已可交给设计者执行。", "",
                  "## 已齐备的选定切片", ""])
    for item in records:
        if item["readiness"] == "ready":
            lines.append(f"- [{item['title']}](batches/{item['batchId']}.md)：{item['selectedDisplay']}。")
    lines.extend(["", "以上齐备结论只对应所选切片，不扩大到整项传统及其全部仪式、器型或地域。", "", "## 需要先厘清范围的条目", ""])
    for item in records:
        if item["readiness"] == "scope_blocked":
            lines.append(f"- [{item['title']}](batches/{item['batchId']}.md)：{item['gaps'][0]}")
    lines.extend(["", "## 各维度的材料状况", "", "以下只统计已审的传统候选，App 已接入体验专题另列，避免拉高传统条目的齐备程度。", "",
                  "| 文字维度 | 缺失 0 | 概念／歧义 1 | 具体可用 2 | 不适用 |", "| --- | --- | --- | --- | --- |"])
    traditions = [x for x in records if x["grade"] != "seed"]
    for key, label in DIMENSIONS.items():
        c = Counter(x["dimensions"][key] for x in traditions)
        lines.append(f"| {label} | {c[0]} | {c[1]} | {c[2]} | {c[None]} |")
    lines.extend(["", "## 批次索引", "", "C01–C08 为 156 个短互动候选，B01–B18 为 342 个图文／氛围候选，S01 为 8 个已接入 App 的体验专题。每批最多 20 项，按 slug 排序，批次编号固定。", "",
                  "| 批次 | 已审／总数 | 文字齐备 | 部分齐备 | 明显不足 | 范围待厘清 |", "| --- | --- | --- | --- | --- | --- |"])
    for key in batch_keys:
        c = Counter(x["readiness"] for x in batches[key])
        lines.append(f"| [{key}](batches/{key}.md) | {len(batches[key])}/{expected_by_batch[key]} | {c['ready']} | {c['partial']} | {c['insufficient']} | {c['scope_blocked']} |")
    lines.extend(["", "## 后续补写怎么用", "",
                  "1. 先固定每条的展示切片、地域／器型及原创选择，避免把整张传统卡中的几种习俗拼成一个场景。",
                  "2. 对照各条的补写任务，写出物件与材质结构、环境位置和过程起止状态。B 档只写公开可见内容，不为齐备而补用户主持礼仪。",
                  "3. 给关键形制和文化陈述补上对应来源；将未经考据的比例、色调和节奏明确写为产品决定。",
                  "4. 补写完成后重新按八维评估。当前报告只指出缺口，不把待研究问题直接补成事实。", "",
                  "完整逐项内容见批次报告；[JSON 台账](assessment.json)含来源文件指纹与证据，[CSV 清单](assessment.csv)便于筛选补写任务。具体补写可使用[文字补写模板](writing-template.md)，范围矛盾及复核说明见[审阅备注](review-notes.md)。", ""])
    (OUT / "README.md").write_text("\n".join(lines), encoding="utf-8")
    return {"assessed": len(records), "total": 506, "missing": len(missing), "batches": len(batch_keys), "counts": counts, "evidenceCount": sum(len(x["evidence"]) for x in records)}


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser()
    parser.add_argument("--require-complete", action="store_true")
    args = parser.parse_args()
    inventory = json.loads((ROOT / "artifacts/material-readiness/inventory.json").read_text(encoding="utf-8"))
    records = load_reviews()
    missing = validate(records, inventory, args.require_complete)
    print(json.dumps(render(records, inventory, missing), ensure_ascii=False))
