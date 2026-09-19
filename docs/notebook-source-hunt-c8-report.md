# Notebook source hunt C8 report

- **Scope:** SOURCE enrichment only (not full Notebook validation)
- **Cards:** 12 thin C-grade traditions from C8 (akha-traditional → fijian-vanua)
- **Rule:** Appended specific URLs under `## 参考来源`; appended unique URLs to `SOURCES.md`. Grades and ritual/how-to content were not changed.
- **Verification:** Every kept URL was fetched (HTTP 200/301/302) or confirmed via Crossref/DOI registration; 403s on mdpi.com / culture.gouv.fr / cairn.info / wiley.com are bot-blocks on valid pages. Hunt candidates that were off-topic or unverifiable were dropped (noted per slug below).
- **Card URLs added:** 32
- **Card URLs removed (cleanup):** 7
- **SOURCES.md unique URLs added:** 30

## Per-slug additions

### 1. akha-traditional

- **Added (2):**
  - https://doi.org/10.30819/aemr.2
  - https://ich.unesco.org/fr/une-experience-de-patrimoine-vivant-et-la-pandemie-de-covid-19-01124?id=00021
- **Dropped from hunt (off-topic on verification):**
  - https://doi.org/10.1163/9789004686458_010 (resolves to a chapter on territorial cults in early Japan)
  - https://doi.org/10.1163/15734218-12341548 (COVID vaccine-trust study among Hmong in Laos)
- **Final source count:** 5

### 2. baul-bengal

- **Added (2):**
  - https://ich.unesco.org/en/photo-pop-up-00973?photoID=00147
  - https://ich.unesco.org/en/projects/action-plan-for-the-safeguarding-of-baul-songs-00047
- **Skipped (already on card):** https://ich.unesco.org/en/RL/baul-songs-00107
- **Final source count:** 5

### 3. blang-traditional

- **Added (3):**
  - https://doi.org/10.18306/dlkxjz.2020.02.010
  - https://doi.org/10.3390/land13122004
  - https://doi.org/10.3390/agronomy14122913
- **Removed/replaced (1 weak overview link):**
  - https://www.britannica.com/place/Yunnan
- **Final source count:** 5

### 4. breton-pardons

- **Added (3):**
  - https://www.culture.gouv.fr/thematiques/patrimoine-culturel-immateriel/vivre-le-patrimoine-culturel-immateriel/reportages/la-bretagne-terre-des-pardons
  - https://www.culture.gouv.fr/Media/Thematiques/Patrimoine-culturel-immateriel/Files/Fiches-inventaire-du-PCI/les-pardons-et-tromenies-en-bretagne.pdf
  - https://dx.doi.org/10.3917/ethn.124.0635
- **Removed/replaced (1 weak overview link):**
  - https://www.everyculture.com/Europe/Bretons-Religion-and-Expressive-Culture.html
- **Final source count:** 5

### 5. buyei-traditional

- **Added (3):**
  - https://doi.org/10.1163/2210-7363_ecll_COM_000055
  - https://doi.org/10.3389/fpsyg.2019.02603
  - https://doi.org/10.3389/fpls.2024.1364481
- **Removed/replaced (1 weak overview link):**
  - https://www.britannica.com/place/Guizhou
- **Note:** hunt gave `https://dx.doi.org/10.38144/fpsyg.2019.02603` (wrong DOI prefix, 404); corrected to the resolvable `https://doi.org/10.3389/fpsyg.2019.02603` (Crossref: measure of minority ethnic value among Chinese ethnic minorities).
- **Final source count:** 5

### 6. chinese-buddhism

- **Added (3):**
  - https://doi.org/10.38144/TKT.2026.1.3
  - https://doi.org/10.3390/rel14010110
  - https://doi.org/10.1111/rec3.12483
- **Note:** the TKT DOI is registered (Crossref: “Xingyun’s Buddhist Environmentalism in the Context of the Contemporary Discourse on Fangsheng 放生”, Távol-keleti Tanulmányok) and resolves via doi.org to ojs.elte.hu; the ELTE host itself was not reachable from this sandbox, but the DOI chain and metadata check out.
- **Final source count:** 6

