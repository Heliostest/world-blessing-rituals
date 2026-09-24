# 场景内容分发与缓存

截至 2026-09-24，应用具有通用场景目录、按需准备内容、共享磁盘缓存、历史重开和缓存管理入口。现有木鱼更新客户端仍保留本地优先、已确认版本与内置回退；新目录使用独立版本清单，资源缺失时重新下载，不把任意场景替换成木鱼。

## 架构与发布边界

| 层 | 内容与职责 | 生命周期 |
| --- | --- | --- |
| 安装包 | Expo DOM 宿主、React、Three.js、共享材质/后处理、已注册交互引擎、必要兜底内容 | 随 App 发版 |
| 云端目录 | ID、标题、引擎契约、版本、不可变清单地址 | 轻量元数据；推荐和浏览不下载资源 |
| 场景清单 | 场景身份、版本、引擎、命名资源表与受限配置 | 首次打开获取，成功准备后保存修复配方 |
| 按需资源 | GLB、纹理、音频、JSON 配置等受支持的数据文件 | 按 SHA-256 去重，受统一预算约束 |
| 运行内存/GPU | 当前解析模型、解码音频、事件、动画、renderer | 场景退出时释放 |
| 用户存档 | 体验历史、步骤、收藏、原有奖励/心愿 | 持久化保存；不属于资源缓存 |

`packages/content/src/catalog.ts` 验证通用目录和清单，`cache.ts` 负责容量预留、LRU 与使用中引用。`web.ts` 使用 IndexedDB，原生 `apps/mobile-expo/scene-cache.ts` 使用 Expo 文件系统与小型 AsyncStorage 索引；DOM 桥仅传递描述和 URI。所有内容客户端在同一 DOM 宿主中共享一个 Web 缓存协调器；Native 模块也只有一个协调器。当前 Web 保护租约以单页面宿主为范围，多标签页之间尚未同步使用中租约。

`packages/app/src/scene-engines.ts` 按版本注册本地引擎，统一宿主负责加载、暂停、恢复、取消和释放。木鱼、泉边一念和花水位一倾使用各自的实现。后两者是程序化 Three.js 场景，发布示例只下载一份共享的轻量文案配置；没有虚构大型模型来演示下载。

## 数百种交互逻辑如何扩展

每种真正不同的玩法注册独立的 `engine@version`，实现生命周期、依赖配置校验和自己的进度契约。相近玩法复用手势、Three.js、渲染风格和通用动作库，但不要求收敛成几个换皮模板。当前三个引擎使用整数步骤存档；未来自由布局等复杂玩法需要增加版本化 checkpoint schema 和迁移器，不应把所有状态压成步骤计数。场景内容版本允许变化，交互契约变化则升级引擎版本；不兼容引擎不得覆盖原存档进度。

动态 `import()` 只延迟代码加载/执行。Metro 输出的引擎代码仍进入 App 安装产物。本轮在安装包外按需下载的是数据，新增交互代码通过应用商店发版；未注册引擎会显示需要更新 App，并在下载资源之前终止。

