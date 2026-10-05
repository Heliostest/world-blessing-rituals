# 新会话批量补全提示词

复制下面正文到在本项目中打开的新会话。默认执行一个固定批次，最多 20 项；再次使用时从台账继续。若要连续执行多个批次，可在末尾追加明确的批次范围。

---

请在 `D:\ws\app\world-blessing-rituals` 实际执行展示材料的批量研究、文字补全和复评，不要停留在计划或重复已有评估。

## 先读取交接材料

遵守仓库适用的 AGENTS.md。读取：

- `docs/material-readiness/2026-10-04/progress.md` 与 `progress.json`：当前进度和续接位置。
- 同目录的 `README.md`、`rubric.md`、`writing-template.md`、`review-notes.md`：评估口径、补写结构与已发现的范围矛盾。
- `assessment.json` 中当前批次各项的 selectedDisplay、gaps、nextWriting、sourceFiles，以及对应的 `batches/<batchId>.md` 和源文件全文。

现有评估覆盖 498 个 B/C 传统候选及 8 个 App 专题，共 506 个评估单位，部分题材重叠；它们不是 506 种不同习俗。初始已有 3 项文字齐备，另外 503 项待处理。已完成的是本地材料评估，尚未进行本轮新研究和内容补齐。旧报告中的外部链接不等于已重新核验。

## 本会话执行范围

按固定顺序 C01–C08、B01–B18、S01，选择第一个仍有 pending、researching 或 drafted 条目的批次，完成其中所有待处理项；初始为 C01，共 20 项。先续接该批次已开始的工作，再处理未开始项。baseline_ready 项默认跳过。needs_research 和 scope_blocked 保留为未完成待办，但在无新增证据时不阻止进入后续未开始批次；全部批次处理过后，再汇总这些待办。批次“处理过”不代表全批齐备。

本次只补支撑后续设计开发的文字，不实现 Three.js 场景、模型、贴图、音频、动画或交互脚本，不修改 App 代码，不改变原 A/B/C 资格。过程、可见变化和起止状态必须用文字说清楚。B 档保持图文、观察或氛围展示资格，不补用户主持仪式的流程。

可以使用 research 技能和并行子代理研究互不重叠的条目。若使用子代理，每个代理只写自己的条目文件，由主代理统一复评和更新进度台账，避免并发覆盖。按条目及时保存，不等全批结束才落盘。

## 每项必须实际完成的工作

1. 先固定一个有依据、允许公开展示的具体切片，明确地域、场合、器型、观察者身份和变体。原 selectedDisplay 是起点；如需调整，记录新切片、依据和原因，不以任意缩成一句介绍来规避开发描述要求。已知归属或边界矛盾先研究澄清，无法澄清时保留 scope_blocked。
2. 访问并阅读与该切片直接相关的可信一手来源，优先当地机构、社区公开说明、博物馆藏品记录、官方文化遗产资料和原始学术研究。仅搜索摘要、URL 数量或旧资料的“验证通过”标签不能证明事实。记录来源标题、发布机构、网址、访问日期、对应段落或藏品编号及支持的具体主张；无法访问的资料标为未核验，不能作为已核验依据。
3. 按 writing-template 写成可供另一位设计者使用的完整说明：文化身份与意义；主要物件的材料、轮廓、部件、连接、支撑和表面；场所和人与物的相对位置；起始—变化—结束状态；具体可见与可闻表现；所选变体；展示和改编边界；逐主张来源对应。没有实际声画文件不扣分，但不能用“宁静、暖色、有灯、有纸”代替形制与过程。
4. 明确区分文化事实、实物观察与原创产品决定。未证实的木种、文字、尺寸、配方、动作和仪式规范不可编造。允许为原创改编给出合理的比例、背景、配色、节奏与结束方式，但须标注它们是产品决定，不能伪装成传统规定。静态展示可以说明 sequence 不适用，不能同时声称动态过程已齐备。不追求封闭仪式、秘传文本或非公开主持细节。
5. 逐项语义复评八维。ready 要求 context、objects、space、sequence、variants、boundaries、provenance 均为 2，sensory 至少 1，且无阻断性矛盾；静态 sequence 可按 rubric 合理记 null 并解释。至少提供两条来自新说明的真实行号和短原文证据。用“另一位设计者是否能据此画出主要物件与位置、写出起止状态”检验，不能按字数、标题覆盖或关键词自动升级。关键资料不足时保存已查得的内容和具体缺口，记 needs_research；不要算作完成。

## 保存位置与记账

- 补全说明：`content/display-notes/<slug>.md`。保留 assessment 中的 slug；App 专题使用已有的 `app-` 前缀。每份文档列条目、批次、切片、八维正文、来源对应表、原创决定与待研究问题。
- 复评记录：`docs/material-readiness/supplementation/reviews/<slug>.json`。至少含 slug、batchId、selectedDisplay、readiness、narrativeReady、dimensions、evidence、gaps、nextWriting、sourceFiles、checkedAt 与 sources；证据引用新说明的真实路径和行号。
- 批次结果：`docs/material-readiness/supplementation/batches/<batchId>.md`。逐项列输出、补齐内容、复评结果、未解决问题及下一步。
- 每处理一项便更新 `docs/material-readiness/2026-10-04/progress.json` 对应条目的 status、outputFiles、reviewFile、verifiedSources、checkpoint、remainingGaps、updatedAt，并同步更新 `progress.md` 的计数、批次状态和续接位置。状态采用台账定义。来源使用对象记录网址、标题、机构、访问日期和对应主张。
- 对重叠的传统条目与 App 专题复用研究并互相链接，但分别验收与记账。只把有文件、有来源对应、通过复评的项标 ready。baseline_ready 表示原评估齐备，不计本轮新增补齐。
- 保留 `2026-10-04` 原 assessment、reviews、批次评估和原传统卡片作为基线，不覆盖其原文与证据，也不要通过重跑旧报告生成器把补写计入旧评估。

结束前核对台账无重复或漏项，所有新增 ready 项的说明、复评文件及证据有效，统计与逐项状态一致，执行 `git diff --check`。这些结构检查不能替代语义复评。若受时间或资料限制，保存已完成工作和精确续接点，不把未完成项算作完成。

最终用中文简报本批次：实际补齐并通过的数量、待研究／范围未解决数量、输出链接、总进度，以及下一会话从哪个批次和条目继续。无需逐项请求常规研究和可逆文件编辑的确认。