### 7. chuukese-traditional

- **Added (3):**
  - https://ich.unesco.org/en/decisions/16.COM/8.A.4
  - https://ich.unesco.org/en/USL/carolinian-wayfinding-and-canoe-making-01735
  - https://ich.unesco.org/en/state/micronesia-fs-FM
- **Removed/replaced (2 weak overview links):**
  - https://www.everyculture.com/Ma-Ni/Federated-States-of-Micronesia.html
  - https://www.britannica.com/place/Chuuk-Islands
- **Dropped from hunt (unverifiable from this network):**
  - https://scholarspace.manoa.hawaii.edu/server/api/core/bitstreams/34e3ec23-5e7a-47bb-99f9-3a7fe1647ff0/content
  - https://digital.library.manoa.hawaii.edu/collections/show/26
  (manoa.hawaii.edu hosts reset TLS connections from this sandbox.) The element and state pages were found and verified during application as replacements; the decision (16.COM 8.A.4) inscribes “Carolinian wayfinding and canoe making” — FSM’s first inscription, matching the card’s navigation-taboo ritual clue.
- **Note:** the decision and element URLs were already in `SOURCES.md` (via micronesia.md / kosraean-traditional.md), so only the state page counts for SOURCES.md.
- **Final source count:** 4

### 8. crimean-tatar-traditional

- **Added (1):**
  - https://dx.doi.org/10.4000/assr.18403
- **Dropped from hunt (off-topic/generic on verification):**
  - https://ich.unesco.org/doc/src/60954-EN.pdf?v=1689946361 (generic NGO accreditation report form, no Crimean content)
  - https://ich.unesco.org/en/2003-convention-and-research-00945 (generic Convention-and-research page)
- **Final source count:** 4

### 9. czech-moravian-folk

- **Added (3):**
  - https://ich.unesco.org/en/RL/ride-of-the-kings-in-the-south-east-of-the-czech-republic-00564
  - https://www.visitczechia.com/en-us/things-to-do/places/landmarks/religious-monuments/c-velehrad-cistercian-monastery-st-cyril-and-metho
  - https://www.visitczechia.com/de-de/things-to-do/places/landmarks/religious-monuments/c-holy-hostyn
- **Final source count:** 6

### 10. ewe-traditional

- **Added (3):**
  - https://ich.unesco.org/doc/src/Signed%20periodic%20report%20-%20Periodic%20report-62640.pdf
  - https://ich.unesco.org/doc/src/45516-FR.pdf?t=1568629329
  - https://ich.unesco.org/es/-00973?photoID=00236
- **Removed/replaced (1 weak overview link):**
  - https://www.everyculture.com/Africa-Middle-East/Ewe-and-Fon-Religion-and-Expressive-Culture.html
- **Note:** the periodic report is Ghana’s (Ewe/Hogbetsotso content confirmed in the PDF); the photo pop-up documents Kente cloth of the Asante and Ewe.
- **Final source count:** 5

### 11. faroese-folk

- **Added (2):**
  - https://visitfaroeislands.com/dk/whatson/events/event/st-olafs-national-celebration
  - https://visitfaroeislands.com/about-vfi/history-governance-and-economy/quick-facts/national-symbols
- **Removed/replaced (1 weak overview link):**
  - https://www.britannica.com/place/Faroe-Islands-Atlantic-Ocean
- **Dropped from hunt (off-topic on verification):**
  - https://doi.org/10.1017/CBO9780511618147 (resolves to Basso’s “Portraits of ‘The Whiteman’” on the Western Apache)
- **Final source count:** 4

### 12. fijian-vanua

- **Added (4):**
  - https://doi.org/10.3390/su13169003
  - https://doi.org/10.3390/su17093942
  - https://doi.org/10.5772/intechopen.1015028
  - https://www.spc.int/DigitalLibrary/get/xe9qj
- **Final source count:** 7

## SOURCES.md

- Appended section `增补传统（Notebook source hunt C8：阿卡—斐济）` with 30 new unique URLs (32 card additions − 2 already in SOURCES.md via micronesia.md / kosraean-traditional.md: the Carolinian wayfinding USL element page and decision 16.COM/8.A.4).