官方资料于 2026-09-24 核对：Expo DOM 文档明确说明 DOM components 当前嵌入应用，尚不支持 OTA updates，因此不能直接把 EAS Update 作为本项目逐场景远端代码下载通道。[Expo DOM components](https://docs.expo.dev/guides/dom-components/)

如果业务以后要求“不更新 App 就增加完全不同的新玩法代码”，需要单独建设受隔离的网页小游戏容器、受限消息桥、清单认证、兼容/回退及审核流程。Apple 2.5.2 约束下载改变功能的代码；4.7 为 HTML5/JavaScript 小程序、小游戏等规定了独立要求，包括内容责任和原生能力暴露限制。Google Play 限制外部下载 dex/JAR/native 可执行代码，对解释器内代码另有例外及政策要求。这些规则不是任意执行远端脚本的授权；本轮没有实现该容器。[Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)；[Google Play Device and Network Abuse](https://support.google.com/googleplay/android-developer/answer/16559646?hl=en)

## 目录、清单与打开流程

目录示例：

```json
{
  "schemaVersion": 1,
  "scenes": [{
    "id": "celtic-folk-spring",
    "title": "泉边一念",
    "engine": "celtic-folk-spring@1",
    "revision": "v1-content-fingerprint",
    "manifestUrl": "scene-content-fingerprint.json"
  }]
}
```

清单示例结构：`{ schemaVersion: 1, sceneId, engine, revision, assets: { presentation: { path, bytes, sha256 } }, config: {} }`。资源地址相对清单解析。木鱼的命名资源为 `model` 和可选 `sound`，`config` 包含已验证的 bindings、parameters、copy、renderStyle；两个程序化场景只接受可选 `presentation` JSON（最多 8 KiB，caption 最多 300 字符）。其他资源类型由新引擎的校验器与加载器按契约接入，扩展名白名单本身不等于引擎已支持该资源。

目录最多 5000 项，网络元数据最多 2 MiB，单清单最多 128 个命名资源，内联配置最多 64 KiB。列表每次显示 24 项，可搜索或继续显示。目录刷新失败时读取上次目录；没有旧目录则展示内置条目和明确提示。每日推荐只从目录选取一项；未来推送只需携带 ID 或目录条目，不应调用下载接口。

点开场景会先记录体验意图，再检查引擎和版本身份。已有清单优先从本机读取；没有清单才请求 HTTPS 内容源。整个资源集合在下载前申请保护和容量预留，每项依次查缓存、校验字节数及 SHA-256，缺失才下载。完整准备后才挂载引擎。进度 UI 显示准备、下载/校验、就绪或失败；失败提供原因和重试。离开或取消会终止本次请求，不登记完整包。

已保存清单是一份重建配方，不代表文件永久存在。历史记录保存原版本清单地址和引擎，断网且缓存完整时直接重开；缓存被清理则请求缺失的资源。服务器需要长期保留历史不可变清单与哈希文件；服务端删除这些内容时，只能报告失败，不能凭空恢复。目录发布新版本不会主动替换正在体验的场景。

## 缓存策略与失败恢复

默认 **256 MiB 是全部场景共用的预算**。界面支持 64/128/256/512 MiB，设置保存在内容元数据里；底层 `maintain({ budget })` 支持配置整数正值。单资源最多 64 MiB。木鱼音效最多 4 MiB、解码后 3 秒/双声道；现有 GLB 几何、节点、贴图与依赖预算继续生效。

协调器以唯一哈希计算实际占用和未完成下载预留。活动场景、正在下载的资源与排队请求持有租约；共享文件只计一次，只有最后一个使用者释放后才参与淘汰。历史清单和收藏不构成永久磁盘引用。超额时按真实最近使用时间删除最旧的可删除资源；普通缓存读取也会更新 LRU，小索引更新不会重写模型二进制。

启动、回到前台、下载前后、场景退出和用户清理时执行维护，不依赖后台轮询定时器。降低预算时不删除活动资源，界面提示暂时超额；退出后再收敛到预算。受保护依赖本身超过预算时，在网络传输前返回容量不足。缓存 UI 的占用以最近一次维护快照为准，不为列表检查而读取全部模型。

原生缓存位于 `Paths.cache/wbr-scene-content-v1`。目录是可删除缓存，系统可能自行回收，应以实际文件为准；索引会在维护时对照真实文件修复。[Expo FileSystem](https://docs.expo.dev/versions/latest/sdk/filesystem/)

原生下载先检查可用空间，写唯一 `.part` 文件，完成后每 256 KiB 流式读取校验，再移动到哈希文件名。未完成文件不对引擎可见，启动清扫遗留半包；运行中的临时文件不会被维护误删。网络传输上限 20 秒，取消和错误都会停止请求并清理临时文件。排队请求取消立即释放预留；正在写入的传输在终止响应后释放自己的预留。桥接取消消息先于下载请求到达时也会记住取消意图。WebView 被终止时，原生壳取消传输并释放旧场景租约。

Web 校验完整响应后，以一个 IndexedDB 事务同时提交二进制和索引，失败时不留下半包。网络失败、哈希不符、缓存写入配额不足都会显示重试；已验证完整的单文件允许留下，以便重试时复用。缓存不可用时仍支持内置木鱼兜底，远端目录场景不谎报已缓存。

## 用户记录与使用入口

首页显示“今日场景推荐”和“浏览场景目录”。“我的 → 我的仪式记录”重新打开历史场景，恢复已保存步骤；“我的 → 资源缓存”显示占用、预算、使用中和预留容量，并提供“清理可删除资源”。收藏只保存喜好，不自动离线锁定资源。

`packages/core` 的 `sceneRecords` 保存 ID、标题、引擎、内容版本、清单地址、步骤、收藏和最近体验时间。旧存档缺少该字段时迁移为空列表，其他记录保持。它与原有心愿、仪式、奖励一起写入 `cyber-bless:personal:v1`，缓存 API 无权访问该 key。场景库的试体验步骤不会擅自生成原有仪式奖励；原有木鱼/纸鹤/心愿灯奖励路径继续由 core 管理。

清理资源不会删除用户记录，但卸载 App 或清除整个浏览器站点数据仍会删除本机存档。远端内容不修改奖励规则。新玩法进度契约若不兼容，界面保留历史版本并报告冲突，开发者需要提供明确迁移。

## 与原木鱼更新路径的关系

原有首页木鱼仪式保留“待用缓存 → 最近两个已确认缓存版本 → 独立内置轻量包”的本地优先策略，首帧成功后后台准备远端更新，下次进入试用。该客户端也接入同一个容量预算和完整包保护。旧入口用于离线兜底和既有奖励流程；新场景目录入口用于显式按需下载和通用历史重开。二者下载相同哈希时复用文件。

木鱼 `original`、`toon-ink`、`toon-soft` 仍使用 Three.js `MeshToonMaterial` 与 pmndrs/postprocessing。没有新增自写 GLSL。引擎首帧、渲染失败回退、卸载时模型/材质/纹理/阴影/动画/监听/renderer 释放继续保留。程序化场景也释放 renderer 并主动销毁 WebGL 上下文；减少动态效果不冻结手势计时。

## 开发与云端发布

正式环境的云服务评估、资源上传、EAS 构建和真机验收步骤见 [正式上线部署手册](production-deployment.md)。

```powershell
npm install
npm run content:publish
npm run dev -- --port 5177
```

发布输出位于忽略的 `artifacts/scene-content/`：`catalog.json`、`scene-<sha256>.json`、哈希资源，以及兼容旧入口的 `woodfish.json` 和 releases。两个程序化场景共享一份小 JSON。Vite 开发路由提供这些文件，不把它们复制到生产 public；手机不预装所有远端资源。原内置模型及必需字体/插画仍随壳发布。

生产 Web 设置 `VITE_SCENE_CATALOG_URL`，Expo 设置 `EXPO_PUBLIC_SCENE_CATALOG_URL`，地址指向 HTTPS `catalog.json`。旧木鱼后台更新另用 `VITE_SCENE_MANIFEST_URL` / `EXPO_PUBLIC_SCENE_MANIFEST_URL`。不配置目录则只显示内置条目。本仓库没有部署 CDN、目录服务或通知服务。

上传顺序为哈希资源 → 不可变场景清单 → 目录，目录使用 `Cache-Control: no-cache`，不可变资源长期缓存。按内容指纹生成新的版本/清单，禁止在原地址覆盖语义不同的内容。回滚时将目录指回保留的旧版本。内容源应支持 Web/DOM 的 CORS；公共无凭据内容允许 `Access-Control-Allow-Origin: *`。仅 localhost Web 开发允许 HTTP，Native 资源下载要求 HTTPS。SHA-256 证明资源与清单一致；清单信任来自 HTTPS，本轮未实现签名体系。

新增引擎时，需要增加本地模块与注册项、更新 `supportsScene`/引擎配置校验、定义进度恢复，并按单元测试和真实浏览器生命周期测试验收。可以复用 `mountScene`、缓存租约和共享 renderer 风格，但不得加载清单提供的 JavaScript。

## 验证边界

```powershell
npm test
npm run build
npm run mobile:verify
$env:WBR_URL='http://127.0.0.1:5177/'
python scripts/test-scene-library.py
python scripts/test-scene-content.py
python scripts/test-debug-overlay.py
python scripts/test-woodfish-pointer.py
```

单元测试使用小资源和文件系统边界替身，覆盖全局预算、真实 LRU、共享依赖保护、排队取消、磁盘不足、坏包、半包、重启修复与持久化迁移。浏览器测试使用 500 条目录夹具、真实 IndexedDB 和 WebGL，验证按需下载、命中、历史进度、清理重开、共享引用、离线、错误重试与反复进入退出。WebGL 检查同时记录显式删除和上下文销毁，不以 DOM canvas 数量替代 GPU 生命周期检查。

2026-09-24 实际结果：`npm run verify` 通过 102 项单元测试、木鱼素材预算校验、Web 构建和两端嵌入打包。场景库、原木鱼内容更新/回退、Shader 面板与木鱼触控浏览器测试通过；场景库循环的 9 个 WebGL 上下文全部销毁，存活 GPU 资源计数归零。此结果来自桌面浏览器软件环境与测试夹具，不是手机 GPU 实测数据。

`mobile:verify` 运行 TypeScript 和 Android/iOS 的 Expo 原生包及嵌入 DOM HTML/JS/CSS/资源校验。**这是打包检查，不是真机验收。** 真机发布前仍需验证两端 Native file URI、低存储容量、系统回收缓存、下载暂停时机、进程被杀、WebView 重建、峰值 RAM/GPU、帧率、音频与触觉。本轮没有签名 APK/IPA、应用商店提交或设备性能测量。
