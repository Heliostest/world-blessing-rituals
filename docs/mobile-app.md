# 一日一念移动应用

2026-10-10 已实际完成独立 EAS 配置、生产导出、干净云归档验证和四种云构建。iOS 商店包已上传并由 Apple 处理成功；正式 App Review、外部 Beta Review 和 Play internal 尚未提交，具体状态见 [store-release.md](store-release.md)。参考 Historia 仓库只读，未修改或复用其应用身份。

## 架构与运行时

项目继续使用 npm workspaces 和根目录唯一的 package-lock.json。Web 入口是 `apps/cyber-bless/src/main.tsx`；移动入口是 `apps/mobile-expo/index.ts` → `App.tsx` 原生壳 → `'use dom' BlessingDom.tsx` → 共享 `packages/app` 的 BlessingApp。移动端不加载 Vite 构建目录或开发工作台。

原生壳处理安全区、深色状态栏文字、前后台、Android 返回键、触觉、AsyncStorage 和场景文件缓存。DOM 通过顶层 Promise 回调传递字符串、布尔值和可序列化资源描述；没有嵌套函数参数。原生返回事件由产品页面按弹窗、仪式和导航层级处理；首页返回交给 Android 系统。WebView 使用键盘 resize、内部滚动及 viewport-fit=cover；加载失败或渲染进程终止显示重新打开入口。声音由页面交互触发；前后台状态传入共享运行时。没有请求相机、麦克风、定位或共享存储权限。

实际发布为手机竖屏，iOS 不声明 iPad 支持。签名 IPA 的最低系统为 iOS **16.4**，Android APK/AAB 为 minSdk **24（Android 7.0）**、targetSdk **36**。iOS 支持竖屏及倒置竖屏。图标和启动素材来自本项目原创 SVG 标记与现有配色。

| 依赖 | 当前版本 |
| --- | --- |
| Expo | 57.0.27 |
| React / React DOM | 19.2.3，实际解析为单实例 |
| React Native | 0.86.3 |
| React Native WebView | 13.16.1 |
| safe-area-context | 5.7.0 |
| AsyncStorage | 2.2.0 |
| expo-asset / file-system / haptics | 57.0.19 / 57.0.7 / 57.0.3 |
| expo-splash-screen / status-bar | 57.0.9 / 57.0.1 |
| EAS CLI | 固定 24.12.1 |

Expo 官方 `expo install --check` 已通过。实际开发 HTML 仍存在原生注入对象尚未就绪时启动 DOM 的情况，因此保留有六个边界测试的 `expo-dom-bootstrap.cjs` 延迟启动中间件；它只作用于开发 HTML，不改写生产导出。Metro 保留实际工作区、React 单实例解析和 noble 浏览器兼容解析。

## 持久化与资源

本应用保存键为 `cyber-bless:personal:v1`；场景缓存元数据使用 `wbr:scene-content:v1:`。Native AsyncStorage 和浏览器 localStorage 各自独立。同一平台更新沿用既有键和 schema v1；旧 v1 存档缺少 sceneRecords 时补空数组。读取失败、JSON 损坏、格式不支持或心愿关联不完整时保留原始记录，禁用未载入状态下的操作，不以空白存档覆盖。写入按队列串行执行，原生写入确认后才显示保存成功；失败有重试。当前没有浏览器到 App 或跨设备导入、开发者账号与云同步。

`scripts/prepare-app-assets.mjs` 是 Web、Expo 本地启动与 `eas-build-post-install` 共用的资源准备入口。两个 public 目录均为生成目录，不能存放手工创作文件。该脚本生成内容清单，复制九个离线文件，并写入长度和 SHA-256 清单 `wbr-assets.json`：两张产品 UI 图片、Noto Sans SC、三个 Nunito 字体、两份 OFL 许可证，以及内嵌贴图的 `woodfish/bundled-v1/woodfish.glb`。木鱼约 1.68 MiB；旧 Blender 源模型和考据图片不上传。其他程序化场景和音效编译进 JS；当前没有外部模型、字体或音频必需下载。

资源 URL 在 Web 与 Expo DOM 中共用解析方式。`EXPO_PUBLIC_SCENE_CATALOG_URL` 和 `EXPO_PUBLIC_SCENE_MANIFEST_URL` 是可选线上功能；本轮 preview/production 未配置它们。以后开启时，未下载的线上场景需要网络，HTTPS 下载后按清单验证和缓存，并须重新审计服务端日志及隐私披露。浏览器第一次访问依赖 Web 服务器；本项目没有把浏览器预览验收当作离线 App 验收。

