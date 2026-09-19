# Notebook source hunt C9 report

- **日期：** 2026-09-19
- **Scope:** SOURCE enrichment only (not full Notebook validation)
- **Cards:** 12 thin C-grade traditions from C9 (ga-traditional → lezgin-traditional)
- **Rule:** Appended specific URLs under `## 参考来源`; appended unique URLs to `SOURCES.md`. Grades and ritual/how-to content were not changed. Weak overview links (Britannica place overviews, encyclopedia.com, everyculture overviews) were removed only where replaced by better verified sources; 101lasttribes / joshuaproject directory pages were skipped per standing rule.
- **Verification:** Every kept DOI was checked against the Crossref API (title/container/abstract) for topical fit; every kept non-DOI URL was fetched (HTTP 200) and, for PDFs, content-checked for the tradition's keywords. 403/429 on skemman.is and metmuseum.org are bot-blocks on valid pages — both were confirmed by independent lookups (thesis record "Women and Northern Paganism… Ásatrú in Iceland", handle 1946/48719; Met object 768372 = "Prestige Panel, Kuba peoples, Shoowa group"). Hunt candidates that were off-topic, dead (404/DNS), or generic were dropped (noted per slug below).
- **Card URLs added:** 32
- **Card URLs removed (cleanup):** 7
- **SOURCES.md unique URLs added:** 32

## Per-slug additions

### 1. ga-traditional

- **Added (3):**
  - https://visitghana.com/homowo-festival/
  - https://doi.org/10.38159/ehass.2022386
  - https://doi.org/10.1080/23311886.2024.2340427
- **Removed/replaced (1 weak place overview):**
  - https://www.britannica.com/place/Ghana
- **Dropped from hunt (off-topic on verification):**
  - https://doi.org/10.1017/asr.2014.95 (Crossref: "Informal Institutions and Personal Rule in Urban Ghana" — political clientelism, not Ga ritual/festival content)
- **Final source count:** 5

### 2. gagauz-traditional

- **Added (3):**
  - https://doi.org/10.65324/jgs001 (Crossref: "From Saint George to Hederlez: The Transformation of the Name and Ritual Tradition in Gagauz Culture", Journal of Gagauz Studies)
  - https://old.gov.md/en/content/moldovan-pm-says-dialogue-mutual-respect-represent-foundation-stones-social-cohesion (page text confirms Gagauzia/Comrat focus)
  - https://invest.gov.md/wp-content/uploads/2024/06/EN_Agenda%20de%20Evenimente%202024.pdf (2024 events agenda lists Hederlez at Ceadir-Lunga, Gagauzia)
- **Removed/replaced (1 weak place overview):**
  - https://www.britannica.com/place/Moldova
- **Dropped from hunt (dead link):**
  - https://ancd.gov.md/sites/default/files/document/attachments/Raport%20final%20anual%202023%20Program%20de%20Stat.pdf (HTTP 404)
- **Final source count:** 5

### 3. hoa-hao

- **Added (3):**
  - https://doi.org/10.1525/vs.2022.17.4.18 (Crossref abstract: Hòa Hảo healers, charity and reconciliation in the Vietnam–Cambodia borderland)
  - https://doi.org/10.32388/T8IX52 (Crossref: "Vietnam's Religious Policy: Navigating the Path to Religious Freedom")
  - https://cms.btgcp.gov.vn/upload/documents/03_11_2021/tai-lieu-boi-duong-de-an-2021-11-03-16-41-27.pdf (Vietnam Government Committee for Religious Affairs training document; PDF contains a dedicated chapter "Chuyên đề 6. Khái quát về Phật giáo Hòa Hảo ở Việt Nam", 174 mentions)
- **Dropped from hunt (off-topic on verification):**
  - https://doi.org/10.1017/S0026749X17000452 (Crossref: Diệm-era nation-building; no Hòa Hảo focus in abstract)
- **Final source count:** 6

