# Ritual narrative blurbs（了解此仪式）— Design A

Date: 2026-09-29
Branch: `docs/ritual-narrative-blurbs`

## Goals

- 在练习／场景页标题正下方加一个默认收起的「了解此仪式」折叠块，展开后只显示
  **一段** 约 80–120 个汉字的短文：起源 + 历史脉络 + 基本意涵。
- 语气为练习／致敬（homage / practice），可附一句「非宗教仪轨」；不写任何真实仪轨步骤。
- 数据只挂在内置目录 `builtInScenes` 条目上（可选字段），缺文案时整块隐藏，
  打开练习的流程不受影响。
- 首批为四个微仪式写好草稿文案并选定 `traditionSlug`，草稿交 Helio 审阅。

## Non-goals

- 不在 app 内拉取或渲染完整传统卡 Markdown（`content/traditions/<slug>.md`）。
- 不改远程 catalog schema（`parseCatalog` / `CatalogEntry`），不改 content-pack
  manifest，不使用远程 `presentation.caption`。
- 不新建任何 `content/traditions/*.md` 传统卡（四个微仪式均 **无专卡**，只取最近卡）。
- 本期不为全部场景写文案：`celtic-folk-spring`、`theravada-water` 等暂不给 narrative。
- 本 docs PR 不含 React / CSS 实现；实现由后续 PR 完成。

## UX

| 状态 | 表现 |
|---|---|
| 无 narrative | 整个折叠块不渲染（不留空 `<details>`、不留占位高度）。 |
| 收起（默认） | 标题下一行 summary「了解此仪式」；普通文档流、无 z-index，高度约一行（≥ 44px 触控高度即可，不再更高）。不遮挡 `.ritual-stage` / `.library-scene-stage` / `.scene-hit-layer`。 |
| 展开 | 一段 `<p>`，约 80–120 汉字；过长时在块内滚动（`max-height` + `overflow-y: auto`），把舞台往下推而不是覆盖舞台。 |
| 打开时机 | **永不自动展开**：不设 `open` 属性，不记忆上次展开状态，不因首次进入／完成而打开。只能由用户点击 summary。 |

- 使用原生 `<details>` / `<summary>`：键盘、读屏开合语义自带，不需额外 state。
- 文案末句可带「非宗教仪轨」软提示；与全局 `GLOBAL_DISCLAIMER` 不冲突、不替代。
- 文案须通过 `assertSafeCopy`（`packages/shared/src/disclaimers.ts`，禁用
  参拜成功／作福完成／通关／功德）。

## Data

### 类型

`CatalogEntry`（`packages/content/src/catalog.ts`：`id, title, engine, revision,
manifestUrl`）**保持不变**。在 `packages/app/src/scene-library.tsx` 本地扩展：

```ts
export type BuiltInSceneEntry = CatalogEntry & {
  /** 一段 80–120 汉字：起源 + 历史脉络 + 基本意涵；练习／致敬语气。缺省 → 隐藏折叠块。 */
  narrative?: string;
  /** 指向 content/traditions/<slug>.md（单文件，非目录）；仅元数据，本期 app 不加载。 */
  traditionSlug?: string;
};
export const builtInScenes: BuiltInSceneEntry[] = [ /* ... */ ];
```

- `BuiltInSceneEntry` 可赋值给 `CatalogEntry`，`useState(builtInScenes)`、
  `supportsScene`、`SceneLibraryProvider` 的 entries 类型不需变化；远程 catalog
  返回的仍是纯 `CatalogEntry`。
- 读取统一走 `builtInScenes` 按 `id` 查找（例如
  `builtInNarrative(id) => builtInScenes.find(e => e.id === id)`），**不**从
  `useSceneLibrary().entries` 取——远程条目即使同 id 也没有这些字段，查内置表
  保证同一 id 的文案一致。
- `traditionSlug` 本期不渲染成链接，只是给后续「查看传统卡」留出对应关系；取值必须与
  `packages/scenes/src/registry.ts` 中同 id 的 `traditionSlug` 一致（woodfish 不在
  scenes registry，按下表取值）。

### 各条目取值

| scene id | title | traditionSlug | narrative |
|---|---|---|---|
| `woodfish` | 敲一敲木鱼 | `chinese-buddhism` | 首批草稿（见下） |
| `celtic-folk-spring` | 泉边一念 | `celtic-folk` | 暂无 → 隐藏 |
| `theravada-water` | 花水位一倾 | `theravada-buddhism` | 暂无 → 隐藏 |
| `tanzaku-tanabata` | 短册系竹 | `shinto` | 首批草稿 |
| `yeondeunghoe` | 燃灯上浮 | `won-buddhism` | 首批草稿 |
| `furin-wind-chime` | 风铃一响 | `shinto` | 首批草稿 |

