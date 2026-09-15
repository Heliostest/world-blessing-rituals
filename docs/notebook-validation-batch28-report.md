# Notebook validation batch-28 report

- **Notebook:** https://notebook.google.com/notebook/5db6b6d0-efb3-418a-8cb8-a1bf161a1492
- **Validated at (UTC):** 2026-09-15T14:24:30Z
- **Batch size:** 12 B-grade tradition cards
- **Repo application:** enrichments applied to markdown; `docs/notebook-validation.json` updated; specific sources appended to card `## 参考来源` and `SOURCES.md`
- **Note:** Continuing **B-grade** Notebook batches (after batch-27). Atmosphere-only / no user-officiating.
- **Source rule (Helio 2026-09-15):** each card ends with 2–4 specific sources (ICH/UNESCO, official festival, museum, ethnography/DOI); no new generic Britannica place / encyclopedia.com overview pages.

## Summary

| Status | Count |
|--------|------:|
| passed | 4 |
| passed_after_fix | 8 |
| needs_fix (pre-edit) | 8 (all → fixed) |
| passed with enrichments | 4 |

## Text boundary fixes

| Pair | Result |
|------|--------|
| mari-traditional.md / marquesan-traditional.md | **Not mixed.** Mari file contains only Volga Mari / Küsooto content; Marquesas file is standalone Te Henua ʻEnata / Matavaa. No cross-title bleed found on disk; both rewritten as standalone. |
| mayo-traditional.md / melanesia.md | **Not mixed.** Mayo file is Yoreme-only (deer dance / Juya Ania); Melanesia file is Melanesia-only (sand drawing / kastom). No cross-title bleed found on disk; both rewritten as standalone. |

## Per-slug results

### 1. manobo-traditional — 需修改 → passed_after_fix

- **结论（校验时）:** 需修改
- **问题:** 需补 Magbabaya high god CONCEPT; Kaamulan/Samaya harvest public; Baylan/Baylanon HIGH SENSITIVITY CONCEPT/viewing; Dagmay weaving cultural — users don't officiate Baylan。
- **建议修改 / Action:** 重组典型仪式；Magbabaya CONCEPT；Kaamulan/Samaya 公共；Baylan viewing/CONCEPT ONLY；Dagmay 文化；禁止用户主持 Baylan。
- **档位备注:** B
- **应用后状态:** `passed_after_fix`

### 2. manus-traditional — 需修改 → passed_after_fix

- **结论（校验时）:** 需修改
- **问题:** 需补 Lapan chiefs; Moen Palit HIGH SENSITIVITY CONCEPT; Titan/Usiai maritime trade; Lapan wealth exchange viewing; funeral CONCEPT。
- **建议修改 / Action:** 重组典型仪式；Lapan；Moen Palit CONCEPT；Titan/Usiai；财富交换 viewing；丧礼 CONCEPT；禁止用户主持。
- **档位备注:** B
- **应用后状态:** `passed_after_fix`

### 3. marquesan-traditional — 需修改 → passed_after_fix

- **结论（校验时）:** 需修改
- **问题:** FIX bleed；需补 Matavaa o te Henua Enana；Me'ae CONCEPT；Tiki；Tatau；Tuhuka CONCEPT — users don't officiate。
- **建议修改 / Action:** 确认独立 Marquesas 文件；Matavaa 公共文化；Me'ae/Tiki/Tatau/Tuhuka CONCEPT；禁止用户主持。
- **档位备注:** B
- **应用后状态:** `passed_after_fix`

### 4. marshallese-traditional — 需修改 → passed_after_fix

- **结论（校验时）:** 需修改
- **问题:** 需补 Kāāitōk/Wāwa stick charts; Iroij/Iroijlaplap; Weto; Nonieb CONCEPT; Kemem/Kamool viewing; navigation blessing CONCEPT — users don't host chiefly rites。
- **建议修改 / Action:** 重组典型仪式；棍图；酋长／氏族地；Nonieb；Kemem viewing；航海祝福 CONCEPT；禁止用户主持酋长仪礼。
- **档位备注:** B
- **应用后状态:** `passed_after_fix`

### 5. matlatzinca-traditional — 需修改 → passed_after_fix

- **结论（校验时）:** 需修改
- **问题:** 需补 Nevado de Toluca/Xinantécatl viewing; San Francisco Oxtotilpan; Mayordomía fiesta public; herbal healing HIGH SENSITIVITY CONCEPT。
- **建议修改 / Action:** 重组典型仪式；圣山观礼；Oxtotilpan Mayordomía 公开；草药疗愈 CONCEPT；禁止用户主持。
- **档位备注:** B
- **应用后状态:** `passed_after_fix`

### 6. mayo-traditional — 需修改 → passed_after_fix

- **结论（校验时）:** 需修改
- **问题:** FIX bleed；Danza del Venado and Pascola as public ICH/performance — users don't dance as ritual specialists；Juya Ania；Sewa CONCEPT。
- **建议修改 / Action:** 确认 Mayo-only；鹿舞／Pascola 公共观礼；Juya Ania／Sewa CONCEPT；禁止用户以仪者身份起舞。
- **档位备注:** B
- **应用后状态:** `passed_after_fix`

