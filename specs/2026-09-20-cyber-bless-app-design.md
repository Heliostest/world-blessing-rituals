# 赛博祈福 App — 设计规格（§1–§4）

- **日期：** 2026-09-20
- **仓库：** `Heliostest/world-blessing-rituals`
- **状态：** 实现进行中 · 试点两景已通（celtic-folk-spring / theravada-water）
- **产品定位：** 手机端「赛博祈福 / 许愿」App — 以致敬小品手势进入多个 Three.js 交互场景；**不是**真仪复现或通关养成。

## 背景与目标

研究档案（`traditions/*.md`）已含「手机互动适合度（Three.js 评估草稿）」A/B/C 档。本设计把仓库演进为：

1. **研究内容**与 **可运行 App** 分家；
2. 先验证可复用的手势原子（拖、倾、旋、陀螺仪、写愿）；
3. 用 5 张 C 档试点场景串起壳 → 廊 → 场景流程。

### 试点场景（已锁定）

| 场景目录（建议） | 卡片 slug | 原创标题 | 手势组合 |
|------------------|-----------|----------|----------|
| `celtic-folk-spring` | `celtic-folk` | 泉边一念 | gyro → drag → wishWrite |
| `shinto-torii` | `shinto` | 庭前一礼 | gyro → drag → wishWrite → 双击拍手 |
| `theravada-water` | `theravada-buddhism` | 花水位一倾 | tilt → drag → 短触合十 |
| `tibetan-wheel` | `tibetan-buddhism` | 廊前轻转 | spin → gyro → drag |
| `slavic-wreath` | `slavic-folk` | 火边花环 | drag → 点按跃火 → wishWrite |

全局红线：标注「致敬小品 / 手势练习」；不用真仪名通关；无功德点数 / 无胜负结算。

---

## §1 目录与职责（方案 B）

```
world-blessing-rituals/
  content/
    traditions/          # 研究卡片 md（从仓库根目录迁入）
    SOURCES.md
    LICENSE
  docs/
    README.md
    timeline-map.html    # 研究向时间轴地图（保留）
    map-data.json
    notebook-*           # 既有 Notebook 搜源记录
  apps/
    cyber-bless/         # 赛博祈福手机 App 壳
      src/
      public/
      package.json
  packages/
    gestures/            # 共用手势：drag / tilt / spin / gyro / wishWrite
    scenes/              # 各 Three.js 场景（一景一目录）
      celtic-folk-spring/
      shinto-torii/
      theravada-water/
      tibetan-wheel/
      slavic-wreath/
    shared/              # 红线文案、资源加载、通用 UI、类型
  specs/                 # 设计规格（本文档所在）
  scripts/               # build_map_data 等（路径改指向 content/）
  README.md              # 总说明：研究档案 + App 入口
  package.json           # npm workspaces 根
```

### 原则

- `content/` 为研究资料；App **不**把长文 md 当运行时 UI 源，只通过 `traditionSlug` 溯源（可外链 GitHub）。
- 新场景只新增 `packages/scenes/<id>/`，由注册表挂到壳。
- 触控 / 陀螺仪逻辑只进 `packages/gestures/`；场景禁止复制粘贴一套拖拽。

### 一次性迁移（实现阶段）

- 根目录 `traditions/` → `content/traditions/`
- 根目录 `SOURCES.md`、`LICENSE` → `content/`
- 更新 `README.md`、`scripts/build_map_data.py`、地图相关路径
- 既有 `docs/notebook-*` 保留在 `docs/`，不迁入 App

---

## §2 App 壳路由与信息架构

手机端是「赛博祈福」壳，不是研究阅读器。

### 主要页面

1. **启动 / 首页** — 一句定位（致敬小品，非真仪）+ 进入「祈福廊」
2. **祈福廊** — 卡片网格/列表：封面、原创标题、敏感度标签、预计手势数
3. **场景页** — 全屏 Three.js；顶栏可收；底部步骤点；随时可退出
4. **场景收束** — 短文案 +「这是手势练习」+ 回廊 / 再试一次（**无通关、无功德点数**）
5. **关于 / 红线** — 全局免责声明、不可做事项摘要

### 路由

| 路径 | 页面 |
|------|------|
| `/` | 首页 |
| `/gallery` | 祈福廊 |
| `/scene/:sceneId` | 场景（如 `celtic-folk-spring`） |
| `/about` | 关于与红线 |

### 场景注册表

由 `packages/scenes` 导出，壳只读：

```ts
type SceneMeta = {
  id: string
  title: string              // 原创标题，如「泉边一念」
  traditionSlug: string      // 对应 content/traditions/<slug>.md
  grade: 'A' | 'B' | 'C'
  sensitivity: '低' | '中' | '高'
  gestures: Array<'drag' | 'tilt' | 'spin' | 'gyro' | 'wishWrite'>
  entry: () => Promise<SceneModule>
}
```

