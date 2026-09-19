# Notebook source hunt C36 report

- **日期：** 2026-09-19
- **范围：** 仅补强来源；未改动卡片正文、档位或仪式内容。
- **卡片：** 3 张最终清尾卡片——C35 报告 remaining_candidates_after_batch 中的全部候选（shinto、quaker、sardinian-folk）；使用 /tmp/c36-urls.json 作为唯一 URL 映射。
- **输入 URL：** 12 条；跨卡片唯一 12 条。
- **卡片 URL 新增：** 12 条（按卡片去重，每卡 4 条且与既有来源无重复）。
- **卡片 URL 移除：** 4 条（quaker 的全部 Britannica／kids.britannica.com 弱总览页；shinto 与 sardinian-folk 原有来源无弱域名）。
- **SOURCES.md 唯一 URL 新增：** 12 条；无已存在重复。

**一致性：** 每个卡片的参考来源段已去重；新增 URL 以相同字符串写入 SOURCES.md；仅移除指定弱域名，保留其他具体来源。

**收尾说明：** 本轮为 Notebook source hunt 系列的最终清尾批次：处理 C35 后候选池剩余的 3 个 slug，处理完毕后候选池清空（remaining_candidates_after_batch 为空）。仅做来源补强，不改正文。

## Per-slug results

### shinto
- **最终来源数：** 8
- **新增／采用：**
  - https://www.jinjahoncho.or.jp/en/（神社本厅官方网站、国学院大学英文神道资料库与 Oxford 学术 DOI 补充参拜礼仪、御守绘马与当代神道研究语境；既有国学院大学博物馆与大都会艺术博物馆藏品页保留。）
  - http://www2.kokugakuin.ac.jp/e-shinto/（神社本厅官方网站、国学院大学英文神道资料库与 Oxford 学术 DOI 补充参拜礼仪、御守绘马与当代神道研究语境；既有国学院大学博物馆与大都会艺术博物馆藏品页保留。）
  - https://doi.org/10.1093/acprof:oso/9780190621711.001.0001（神社本厅官方网站、国学院大学英文神道资料库与 Oxford 学术 DOI 补充参拜礼仪、御守绘马与当代神道研究语境；既有国学院大学博物馆与大都会艺术博物馆藏品页保留。）
  - https://doi.org/10.1093/jaarel/lfi115（神社本厅官方网站、国学院大学英文神道资料库与 Oxford 学术 DOI 补充参拜礼仪、御守绘马与当代神道研究语境；既有国学院大学博物馆与大都会艺术博物馆藏品页保留。）
- **移除：** 无（原有 4 条具体来源均保留）。

### quaker
- **最终来源数：** 6
- **新增／采用：**
  - https://www.swarthmore.edu/friends-historical-library（Swarthmore 贵格会历史图书馆档案馆、世界贵格会协商委员会 FWCC、英国年会官方 Quaker faith & practice 在线文本与 Oxford Handbook of Quaker Studies 学术 DOI 替换全部 Britannica 弱总览页。）
  - https://fwcc.world/learn/quaker-tradition-practice/（Swarthmore 贵格会历史图书馆档案馆、世界贵格会协商委员会 FWCC、英国年会官方 Quaker faith & practice 在线文本与 Oxford Handbook of Quaker Studies 学术 DOI 替换全部 Britannica 弱总览页。）
  - https://qfp.quaker.org.uk/（Swarthmore 贵格会历史图书馆档案馆、世界贵格会协商委员会 FWCC、英国年会官方 Quaker faith & practice 在线文本与 Oxford Handbook of Quaker Studies 学术 DOI 替换全部 Britannica 弱总览页。）
  - https://doi.org/10.1093/oxfordhb/9780199608676.001.0001（Swarthmore 贵格会历史图书馆档案馆、世界贵格会协商委员会 FWCC、英国年会官方 Quaker faith & practice 在线文本与 Oxford Handbook of Quaker Studies 学术 DOI 替换全部 Britannica 弱总览页。）
- **移除：**
  - https://www.britannica.com/topic/Society-of-Friends
  - https://www.britannica.com/topic/Inner-Light
  - https://www.britannica.com/topic/Society-of-Friends/Teachings
  - https://kids.britannica.com/students/article/Quakers/276607

### sardinian-folk
- **最终来源数：** 10
- **新增／采用：**
  - https://www.isresardegna.it/index.php?xsl=565&s=16&v=9&c=4093&nodesc=1（ISRE 撒丁民族学研究所、撒丁大区文化门户、OpenEdition etnografica 学术期刊 DOI 与 UNESCO canto a tenore 非遗页面补充撒丁民间宗教与民俗研究语境；既有 UNESCO 肩扛游行、意大利文化遗产与官方旅游页面保留。）
  - https://www.sardegnacultura.it/（ISRE 撒丁民族学研究所、撒丁大区文化门户、OpenEdition etnografica 学术期刊 DOI 与 UNESCO canto a tenore 非遗页面补充撒丁民间宗教与民俗研究语境；既有 UNESCO 肩扛游行、意大利文化遗产与官方旅游页面保留。）
  - https://doi.org/10.4000/etnografica.11451（ISRE 撒丁民族学研究所、撒丁大区文化门户、OpenEdition etnografica 学术期刊 DOI 与 UNESCO canto a tenore 非遗页面补充撒丁民间宗教与民俗研究语境；既有 UNESCO 肩扛游行、意大利文化遗产与官方旅游页面保留。）
  - https://ich.unesco.org/en/RL/canto-a-tenore-sardinian-pastoral-song-00165（ISRE 撒丁民族学研究所、撒丁大区文化门户、OpenEdition etnografica 学术期刊 DOI 与 UNESCO canto a tenore 非遗页面补充撒丁民间宗教与民俗研究语境；既有 UNESCO 肩扛游行、意大利文化遗产与官方旅游页面保留。）
- **移除：** 无（原有 6 条具体来源均保留）。
