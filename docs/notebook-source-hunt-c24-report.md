# Notebook source hunt C24 report

- **日期：** 2026-09-19
- **范围：** 仅补强来源；未改动卡片正文、档位或仪式内容。
- **卡片：** 12 张薄 C 级卡片（接 `secoya-traditional` 后按字母序续选；不以已有 4+ 来源卡填充）。
- **输入 URL：** 30 条；按卡片去重后全部写入候选集合.
- **卡片 URL 新增：** 28 条（去除卡片内已有重复 URL）。
- **卡片 URL 移除：** 14 条（Britannica /place/、encyclopedia.com、everyculture.com；另移除 Sherdukpen 的 Wikipedia 总览）。
- **SOURCES.md 唯一 URL 新增：** 22 条。

**输入清理：** Komi/Limerov PDF、Seri 的 Mayo/INAH 候选、Shilluk 的 Murle/Rift Valley 候选、Sherdukpen 的额外 holiday/tourism-policy 候选，以及科特迪瓦 periodic-reporting 弱候选均未写入；它们不在最终 `/tmp/c24-urls.json` 集合中。

**一致性：** 每个卡片的 `## 参考来源` 已去重；新增 URL 以相同字符串写入 SOURCES.md，未重复收录索引已有 URL；移除指定弱概览并遵守本批不使用 Wikipedia 总览的约束。舍杜克彭最终仅 2 条来源，仍是本批最薄卡；塞尔库普最终 3 条且实际新增 1 条，仍需后续谨慎补强。

## Per-slug results

### selkup-traditional
- **最终来源数：** 3
- **新增：**
  - https://atlaskmns.ru/page/en/people_selcupy_modart.html
- **移除：**
  - https://www.encyclopedia.com/humanities/encyclopedias-almanacs-transcripts-and-maps/selkup

### sena-traditional
- **最终来源数：** 4
- **新增：**
  - https://dx.doi.org/10.5772/intechopen.105727
  - https://doi.org/10.3390/su13116478
  - https://doi.org/10.6092/issn.2785-0943/16685
- **移除：**
  - https://www.britannica.com/place/Zambezi-River
  - https://www.britannica.com/place/Mozambique

### senufo-traditional
- **最终来源数：** 5
- **新增：**
  - https://www.metmuseum.org/essays/senufo-arts-and-poro-initiation-in-northern-cote-divoire
  - https://www.metmuseum.org/art/collection/search/312223
- **移除：**
  - 无

### seri-comcaac-traditional
- **最终来源数：** 3
- **新增：**
  - https://www.gob.mx/inpi/articulos/ano-nuevo-comcaac-seri-cultura-y-tradicion-en-el-desierto-sonorense
  - https://www.scielo.org.mx/scielo.php?script=sci_arttext&pid=S0185-16592015000100003
- **移除：**
  - https://www.britannica.com/place/Sonora
  - https://www.britannica.com/place/Gulf-of-California

### shambaa-traditional
- **最终来源数：** 4
- **新增：**
  - https://doi.org/10.2982/0012-8317(1998)87[279:TPFANC]2.0.CO;2
  - https://doi.org/10.1080/17531055.2012.669572
  - https://doi.org/10.1108/978-1-83608-216-320251018
- **移除：**
  - https://www.britannica.com/place/Usambara-Mountains
  - https://www.britannica.com/place/Tanzania

### sharanahua-traditional
- **最终来源数：** 4
- **新增：**
  - https://journals.openedition.org/hybrid/807
  - https://www.scielo.br/j/ra/a/qHzDLSdNrxfPKbtJv33C7hh/?format=html&lang=en&ilang=es
  - https://doi.org/10.1086/711607
- **移除：**
  - https://www.britannica.com/place/Peru
  - https://www.britannica.com/place/Amazon-Rainforest

### sherdukpen-traditional
- **最终来源数：** 2
- **新增：**
  - https://arunachaltourism.com/wp-content/uploads/2021/07/Spirtitual.pdf
- **移除：**
  - https://www.britannica.com/place/Arunachal-Pradesh
  - https://en.wikipedia.org/wiki/Donyi-Polo

### sherpa-buddhist
- **最终来源数：** 5
- **新增：**
  - https://whc.unesco.org/en/list/120
  - https://doi.org/10.3390/rel11080396
  - https://doi.org/10.1016/j.annals.2020.103024
- **移除：**
  - https://www.everyculture.com/wc/Mauritania-to-Nigeria/Sherpas.html

### shilluk-traditional
- **最终来源数：** 4
- **新增：**
  - https://doi.org/10.1080/17531055.2019.1640505
  - https://doi.org/10.3389/fitd.2023.1007480
- **移除：**
  - https://www.britannica.com/place/South-Sudan

### shipibo-konibo
- **最终来源数：** 5
- **新增：**
  - https://ich.unesco.org/en/USL/kene-knowledge-and-aesthetics-of-the-shipibo-konibo-people-02107
  - https://dx.doi.org/10.1108/QMR-05-2023-0071
- **移除：**
  - 无

### shor-traditional
- **最终来源数：** 5
- **新增：**
  - https://atlaskmns.ru/page/en/people_shorcy_spirit.html
  - https://atlaskmns.ru/page/en/people_shorcy_common.html
  - https://doi.org/10.3390/rel14040496
- **移除：**
  - https://www.britannica.com/place/Siberia

### shuar-traditional
- **最终来源数：** 6
- **新增：**
  - https://doi.org/10.3389/fclim.2026.1695925
  - https://doi.org/10.3390/land8120182
  - https://doi.org/10.3390/plants7030067
- **移除：**
  - 无