### 7. mazahua-traditional — 需修改 → passed_after_fix

- **结论（校验时）:** 需修改
- **问题:** 需补 Romería al Señor de Chalma；Danza de las Pastoras；Parakata；Curandero HIGH SENSITIVITY CONCEPT。
- **建议修改 / Action:** 重组典型仪式；Chalma 朝圣公开；Pastoras；Parakata 象征；Curandero CONCEPT；禁止用户主持。
- **档位备注:** B
- **应用后状态:** `passed_after_fix`

### 8. melanesia — 需修改 → passed_after_fix

- **结论（校验时）:** 需修改
- **问题:** 统一 layer tags；Vanuatu Sand Drawing UNESCO ICH；Kastom clan-restricted CONCEPT；Shell Money/Pig Exchange；church–kastom public。
- **建议修改 / Action:** 确认 Melanesia-only；统一标签；沙画 ICH；壳币／猪交换；kastom CONCEPT；教会—kastom 公共层。
- **档位备注:** B
- **应用后状态:** `passed_after_fix`

### 9. maori — passed（with enrichments）

- **结论（校验时）:** 通过（需 enrichment）
- **问题:** 强调 Tikanga Māori；Tohunga CONCEPT；Wharenui；Pōwhiri/Haka public；Karakia/marae ethics；Tangihanga respect/viewing — Kaumātua/Tohunga host, users don't officiate。
- **建议修改 / Action:** 丰富上述要点；Kaumātua／Tohunga 主持，用户不主持。
- **档位备注:** B
- **应用后状态:** `passed`

### 10. marapu-sumba — passed（with enrichments）

- **结论（校验时）:** 通过（需 enrichment）
- **问题:** 强调 Pasola national ICH viewing；Uma Mbatangu；Rato CONCEPT — users don't officiate altar/funerary rites。
- **建议修改 / Action:** 丰富 Pasola／Uma／Rato；用户不主持祭坛／丧葬仪礼。
- **档位备注:** B
- **应用后状态:** `passed`

### 11. mari-traditional — passed（with enrichments）

- **结论（校验时）:** 通过（需 enrichment + FIX bleed）
- **问题:** FIX bleed；Küsooto；Kart CONCEPT；Mer/Kurupto；Chumbylat — outsiders don't officiate grove rites。
- **建议修改 / Action:** 确认 Mari-only；丰富圣林／kart／跨村／朝圣；外人不主持圣林仪礼。
- **档位备注:** B
- **应用后状态:** `passed`

### 12. mentawai-arat-sabulungan — passed（with enrichments）

- **结论（校验时）:** 通过（需 enrichment）
- **问题:** 强调 Punun/Pasituat；Sikerei HIGH SENSITIVITY CONCEPT；Uma；tattoo/plant healing CONCEPT — users don't officiate。
- **建议修改 / Action:** 丰富上述要点；用户不主持。
- **档位备注:** B
- **应用后状态:** `passed`

## Inventory counts after application

See `docs/notebook-validation.json` → `counts`:

- total: 726
- pending: 389
- passed: 126
- passed_after_fix: 210
- skipped: 1

## Sources

- **New URLs vs prior card reference lists:** 28
- **New URLs appended to SOURCES.md:** 26
- Generic Britannica place pages removed from several cards (mayo, matlatzinca, marshallese place-only, marquesan place, mentawai place, manobo place, manus place, mazahua place, marapu place, maori Britannica topic, mari Britannica topics) and replaced/kept with ICH/UNESCO, festival, museum, ethnography/DOI sources.

## Policy notes applied

- Educational overview tone retained; grades remain **B**.
- `手机互动适合度` sections emphasized **atmosphere-only / no user-officiating** on all 12 cards.
- No operational initiation, sacrifice, secret, shaman, healer, chiefly, or deer-dance how-to steps.
- Manobo: Magbabaya；Kaamulan/Samaya；Baylan CONCEPT/viewing；Dagmay cultural。
- Manus: Lapan；Moen Palit CONCEPT；Titan/Usiai；funeral CONCEPT。
- Marquesan: Matavaa；Me'ae；Tiki；Tatau；Tuhuka；standalone。
- Marshallese: stick charts；Iroij/Weto；Nonieb；Kemem viewing。
- Matlatzinca: Xinantécatl；Oxtotilpan Mayordomía；herbal healing CONCEPT。
- Mayo: Venado/Pascola public；Juya Ania/Sewa；standalone。
- Mazahua: Chalma；Pastoras；Parakata；Curandero CONCEPT。
- Melanesia: sand drawing ICH；kastom CONCEPT；shell money/pig exchange；church–kastom；standalone。
- Māori: Tikanga；Tohunga；Wharenui；Pōwhiri/Haka；Tangihanga viewing。
- Marapu: Pasola ICH；Uma Mbatangu；Rato CONCEPT。
- Mari: Küsooto；Kart；Mer/Kurupto；Chumbylat；standalone。
- Mentawai: Punun/Pasituat；Sikerei CONCEPT；Uma；tattoo/plant healing CONCEPT。
