# 一日一念 App 框架

## 运行

```powershell
npm install
npm run dev
npm run mobile:start
```

Vite 地址以启动日志为准。手机通过 Expo Go 扫描 Expo CLI 二维码；Android 与 iOS 共享 `packages/app` 下的 React DOM 界面。Expo 配置参考 HistoryCard：SDK 54、React Native 0.81.5、React 19.1。项目未关联 Expo 云账号，未执行云构建或商店发布。

```powershell
npm test
npm run build
npm run mobile:verify
```

`mobile:verify` 检查原生类型、Android/iOS 嵌入包和 DOM HTML 引用的 JS/CSS。产物保留在忽略的 `apps/mobile-expo/.expo-export-check/` 中，便于检查。打包通过不等于真机验收。

## 模块

- `packages/core`：纯 TypeScript 状态与动作，心愿、日志、静态仪式进度、奖励和存档格式。
- `packages/runtime`：异步存储接口、串行保存、失败重试、React 无关的订阅式 store。
- `packages/app`：共享四页导航、详情与表单、静态仪式和统一主题。
- `apps/cyber-bless`：Vite 网页入口，localStorage 适配。旧场景保留在 `/dev/gallery`，按需加载。
- `apps/mobile-expo`：Expo 原生容器、AsyncStorage、震动、安全区、前后台、Android 返回和 WebView 错误恢复。

导航由共享 App 管理，主 Tab 切换替换导航栈，详情页入栈；原生返回键优先返回 App 上一页，根页交给系统。网页刷新回到今日，仪式进度和用户记录保留。网页 URL 深链接暂未实现。

## 图片素材

当前引用对话的读取 API **没有返回原始两张 UI 图**。`packages/app/src/art.tsx` 中的 `artwork` 预留 woodfish/crane/lantern/badge 四个素材位置，现为 CSS 示意占位，未声称是参考图贴图。

拿到图后应裁出对象或背景，并作为本地打包资源接入该配置，随后验证网页与 Expo 的离线资源路径。当前不含 Three.js 新场景，不加载外部图片和字体。静态仪式只是步骤式交互，不能视为完整折纸手势或 3D 体验。

## 数据与规则

存储键 `cyber-bless:personal:v1`。网页与手机的本地存储独立，不自动同步。

仪式过程中每步写入进度，完成后一次提交仪式记录、10 点趣味功德、一个收藏物和可选的心愿日志。同一仪式 ID 只结算一次。心愿依次为 active → realized → fulfilled；还愿通过文字记录感谢或小善事完成，仅奖励如愿纪念章。归档独立于生命周期，恢复不丢状态。

保存是乐观界面更新加串行写入，只有宿主写入成功后才显示“本机珍藏”。失败时展示重试，下一次成功保存包含此前未保存变化。坏存档、未知版本不覆盖原值，提供重新读取。暂无导出、跨设备同步、旧版本迁移与账号功能。清除网页数据或卸载 App 会丢失记录。

进程被系统终止之前未完成写入的最后操作可能丢失。真机需验收安全区、键盘、返回、触觉、声音与前后台切换。

## 本轮验证（2026-09-20）

- 45 项测试通过：核心状态 7、存储 2、原有手势 26、原有文案 3、原有场景注册 7。
- Vite 生产构建和 Expo 类型检查通过；Android、iOS 嵌入包及其 DOM HTML/JS/CSS 完整性检查通过。
- 浏览器实际验证新增心愿、进展、归档/恢复、标记实现、文字还愿、纪念物和刷新恢复；静态心愿灯步骤在刷新后恢复到 1/3，完成后功德为 10、仪式记录为 1、还愿数为 1。
- 320px 窄屏无横向溢出；390px 手机布局已查看。浏览器检查未发现 console error/warn。
- 独立只读审查检查了持久化、奖励幂等、导航和原生回调，没有重要问题。
- 未在物理设备运行，未生成签名 APK/IPA，原始 UI 两图仍待提供。
