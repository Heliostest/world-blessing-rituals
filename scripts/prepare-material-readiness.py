"""Build audit assignments from existing grades; does not assess content."""
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parents[1]
output = root / "artifacts/material-readiness"
output.mkdir(parents=True, exist_ok=True)
records = []
for path in sorted((root / "content/traditions").glob("*.md")):
    content = path.read_text(encoding="utf-8-sig")
    match = re.search(r"档位[：:]\*\*\s*([ABC])", content)
    if match and match[1] in ("B", "C"):
        records.append({"slug": path.stem, "title": content.splitlines()[0].lstrip("# ").strip(),
                        "grade": match[1], "sourceFile": path.relative_to(root).as_posix()})
assignments = [[], [], []]
for grade in ("C", "B"):
    group = [item for item in records if item["grade"] == grade]
    for index, item in enumerate(group):
        item["batchId"] = f"{grade}{index // 20 + 1:02d}"
        assignments[index % 3].append(item)
for index, items in enumerate(assignments, 1):
    (output / f"assignment-{index}.json").write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
(output / "inventory.json").write_text(json.dumps(sorted(records, key=lambda x: (x["grade"] != "C", x["slug"])), ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"total": len(records), "C": sum(x["grade"] == "C" for x in records),
                  "B": sum(x["grade"] == "B" for x in records), "assignments": [len(x) for x in assignments]}))
