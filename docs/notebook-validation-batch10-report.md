# Notebook validation batch-10 report

- **Notebook:** https://notebook.google.com/notebook/5db6b6d0-efb3-418a-8cb8-a1bf161a1492
- **Validated at (UTC):** 2026-09-15T10:08:42Z
- **Batch size:** 12 C-grade tradition cards
- **Repo application:** enrichments applied to markdown; `docs/notebook-validation.json` updated
- **CRITICAL fix:** samoan-faa-samoa / scottish-folk text boundary — both files rewritten and verified clean (no Samoan ritual content in Scottish; no Scottish content in Samoan)

## Summary

| Status | Count |
|--------|------:|
| passed | 3 |
| passed_after_fix | 9 |
| needs_fix (pre-edit) | 9 (all → fixed) |
| passed with enrichments | 3 |

## Per-slug results

### 1. romagnol-folk — 需修改 → passed_after_fix

- **结论（校验时）:** 需修改
- **问题:** 需补 Madonna del Monte (Cesena) + Ex-Voto；Madonna del Fuoco (Forlì)；coastal/mountain patron feste。
- **建议修改 / Action:** 重组典型仪式并保持教育概览。
- **档位备注:** C
- **应用后状态:** `passed_after_fix`

### 2. romansh-folk — 需修改 → passed_after_fix

- **结论（校验时）:** 需修改
- **问题:** 需补 Ziteil Marian shrine (2429m)；Chalandamarz (1 Mar) bells；Alpine cattle descent blessing。
- **建议修改 / Action:** 重组典型仪式。
- **档位备注:** C
- **应用后状态:** `passed_after_fix`

### 3. rotuman-traditional — 需修改 → passed_after_fix

- **结论（校验时）:** 需修改
- **问题:** 需补 Kato'aga feast；Apei fine mats；Kava ceremony；Rotuma Day。
- **建议修改 / Action:** Kava 仅概念、无调制／词令 how-to。
- **档位备注:** C
- **应用后状态:** `passed_after_fix`

### 4. salentino-folk — 需修改 → passed_after_fix

- **结论（校验时）:** 需修改
- **问题:** 需补 Santa Maria de Finibus Terrae；Fòcara di Novoli；San Rocco / Pizzica as cultural vow dance（NOT possession spectacle）。
- **建议修改 / Action:** Pizzica 明确非附体奇观。
- **档位备注:** C
- **应用后状态:** `passed_after_fix`

### 5. sammarinese-folk — 需修改 → passed_after_fix

- **结论（校验时）:** 需修改
- **问题:** 需补 Sep 3 Saint Marinus / founding day；relics Mass；Capitani Reggenti inauguration Mass；Basilica del Santo。
- **建议修改 / Action:** 补充命名；禁止戏仿国务。
- **档位备注:** C
- **应用后状态:** `passed_after_fix`

### 6. samoan-faa-samoa — 需修改 → passed_after_fix（布局＋边界）

- **结论（校验时）:** 需修改
- **问题:** FIX layout；Ifoga fine-mat apology CONCEPT；Lotu/Sā evening prayer；ʻAva；ʻIe Samoa；Sunday worship；keep restricted knowledge notes；与 scottish-folk 边界风险。
- **建议修改 / Action:** 重排典型仪式；限制性知识仅点名；验证无苏格兰内容混入。
- **档位备注:** C
- **应用后状态:** `passed_after_fix`
- **边界验证:** clean（无 Scottish tokens）

### 7. savoyard-folk — 需修改 → passed_after_fix

- **结论（校验时）:** 需修改
- **问题:** 需补 Notre-Dame de la Gorge；Notre-Dame de Myans Black Madonna；Désalpe；patron processions。
- **建议修改 / Action:** 重组典型仪式。
- **档位备注:** C
- **应用后状态:** `passed_after_fix`

### 8. scanian-folk — 需修改 → passed_after_fix

- **结论（校验时）:** 需修改
- **问题:** 需补 Mårtensafton goose feast；Sankt Olof holy well/church；midsummer maypole；life rites。
- **建议修改 / Action:** 重组典型仪式。
- **档位备注:** C
- **应用后状态:** `passed_after_fix`

### 9. scottish-folk — 需修改 → passed_after_fix（CRITICAL 边界修复）

- **结论（校验时）:** 需修改
- **问题:** Samoan bleed／labels truncated；需补 Munlochy Clootie Well；Hogmanay/First-Footing；Iona pilgrimage；parish worship。
- **建议修改 / Action:** 整卡重写为纯苏格兰内容；验证无萨摩亚仪式文本。
- **档位备注:** C
- **应用后状态:** `passed_after_fix`
- **边界验证:** clean（无 matai／ʻava／Ifoga／Faʻa Sāmoa 仪式内容；仅有「不可混同／不含萨摩亚」声明）

### 10. purepecha — passed（with enrichments）

- **结论（校验时）:** 通过（需 enrichment）
- **问题:** 强调 Pátzcuaro / Janitzio Día de Muertos；K'uínchekua；cargo fiestas；godparent ties。
- **建议修改 / Action:** 丰富公共文化层命名。
- **档位备注:** C
- **应用后状态:** `passed`

### 11. quaker — passed（with enrichments）

- **结论（校验时）:** 通过（需 enrichment）
- **问题:** 强调 Inner Light；SPICES；Clearness Committee；Meeting for Worship；business meeting。
- **建议修改 / Action:** 丰富公开治理／见证表述；无神启 how-to。
- **档位备注:** C
- **应用后状态:** `passed`

### 12. sardinian-folk — passed（with enrichments）

- **结论（校验时）:** 通过（需 enrichment）
- **问题:** 增加 S'Efisio (Cagliari) pilgrimage；保留 Faradda／Cumbessias／Redentore。
- **建议修改 / Action:** 在典型仪式中并入 S'Efisio。
- **档位备注:** C
- **应用后状态:** `passed`

## Inventory counts after application

See `docs/notebook-validation.json` → `counts`:

- total: 726
- pending: 605
- passed: 50
- passed_after_fix: 70
- skipped: 1

## Policy notes applied

- Educational overview tone retained; grades remain C.
- `手机互动适合度` sections left intact / retained on all 12 cards.
- No operational initiation, sacrifice, or secret-ritual how-to steps.
- Samoan Ifoga / ʻAva / tatau framed CONCEPT / restricted-knowledge only.
- Salentino Pizzica framed as cultural vow dance, NOT possession spectacle.
- Rotuman kava: concept only, no recipe/script.
- Scottish Clootie Well: no magic wish-formula; Hogmanay as public folk layer.