### 4. icelandic-asatru

- **Added (3):**
  - https://skemman.is/bitstream/1946/48719/1/Rozalie_Rasovska_thesis_final.pdf (verified via handle 1946/48719: Rašovská, "Women and Northern Paganism: Feminine Aspects of Contemporary Pagan Organization Ásatrú in Iceland", 2024; host returns 403 to bots)
  - https://austurfrett.is/frettir/asatruarfolk-i-austurlands-aetlar-adh-byggja-hof-a-heradhi
  - https://guidetoiceland.is/history-culture/vikings-and-norse-gods-in-iceland
- **Skipped (redundant with card):** https://asatru.is/ (homepage; card already cites the organization's about page)
- **Final source count:** 6

### 5. kamba-traditional

- **Added (2):**
  - https://www.easpublisher.com/get-articles/5413 (PDF: "Echoes of the Past: Exploring the Kamba History through Traditional Songs", East African Scholars J. Education, Humanities & Literature)
  - https://lughayangu.com/post/syokimauthe-mysterious-kamba-prophetess
- **Dropped from hunt:**
  - https://machakoskenya.com/akamba-culture/religion (HTTP 404)
  - https://www.101lasttribes.com/tribes/kamba.html (weak tribal-directory page; skipped per standing rule)
- **Final source count:** 5

### 6. kimbanguism

- **Added (3):**
  - https://doi.org/10.1086/728884 (Sarró, "The way of the prophets: History, structure, imagination", HAU 13(3) 2023 — the Lévi-Strauss Lecture 2021, drawing on the author's Kimbanguist-movement ethnography)
  - https://doi.org/10.1163/2211-2685_eco_K37 (Brill Encyclopedia of Christianity Online: "Kimbanguist Church")
  - https://doi.org/10.1017/CHOL9780521815000.008 (Cambridge History of Christianity: "Independency in Africa and Asia")
- **Final source count:** 6

### 7. konkokyo

- **Added (3):**
  - https://konkokyo.jp/eng/our_faith/how_to_worship.html
  - https://nirc.nanzan-u.ac.jp/journal/15/article/1824/pdf/download (PDF: Schneider, "Konko-kyo: A Religion of Mediation")
  - https://www.konkofaith.org/what-is-konko
- **Skipped (already on card):** https://konkokyo.jp/eng/our_faith/religious_beliefs.html
- **Final source count:** 6

### 8. konso-traditional

- **Added (2):**
  - https://visitethiopia.et/space/konso-cultural-landscape
  - https://www.persee.fr/doc/ethio_0066-2127_2016_num_31_1_1628 (Bekele 2016, Annales d'Éthiopie: "The Memory of Heroes: the Konso Experience" — waka memorial statues; found and verified during application as a replacement for the off-topic hunt candidates)
- **Removed/replaced (2 weak overview links):**
  - https://www.everyculture.com/Africa-Middle-East/Konso-Religion-and-Expressive-Culture.html
  - https://www.encyclopedia.com/humanities/encyclopedias-almanacs-transcripts-and-maps/konso
- **Dropped from hunt (off-topic/unreachable on verification):**
  - https://doi.org/10.1080/2331186X.2022.2046241 (Crossref: Gadaa system in Ethiopian curricula — Oromo, not Konso)
  - https://dx.doi.org/10.1108/JCHMSD-12-2020-0180 (Crossref: European dry-stone walling ICH, not Konso)
  - https://www.elmitourethropia.com/index.php/ethiopia/unesco-registered-sites/konso-cultural-landscape (DNS failure)
- **Final source count:** 3

### 9. kuba-traditional

- **Added (3):**
  - https://www.metmuseum.org/essays/kingdoms-of-the-savanna-the-kuba-kingdom (429 bot-block; stable Met essay)
  - https://www.britishmuseum.org/collection/object/E_Af1909-1210-1 (BM Kuba figure)
  - https://www.metmuseum.org/art/collection/search/768372 (429 bot-block; verified via lookup as "Prestige Panel, Kuba peoples, Shoowa group")