`celtic-folk-spring` / `theravada-water` 的 slug 直接沿用 registry，可以现在就写上；
narrative 留空，以后再补。

## 首批 traditionSlug 选择

四个微仪式在 `content/traditions/` 中均 **无专卡**；这里只选最近的已有传统卡，
不新建卡，也不留 TBD。

| scene id | traditionSlug | 选择理由（一行） |
|---|---|---|
| `woodfish` | `chinese-buddhism` | 无木鱼／mokugyo 专卡（见 `specs/notes-mokugyo.md`）；木鱼为东亚佛教课诵法器，最近为汉传佛教课诵语境。 |
| `tanzaku-tanabata` | `shinto` | 无七夕／短册专卡；与 scenes registry 一致；最近的日本卡含书愿悬挂文化，但短册本身属七夕岁时。 |
| `yeondeunghoe` | `won-buddhism` | 无燃灯会专卡（UNESCO 燃灯会；candidates 注「无专卡」）；与 registry 一致；最近的韩国佛教卡，`korean-musok` 为不同体系。注意：燃灯会是更宽的佛诞燃灯节庆，并非圆佛教仪轨本身。 |
| `furin-wind-chime` | `shinto` | 无风铃专卡；与 registry 一致；最近的日本卡；风铃更偏夏日民俗／工艺而非神社仪轨。 |

与 `2026-09-29-c-grade-three-scenes-design.md` 场景表及 `registry.ts` 的
`traditionSlug` 完全一致。

## 首批草稿文案（DRAFT — 待 Helio 审阅）

> **草稿，待 Helio 审阅后才能进入实现 PR。** 来源为 `specs/notes-mokugyo.md`、
> `specs/2026-09-20-daily-micro-rituals-candidates.md`、
> `specs/2026-09-21-daily-micro-rituals-candidates-b2.md` 的要点压缩改写，
> 未粘贴档案原文；只写起源、脉络与意涵，不写操作步骤。

字数：「汉字」只数 CJK 统一汉字（不含标点与「〇」）；「总字符」含标点。

### woodfish — 敲一敲木鱼

木鱼是东亚佛教课诵与集众时常见的响器，圆型腹空，轻敲以应诵经节拍，禅寺中常与磬相配。鱼形无睑，常被理解为精勤醒觉，并与寺院晨昏的日常节律相连。本页只作静心练习与文化致敬，非宗教仪轨。

### tanzaku-tanabata — 短册系竹

日本七夕时，人们把愿望写在色纸短册上，系于笹竹；仙台七夕的七种装饰中，短册多寄托学业与书艺精进之愿。它与绘马同属书写悬挂的祈愿习惯，却是七月星祭的岁时语境。本页只作许愿练习与致敬，非宗教仪轨。

### yeondeunghoe — 燃灯上浮

韩国燃灯会是佛诞前后点亮莲灯的节庆，二〇二〇年列入联合国教科文组织人类非物质文化遗产代表作名录。灯火象征光明与共同祝愿，如今也延伸为公众可自制莲灯参与的开放春日共庆。本页只作许愿练习与致敬，非宗教仪轨。

### furin-wind-chime — 风铃一响

风铃是日本夏日常见的风物与工艺：江户玻璃或南部铁器的铃身下系纸短册，风过轻响，带来听觉上的清凉感。常述由古时悬于檐角的风铎演变而来，渐成民俗美学。本页只作静听练习与致敬，非宗教仪轨。

### 字数核对

| scene id | 汉字 | 总字符 | 80–120 | assertSafeCopy |
|---|---|---|---|---|
| `woodfish` | 82 | 91 | ✓ | ✓ |
| `tanzaku-tanabata` | 87 | 96 | ✓ | ✓ |
| `yeondeunghoe` | 93 | 101 | ✓ | ✓ |
| `furin-wind-chime` | 83 | 91 | ✓ | ✓ |

审阅关注点（给 Helio）：
- woodfish：「与磬相配」依据 Penn A664A（日本禅寺）；圆型定型与起源年代仍待核实，所以文案不写年代。
- furin：「风铎→风铃」只用「常述」这种软说法；英文一级专条仍薄（candidates B2）。
- yeondeunghoe：只写佛诞节庆与 UNESCO 2020，不写成圆佛教仪轨。

## Mount / wiring

### 共享组件

`packages/app/src/ritual-narrative.tsx`（新文件）：