### 导航原则

- 廊 → 场景：一跳进入；场景内手势链式前进，不嵌套子路由。
- 物理返回 / 顶栏关闭：直接回廊，不弹「未完成」成就感。
- 首版不做：账号、收藏排行、社交分享排行榜。

### 与研究档案的关系

- 廊卡可外链 GitHub 上 `content/traditions/<slug>.md`；App 内不渲染长文。
- UI 标题用原创名；`traditionSlug` 仅溯源。

---

## §3 共用手势模块 API（`packages/gestures`）

五个原子，场景只组合、不重写触控逻辑。

| 模块 | 输入 | 成功条件（示例） | 典型输出事件 |
|------|------|------------------|--------------|
| `drag` | 单指拖 | 物体落到目标区 | `onProgress` / `onDrop(hit)` |
| `tilt` | 拖或设备倾角 | 倾角达阈值并保持 N ms | `onAngle` / `onPour` |
| `spin` | 水平滑 / 绕轴拖 | 累计角或转数 | `onAngle` / `onRevolution` |
| `gyro` | DeviceOrientation | 低头/停驻达阈值 | `onBow` / `onHold` |
| `wishWrite` | 文本框 + 确认 | 1–40 字非空 | `onSubmit(text)` |

### 统一约定

```ts
type GestureHandle = {
  mount(el: HTMLElement, opts: unknown): void
  update(dt: number): void
  dispose(): void
  setEnabled(on: boolean): void
}
```

- **Pointer Events 优先**（兼容触控笔）。
- `gyro` 需权限；用户拒绝则降级为「点按低头 / 点按停驻」。
- 模块不读写全局分数；只回调，由场景决定下一步。
- 可测：每个模块带无头 headless 测试（合成 pointer / 假陀螺仪）。

### 刻意不做（首版）

多指手势库、AR、力反馈、手势录像回放。

---

## §4 技术栈与场景契约

### 技术栈（试点）

| 层 | 选择 |
|----|------|
| 壳 | Vite + React（或 Preact）+ 移动端优先 CSS；轻量 router |
| 3D | Three.js r16x + 自管 `requestAnimationFrame` |
| R3F | **可选**于场景；**手势库与框架无关**（DOM/canvas 绑定） |
| 包 | npm workspaces（或 pnpm）：`apps/cyber-bless` 依赖 `packages/*` |
| 语言 | TypeScript |
| 分发 | 首版 **PWA 可安装**；不上 Capacitor / 原生壳 |
| 真机 | HTTPS 或 localhost 才能申请陀螺仪；文档写明手机访问开发机 |

### 场景契约

每个 `packages/scenes/<id>` 必须实现：

```ts
type SceneModule = {
  meta: SceneMeta
  create(ctx: SceneContext): SceneInstance
}

type SceneContext = {
  canvas: HTMLCanvasElement
  overlay: HTMLElement       // 写愿、红线、步骤点
  gestures: typeof import('@wbr/gestures')
  shared: typeof import('@wbr/shared')
}

type SceneInstance = {
  start(): void
  update(dt: number): void
  dispose(): void
}
```

包名意向：`@wbr/gestures`、`@wbr/scenes`、`@wbr/shared`（实现时可改为仓库 scope）。

### 运行时规则

- 壳负责挂载/卸载；进场景 `create` + `start`，出场景必须 `dispose`（停 RAF、解绑 pointer、关 Audio）。
- 场景内步骤由场景状态机推进；壳只听 `scene:complete` / `scene:abort`。
- 资源：低模 + 程序化几何优先；贴图放 `packages/scenes/<id>/assets/`；单景首包意向 &lt; ~1.5MB gzip。
- 红线文案从 `shared/disclaimers` 注入；场景不得写「参拜成功 / 作福完成」类结算。

### 试点验收（手势库优先）

1. 五模块各有 playground 页可单独试。
2. 至少 2 个场景串起真实组合（建议：泉边一念 + 花水位一倾）。
3. iOS Safari / Android Chrome 触控可走完；gyro 拒绝时有降级。

---

## 非目标（本规格范围外）

- 全量 A/B/C 场景一次做完
- 账号体系、支付、UGC 排行
- 把 `content/` 研究长文做成 App 内阅读器
- 原生商店上架流水线（可后续另开规格）

## 下一步

1. 用户审阅本规格；若需修改，改后重提交流程。
2. 通过后走 **writing-plans**：目录迁移 + workspaces 脚手架 + gestures playground + 两景串联的实现计划。
3. 实现阶段用既定编码工具写入仓库（不在本规格内展开）。

## 修订记录

| 日期 | 说明 |
|------|------|
| 2026-09-20 | 初稿：锁定 §1–§4 |