- **Dropped from hunt (off-topic on verification):**
  - https://doi.org/10.1080/23311983.2025.2474848 (Crossref: Chinese and West African figurative sculptures — not Kuba)
- **Final source count:** 6

### 10. lahu-traditional

- **Added (2):**
  - http://en.people.cn/n3/2016/1223/c208675-9158529.html ("Lahu people's Gourd Festival")
  - https://www.yunnanexploration.com/calabash-gourd-festival-of-luhu-ethnic-minority-in-ximeng-county-puer.html
- **Removed/replaced (1 weak place overview):**
  - https://www.encyclopedia.com/places/asia/chinese-political-geography/lahu
- **Skipped per standing rule:** https://joshuaproject.net/people_groups/12949/CH (weak people-group directory page)
- **Final source count:** 4

### 11. lao-baci-phi

- **Added (1):**
  - https://www.watbuddhavong.org/wlb-updates/boun-that-luang/ (Wat Lao Buddhavong: Boun That Luang festival write-up)
- **Dropped from hunt (off-topic/generic on verification):**
  - https://doi.org/10.1355/sj5-2a (Crossref: "Changing Patterns of Marriage and Household Formation in Peninsular Malaysia" — not baci/su khwan)
  - https://ich.unesco.org/en/sustainable-development-toolbox-00987 (generic UNESCO toolbox page, no Lao-specific content)
- **Note:** https://doi.org/10.1163/15734218-12341548 in the hunt list was already dropped in C8 as a COVID vaccine-trust study among Hmong in Laos; dropped again here for the same reason.
- **Final source count:** 4

### 12. lezgin-traditional

- **Added (4):**
  - https://religion.ranepa.ru/jour/article/view/86/0?locale=en_US (State, Religion and Church in Russia and Abroad; article text confirms Lezgin hagiography in southern Dagestan)
  - https://chaikhana.media/en/stories/667/dagestans-holy-mountain-pilgrimage (Mt. Shalbuzdag pilgrimage; report explicitly covers Lezgin villages Karakyure/Khryug)
  - https://dergipark.org.tr/tr/download/article-file/1890781 (Şalbuzova, Vakanüvis 6/2 2021; Lezgic-speaking Gryz ethnographic traditions, 16 Lezgi references in text)
  - https://spb.hse.ru/soc/illuminated/news/352639612.html (HSE SPb: "Village In The Sky: Visiting A Lezgin Family")
- **Removed/replaced (2 weak overview links):**
  - https://www.everyculture.com/Russia-Eurasia-China/Lezgins-Religion-and-Expressive-Culture.html
  - https://www.encyclopedia.com/topic/Lezgians.aspx
- **Final source count:** 5

## Dedup / quality rules applied

1. No URL was appended to a card that already appeared on that card, in `SOURCES.md`, or anywhere else in `traditions/` (global grep before write).
2. Every DOI was resolved through `api.crossref.org` and kept only if its title/container matched the card's tradition; off-topic DOIs (Gadaa, Malaysian marriage, Diệm nation-building, Chinese/West-African sculpture, European dry-stone) were dropped.
3. PDFs were downloaded and keyword-checked (Hederlez/Hòa Hảo/Kamba songs/Konko-kyo/Lezgi) before being kept.
4. 101lasttribes and joshuaproject URLs were skipped per standing rule; Britannica place overviews and encyclopedia.com/everyculture overview pages were removed only on cards that gained verified replacements.
5. Bot-blocked hosts (skemman.is 403, metmuseum.org 429) were kept only after independent verification of the exact item.

## SOURCES.md

- Appended section `增补传统（Notebook source hunt C9：加族—列兹金）` with 32 new unique URLs (all 32 card additions were globally new; none previously existed in `SOURCES.md` or other cards).