```tsx
export function RitualNarrativeBlurb({ sceneId }: { sceneId: string }) {
  const narrative = builtInScenes.find((e) => e.id === sceneId)?.narrative?.trim();
  if (!narrative) return null;
  return (
    <details className="ritual-narrative">
      <summary>了解此仪式</summary>
      <p>{narrative}</p>
    </details>
  );
}
```

- 按 `sceneId` 查内置表，调用方不用自己传 narrative；两个挂载点共用这一个组件。
- 不渲染 `traditionSlug`，不 fetch。

### 挂载点

| # | 页面 | 位置 | 说明 |
|---|---|---|---|
| 1 | `SceneExperience`（`packages/app/src/scene-experience.tsx`） | `<h1>{entry.title}</h1>` 之后、error / download / stage 之前 | `<RitualNarrativeBlurb sceneId={entry.id} />`。在 `.library-scene-stage` 之外，所以 `.scene-hit-layer`（`position:absolute; inset:0`，只作用于舞台内部）盖不到它。 |
| 2 | 奶油壳木鱼仪式页（`packages/app/src/ritual.tsx` `Ritual`） | `.ritual-page` 的第一个子元素，`.ritual-goal` 之前；只在 `kind === "woodfish"` 时挂载 | `<RitualNarrativeBlurb sceneId="woodfish" />`。在视觉上紧挨 App chrome 的 `<h2>` 标题（`ritualTitle`），并位于 `.ritual-stage` 之前。 |

**推荐挂载点 2 放在 `Ritual` 页顶部，而不是 `App.tsx` 的 header 里。** 理由：
`.app-topbar` 是固定 `height: 64px` 的居中 flex 栏，所有非根页面共用。塞进 header
会撑破 chrome，还要在 App 层判断 route。放在 `Ritual` 顶部，视觉上仍是「标题正下方」，
普通文档流也保证它在 `.ritual-stage` 之上、不重叠。crane / lantern 不是 catalog
条目，不挂载。

### CSS（后续 PR）

```css
.ritual-narrative { position: static; margin: 4px 0 12px; }
.ritual-narrative > summary { min-height: 44px; display: flex; align-items: center; cursor: pointer; }
.ritual-narrative > p { max-height: 40vh; overflow-y: auto; overscroll-behavior: contain; line-height: 1.8; margin: 0; }
```

- 不设 `z-index`、不用 `position: absolute/fixed`；收起时只占 summary 一行。
- 展开把舞台往下推，页面本身可滚动；段落内部滚动用 `overscroll-behavior: contain`，
  避免带动舞台手势。
- 颜色沿用奶油壳（参考 `.scene-discovery p` 的 `line-height: 1.8`）。

## Acceptance

- [ ] 收起状态下，`.ritual-stage` 与 `.library-scene-stage` / `.scene-hit-layer` 上的所有点按、拖动、倾斜手势照常可用，折叠块不覆盖任何手势目标。
- [ ] 默认收起；任何路径（首次进入、恢复进度、完成后返回）都不自动展开。
- [ ] 展开后是一段可读文字，超出时在块内滚动，不遮挡舞台。
- [ ] 条目无 `narrative` 时（如 `celtic-folk-spring`、`theravada-water`）不渲染折叠块，打开练习的流程不变。
- [ ] 文案为练习／致敬语气，不含仪轨操作步骤，通过 `assertSafeCopy`。
- [ ] 每段约 80–120 汉字（单测：CJK 汉字计数在 80–120）。
- [ ] 首批四段（woodfish、tanzaku-tanabata、yeondeunghoe、furin-wind-chime）经 Helio 审阅后落入 `builtInScenes`。
- [ ] `builtInScenes` 各条目的 `traditionSlug` 与 `registry.ts` 同 id 一致，且 `content/traditions/<slug>.md` 文件存在。

## Validation（实现 PR）

- `npm run test -w @wbr/app`：
  - `RitualNarrativeBlurb` 在无 narrative 时返回 `null`；有 narrative 时渲染的 `<details>` 没有 `open`，summary 文本为「了解此仪式」。
  - 每条 narrative：汉字数 80–120、`assertSafeCopy` 不抛错。
  - `traditionSlug` 与 `sceneRegistry` 一致，对应的 `content/traditions/<slug>.md` 存在。
- `npx tsc --noEmit -p packages/app`。
- `npm run build -w @wbr/cyber-bless`。
- 手动：用手机尺寸视口打开木鱼仪式页和三个 C 级场景，收起状态下完成全部手势；展开后滚动阅读，再收起继续练习；开启 reduced motion 复查一次。
