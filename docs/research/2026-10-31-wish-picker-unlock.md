# 心愿页祈愿仪式的收集解锁

日期：2026-10-31。依据本轮用户确认：在“今日”完成对应仪式并收下小物后，解锁心愿页中对应的祈愿仪式。这里的解锁是本产品的收集资格，不涉及购买或付费。

## 产品规则与文案

- 下方场景区标题改为“在今日收下对应小物后解锁”，沿用稳定 ID `app.wish-ritual-picker.c04ef5899a`；不再渲染“也可以从这里开始”，其旧目录条目保留。
- 新增“未解锁”／“已解锁”状态，ID 分别为 `app.wishPicker.locked`、`app.wishPicker.unlocked`。八语均表达收集后获得的使用资格，不表达购买。
- 对应小物一经收下即永久解锁，后来已用于祈愿也不撤销资格。仅有 `sceneRecords` 或收藏爱心 `favorite` 不算收下小物。
- 已有未用小物和未完成的写愿草稿入口保持；本轮不改变它们的使用、继续编辑与保存路径。

实现入口见[祈愿选择区](../../packages/app/src/wish-ritual-picker.tsx)和[小物资格与入口](../../packages/app/src/vessels.ts)。解锁只读取实际 `kind=scene`、对应 `sceneId` 的收藏物，不新增存档字段；共享场景入口对 `wishPicker` 访问先核对资格，再执行任何进度重置或导航。今日、开场和已有小物／草稿的原入口保持原流程。

## 文化边界与验证范围

按[场景来源与文化关联核查规范](../scene-provenance.md)，本次只调整页面集合的可用资格与状态说明，没有新增或修改器物、传统动作、仪式资格、祈愿功效、文化来源或场景存档格式。“在今日收下小物”是应用内流程，不是任何传统的参与条件；沿用[既有文化核查](2026-10-19-scene-culture-audit.md)的支持范围，不新增来源卡或文化证据，也不声称本轮重新阅读过外部来源。

本轮 i18n 范围为上述一个沿用 ID 和两个新状态的 source、八语 app 目录、app 组评阅 hash 与编译物；其他目录分组的评阅记录保留。

## 实际验证

- 新行为测试先确认未解锁仍可进入的旧实现失败；随后选择器、图标和共享入口三组69/69通过，覆盖未拥有、其他场景小物、伪徽章、仅完成／爱心、旧分类标记、已使用小物、未用小物、待处理草稿及绕过卡片直接调用入口。
- 完整 `npm run test -w @wbr/app` 1338/1338通过。首次运行仅余 `new-wish.test.ts` 的旧“新用户无需小物直接进入”预期；按本轮明确规则改为禁用／不导航／不写入／不显示表单后，重跑完整App套件通过，没有跳过检查。
- `npm run build` 退出0，含八语提取、ICU、审阅哈希、编译物／原生生成物和类型检查；保留原有大分包提示。`git diff --check`通过。
- 当前浏览器实际确认已有短册小物可选择，其余17项显示“未解锁”并处于原生disabled状态；截图 `.tmp/wish-picker-unlock.png`。没有用测试动作推进个人进度或花费小物；此检查为桌面Chromium，未声称手机真机验收。

原始日志为本工作树 `.tmp/wish-picker-collection-red.json`、`.tmp/wish-picker-collection-green.json`、`.tmp/wish-picker-app-full-final.log` 和 `.tmp/wish-picker-unlock-build.log`，不纳入Git；技术检查不替代文化事实审阅。

## 本轮页面调整的提交验证

本次一并提交今日页说明的信息浮框、祈愿仪式的3秒空闲提示与去底座、收集解锁条件，以及按心愿实际 `sourceSceneId` 显示对应小物图标。旧心愿没有来源或来源图标未知时不猜测；已发生的收集、使用、保存与各筛选状态保持。

提交前重新运行完整 `npm run test -w @wbr/app`：47文件、1341/1341通过；`npm run build`退出0，八语／生成物／类型检查通过。最终补齐app组五项变更的评阅范围后，`npm run i18n:check`再次通过，其他分组评阅不变。日志为 `.tmp/wish-ui-commit-app-tests.log`、`.tmp/wish-ui-commit-build.log`、`.tmp/wish-ui-final-review-check.log`；截图和日志均不提交。
