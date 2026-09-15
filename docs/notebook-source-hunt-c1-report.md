# Notebook source hunt C1 report

- **Scope:** SOURCE enrichment only (not full Notebook validation)
- **Cards:** 12 thin C-grade traditions
- **Rule:** Append specific URLs under `## 参考来源`; append unique URLs to `SOURCES.md`. Do not change A/B/C grades or ritual how-to content.
- **Cleanup:** Optional removal of pure Britannica `/place/` pages and encyclopedia.com overviews where better specific sources were added; topic pages retained.
- **Card URLs added:** 30
- **Card URLs removed (cleanup):** 17
- **SOURCES.md unique URLs added:** 29

## Per-slug additions

### 1. jainism

- **Added (3):**
  - https://www.metmuseum.org/essays/jain-manuscript-painting
  - https://jainpedia.org/wp-content/uploads/2021/08/Voulume-1-Catalogue-of-the-Manuscripts-of-the-British-Library.pdf
  - https://www.metmuseum.org/art/collection/search/73824
- **Final source count:** 4

### 2. bashkir-traditional

- **Added (3):**
  - https://doi.org/10.15405/epsbs.2020.11.98
  - https://doi.org/10.22378/2410-0765.2025-15-4.109-127
  - https://tatar-congress.org/en/news/the-26th-tatar-bashkir-national-holiday-sabantuy-was-held-in-arkhangelsk/
- **Removed/replaced (Britannica place / encyclopedia.com):**
  - https://www.encyclopedia.com/humanities/encyclopedias-almanacs-transcripts-and-maps/bashkirs-0
- **Final source count:** 4

### 3. chinese-folk-and-confucian

- **Added (3):**
  - https://ich.unesco.org/en/RL/mazu-belief-and-customs-00227
  - https://doi.org/10.54254/2753-7048/51/20240985
  - https://doi.org/10.3389/fpsyg.2024.1471431
- **Final source count:** 5

### 4. won-buddhism

- **Added (3):**
  - https://wonbuddhism.org/teachings/
  - https://doi.org/10.1080/15426432.2024.2384381
  - https://doi.org/10.1017/9781009614726
- **Removed/replaced (Britannica place / encyclopedia.com):**
  - https://www.encyclopedia.com/religion/encyclopedias-almanacs-transcripts-and-maps/wonbulgyo
- **Final source count:** 4

### 5. abruzzese-folk

- **Added (1):**
  - https://ich.unesco.org/en/RL/celestinian-forgiveness-celebration-01276
- **Removed/replaced (Britannica place / encyclopedia.com):**
  - https://www.britannica.com/place/Abruzzo
  - https://www.britannica.com/place/LAquila
- **Final source count:** 2

### 6. aland-folk

- **Added (3):**
  - https://visitaland.com/en/experience/sights-excursions/aland-churches/
  - https://visitaland.com/en/experience/midsummer-in-aland/
  - https://www.nordiskamuseet.se/utforska/hogtider/midsommar/
- **Removed/replaced (Britannica place / encyclopedia.com):**
  - https://www.britannica.com/place/Aland-Islands
  - https://www.britannica.com/place/Finland
- **Final source count:** 4

### 7. andalusian-folk

- **Added (3):**
  - https://guiadigital.iaph.es/bien/inmaterial/195121
  - https://repositorio.iaph.es/handle/11532/324987
  - https://www.juntadeandalucia.es/cultura/agendaculturaldeandalucia/evento/semana-santa-de-almonte
- **Removed/replaced (Britannica place / encyclopedia.com):**
  - https://www.britannica.com/place/Andalusia-region-Spain
  - https://www.britannica.com/place/El-Rocio
- **Final source count:** 4

### 8. andorran-folk

- **Added (3):**
  - https://www.govern.ad/ca/tematiques/cultura-i-esports/patrimoni-cultural/que-es-el-patrimoni-immaterial/les-festes-d-interes-cultural/l-aplec-de-la-mare-de-deu-de-meritxell
  - https://museus.ad/en/monumentos/sanctuary-of-meritxell
  - https://www.govern.ad/ca/tematiques/cultura-i-esports/patrimoni-cultural/arxiu-d-etnografia-d-andorra/falles-d-andorra
- **Removed/replaced (Britannica place / encyclopedia.com):**
  - https://www.britannica.com/place/Andorra
  - https://www.britannica.com/place/Pyrenees
- **Final source count:** 4

### 9. aragonese-folk

- **Added (2):**
  - https://patrimonioculturaldearagon.es/patrimonio/fiestas-del-pilar/
  - https://patrimonioculturaldearagon.es/noticias/el-gobierno-de-aragon-anima-a-apoyar-a-la-jota-en-redes-sociales-este-15-de-agosto/
- **Removed/replaced (Britannica place / encyclopedia.com):**
  - https://www.britannica.com/place/Aragon-region-Spain
  - https://www.britannica.com/place/Zaragoza-Spain
- **Final source count:** 3

### 10. aromanian-folk

- **Added (2):**
  - https://ich.unesco.org/en/RL/august-15th-dekapentavgoustos-festivities-in-two-highland-communities-of-northern-greece-tranos-choros-grand-dance-in-vlasti-and-syrrako-festival-01726
  - https://doi.org/10.59277/ICSUGH.SINCAI.28.15
- **Removed/replaced (Britannica place / encyclopedia.com):**
  - https://www.britannica.com/place/Balkans
- **Final source count:** 4

### 11. asturian-folk

- **Added (2):**
  - https://santuariodecovadonga.es/
  - https://www.turismoasturias.es/covadonga/espiritual
- **Removed/replaced (Britannica place / encyclopedia.com):**
  - https://www.britannica.com/place/Asturias
  - https://www.britannica.com/place/Covadonga
- **Final source count:** 3

### 12. basilicata-folk

- **Added (2):**
  - https://www.festadellabruna.it/cose-la-festa/come-si-svolge/
  - https://www.basilicataturistica.it/scopri-la-basilicata/matera-patrimonio-mondiale-dellumanita/matera-e-la-madonna-della-bruna/
- **Removed/replaced (Britannica place / encyclopedia.com):**
  - https://www.britannica.com/place/Basilicata
  - https://www.britannica.com/place/Matera
- **Final source count:** 3

## Notes on URL verification

- Most candidate URLs returned HTTP 200 on HEAD/GET follow.
- Met Museum URLs returned 429 (rate limit); paths look valid and were kept.
- UNESCO ICH pages and basilicataturistica.it timed out from this network; ICH IDs and official paths look sane and were kept (mazu ICH already present in SOURCES.md).
- tatar-congress.org redirects to congress.tatar; kept the provided URL.
- Spanish ICH duplicate for Celestinian forgiveness was not added (English already used).

## SOURCES.md

- Appended section `增补传统（Notebook source hunt C1：耆那—巴西利卡塔）` with 29 new unique URLs (skipped mazu ICH already listed).