“我的”提供离线可读隐私与帮助入口。共享法务源为 `packages/app/src/legal-content.ts`，`mobile:legal:prepare` 从同一源生成支持/隐私站点。公开支持邮箱尚未提供，当前部署是私有审阅稿，不可作为已完成的商店 URL。两张用户提供的 UI 图的商业发行权尚待确认，详情见 assets/README.md。

## 独立应用身份与凭据

| 项目 | 本应用值 |
| --- | --- |
| 显示名 / 版本 | 一日一念 / 1.0.0 |
| Expo owner / slug | cheblito / cyber-bless |
| EAS projectId | 8bd96afd-5d35-4c3c-8ccc-3735696a4973 |
| iOS bundleIdentifier | com.helio.cyberbless |
| Android package | com.helio.cyberbless |
| Apple Team | 6PG2WW6L6N（个人） |
| ascAppId / SKU | 6821271597 / cyber-bless-ios |
| 当前远程构建号 | iOS 4；Android 3 |

[EAS 项目](https://expo.dev/accounts/cheblito/projects/cyber-bless)、[本应用 App Store Connect](https://appstoreconnect.apple.com/apps/6821271597/distribution/ios/version/inflight) 均已核对。生产构建 remote 版本源、autoIncrement=true；preview 为内部安装 APK / iOS Ad Hoc，production 为 Android AAB / iOS 商店 IPA。iOS submit 指向本应用记录；Android submit 固定 internal。

现有 Apple Team 有效发布证书和已授权 ASC API Key 通过 EAS 远程服务复用；本应用创建了独立 App Store profile 96P2MP4LRD 和 Ad Hoc profile ZRUT7NU2Z8。证书及两个 profile 到期为 2027-03-19。Ad Hoc 当前包含一个原已注册设备，未新增设备或邀请测试者。Android 远程 keystore 已建立，APK 与 AAB 签名证书 SHA-256 相同：`fafedeae949ee307a36bdfc713330f740309d22d42b4c4db10c758664fc8407e`。后续更新保留签名连续性；Play App Signing 尚未在控制台建立，应用上传密钥与 Play 分发签名须分别记录。

私钥、证书密码、API Key 内容和 Play 服务账号 JSON 不在仓库。CI 使用环境 mobile-release 的 EXPO_TOKEN Secret。EAS wrapper 设置非秘密的 Apple Team / INDIVIDUAL 提示，避免现有 API Key 记录缺少 Team 元数据时退回密码登录。状态和商店准备脚本使用锁定 EAS SDK 读取已分配凭据，只在进程内签 JWT，不打印或落盘密钥。升级 EAS CLI 时必须检查此 SDK 接口。GitHub Secret 尚未配置；推送时自动运行 CI，云构建和上传仅通过 workflow_dispatch 主动触发。两个工作流均启用 Git LFS 下载，确保验证和云归档使用真实资源。

## 可重复运行的命令

2026-10-11 Expo Go连接核验：LAN服务正常，但iPhone扫码时未出现手机打包请求；电脑存在Clash TUN等网络接口，不能仅凭此认定TUN为唯一原因。已改用本地服务的Cloudflare隧道，公网HTTPS的manifest、iOS原生主包、DOM HTML和DOM JS全部HTTP200，原生和DOM预编译通过；同一公网地址的普通HTTP请求被重置。此网络环境应把Expo Go隧道链接的`exp://`改为`exps://`，强制使用HTTPS。当前有效二维码与地址保存在本地artifacts/expo-go/current.json，隧道重启后需重新生成，不把临时域名用于商店支持URL。iPhone上的Expo Go需登录与电脑CLI相同的Expo账号（本轮cheblito）；手机实际打开仍待重扫确认。

在仓库根目录使用 Node >=22.18（本轮 Node 24.11.1 / npm 11.16.0）：

```powershell
npm ci
npm run dev
npm run mobile:go
npm run mobile:go:tunnel
npm run verify
npm run mobile:archive:verify

npm run mobile:eas:android:preview
npm run mobile:eas:ios:preview
npm run mobile:eas:android
npm run mobile:eas:ios
npm run mobile:eas:ios:testflight

# 仅在本应用 Play 记录与服务账号发布权限就绪后使用：
npm run mobile:eas:android:internal

# 仅上传指定的、本应用已完成 STORE 构建；不使用 --latest：
npm run mobile:eas:submit:ios -- <EAS-build-UUID>
npm run mobile:eas:submit:android -- <EAS-build-UUID>

npm run mobile:eas:status
npm run mobile:eas:submissions
npm run mobile:store:status
npm run mobile:store:prepare
npm run mobile:testflight:prepare -- <Apple-build-UUID>
npm run mobile:legal:prepare
npm run mobile:play:assets
```

`mobile:eas:ios:testflight` 是新生产构建加自动上传；不是正式 App Review。指定构建上传脚本校验 EAS 项目、应用标识、平台、FINISHED 和 STORE，并拒绝已有成功或进行中 submission 的重复上传。Apple build UUID 与 EAS build UUID 不同；本轮两者见发布记录。商店准备命令更新当前可编辑版本的中文资料、分类、年龄问卷及五张截图，不提交审核或邀请测试者。截图同名且哈希一致时复用；不同则停止。联系人仍为空时 Apple 不允许保存审核备注，脚本明确记录这个阻塞。

CI 对 push / PR 执行业务测试、Web 构建与移动验证。云构建/指定上传仅使用手动 workflow_dispatch；不在每次 push 自动运行。手动工作流填写 platform/profile；build_id 为空时构建，非空时校验并上传该构建。首次凭据设置需要本地交互，之后工作流可 non-interactive。

`SHARP_IGNORE_GLOBAL_LIBVIPS=1` 已加入两种 EAS profile，修复首次 iOS 云环境使用全局 libvips 导致 Sharp 源码编译失败。使用 [Sharp 官方安装说明](https://sharp.pixelplumbing.com/install/) 所支持的预编译依赖，无需复制参考项目的缓存补丁或升级全部依赖。

## 验证与设备验收边界

| 层次 | 本轮结果 |
| --- | --- |
| Web | 现有业务测试全部通过；TypeScript/Vite 生产构建通过。浏览器实际创建心愿、刷新保留、木鱼12次结算和收藏通过；真实截图已保存 |
| Expo Go | 命令已配置；没有手机连接，未实际安装或扫描 Expo Go 验证 |
| 生产导出 | 移动类型检查、官方依赖检查、八个脚本边界测试及 iOS/Android 导出通过；原生主包、DOM HTML、所有 JS/CSS、动态块及九项资源长度/哈希验证通过 |
| 云归档 | EAS 官方 build:inspect archive 实际输出，在干净目录 npm ci、准备资源、双平台生产导出通过；约10.6 MB压缩源码上传，不包含旧672 MB研究资料 |
| 独立安装包 | 四种实际签名包下载并检查 ZIP CRC、原生/DOM/资源、iOS身份/profile/最低版本；Android身份、系统版本、权限和签名通过。没有真机安装验收 |
| 商店 | iOS 上传 FINISHED、Apple processing VALID；其他审核/上传状态见 store-release.md |

`mobile:verify` 每次创建独立导出目录及 TEMP/TMP/TMPDIR、Metro FileStore 缓存，Metro cacheVersion 还包含工作区绝对路径。曾发现跨解包目录命中旧 DOM 绝对路径；当前真实干净归档已验证不会引用原工作区。Expo 57 的 export:embed 在 CI=1 下会取消自动 resetCache，因此不能只靠 --reset-cache。证据保存在 artifacts/mobile-verification/latest.json 和 artifacts/eas-archive-latest.json。

签名包的进一步复核可运行：

```powershell
python scripts/inspect-mobile-package.py artifacts/packages/cyber-bless-preview-3.apk artifacts/packages/cyber-bless-3.aab artifacts/packages/cyber-bless-4.ipa artifacts/packages/cyber-bless-preview-4.ipa
```

17:01重新检查四包通过。AAB清单按AOSP AAPT2 protobuf格式直接解码，确认包名com.helio.cyberbless、1.0.0/3、minSdk24、targetSdk36，以及仅INTERNET、VIBRATE、自身广播权限；不依赖APK或配置文件推断AAB内容。报告保存在artifacts/mobile-verification/package-inspection.json。

待设备验收：安装、第一次冷启动、汉字输入与键盘滚动、弹窗关闭、核心仪式、连续保存失败/重试、杀进程后的存档、前后台恢复、Android硬件返回与WebView进程恢复、飞行模式首次打开随包场景、系统静音/触觉、低端设备Three.js表现。包结构检查与浏览器交互不会代替这些验收。当前 Vite 有既有开发调试动态块体积提示；业务测试有既有 React act 提示，均未导致验证失败。
