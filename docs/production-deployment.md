# 正式上线与场景资源部署手册

状态：部署准备稿，供项目维护者后续评估云服务并执行上线。核对日期：2026-09-24；代码基线：`8602c4f`。本手册不代表已经开通云服务、上传资源或完成商店发布。

## 1. 发布边界

正式 App 继续使用 Expo，通过 EAS Build 生成签名安装包。客户安装独立 App，无需 Expo Go 或开发电脑。Three.js 在手机上渲染，云端只分发目录和数据文件，模型下载不需要专门的渲染服务器。

| 部分 | 发布位置 | 更新方式 |
| --- | --- | --- |
| Expo 宿主、React、Three.js、共享材质与后处理 | App 安装包 | App 发版 |
| 已注册场景交互程序、必要兜底资源 | App 安装包 | App 发版 |
| GLB、贴图、音频、受支持的配置 | 对象存储，经 CDN 分发 | 独立内容发布 |
| 场景目录、不可变版本清单 | 同一 HTTPS 内容域名 | 发布资源后更新目录 |
| 手机资源缓存 | Expo 缓存目录 | 全场景共享预算，默认 256 MiB，按需淘汰 |
| 历史、进度、收藏、奖励 | 当前为手机持久化存档 | 与缓存清理分离；跨设备同步另行接入 |

已有引擎支持的内容变更无需重新上架。完全不同的玩法通过独立引擎模块扩展，目前需要随 App 发版。动态 `import()` 不等于远端代码下载；Expo DOM 官方当前仍列明不支持 OTA，因此不能直接使用 EAS Update 分发本项目的 DOM 场景代码。[官方限制](https://docs.expo.dev/guides/dom-components/#limitations)

## 2. 云服务评估与待办

本阶段采用“对象存储＋CDN＋自有资源域名”的部署结构，暂不指定厂商。目录初期使用静态 JSON，无需先搭建运营后台。推荐或推送只传场景 ID，不触发整包预下载。

选择服务前填写以下记录；价格与平台要求以选型当日资料为准。

| 核实项 | 评估依据 | 选型记录 |
| --- | --- | --- |
| 用户地域与发行渠道 | 国内、海外或两者；实际目标地区的移动网络下载测试 | 待填写 |
| 存储与 CDN | HTTPS、自定义域名、CORS、自定义响应头、访问日志 | 待填写 |
| 性能与稳定性 | 真实手机首次打开耗时、失败率、弱网重试；不能只看厂商节点数量 | 待填写 |
| 费用 | 存储、用户下行流量、回源流量、请求、日志及版本备份费用 | 待填写 |
| 版本保留 | 历史不可变清单和资源的保留期限、备份、误删恢复 | 待填写 |
| 发布权限 | 上传身份与客户读取分离，凭据留在发布环境 | 待填写 |
| 域名与渠道要求 | 目标地区的域名、资质和应用商店要求，执行前核实 | 待填写 |
| App 身份 | EAS 项目归属、商店账号、签名保管、最终包名 | 待填写 |

成本估算使用实际测试数据：月资源流量约等于“打开场景次数 × 平均缺失资源字节数”，另计重试和元数据流量。CDN 命中降低回源量，手机缓存命中减少实际下载，两者分别统计。数百个目录条目本身不代表数百套模型都会下载。

## 3. 资源发布

在仓库根目录生成现有场景的内容产物：

```powershell
npm ci
npm run content:publish
```

产物位于 `artifacts/scene-content/`。当前脚本包含木鱼和两个程序化场景，不会自动发现所有未来场景；新增场景需要扩展发布输入与引擎注册。此命令仅生成本地文件，不会上传云端。

以下为内容域名的示意结构，`assets.example.com` 必须替换为实际域名。保持产物相对路径不变，不手工修改哈希文件名。

```text
https://assets.example.com/scenes/
  catalog.json
  scene-<sha256>.json
  <sha256>.glb
  <sha256>.json
  <sha256>.mp3       # 配置音效时才生成
  woodfish.json     # 兼容原木鱼更新入口
  releases/        # 原木鱼发布记录
```

按顺序发布，确保客户看到目录时资源已经可读：

1. 上传本次引用的哈希资源，核对字节数与 SHA-256。
2. 上传不可变场景清单及发布记录，通过正式 CDN 地址核实依赖全部可访问。
3. 保存上一版目录，再替换 `catalog.json`；如使用原木鱼更新入口，同时更新其 `woodfish.json` 指针。
4. 刷新可变指针的 CDN 缓存，用独立测试包完成一次真实下载和历史重开。

| 对象 | 建议响应配置 |
| --- | --- |
| `catalog.json`、`woodfish.json` | `Cache-Control: no-cache`，CDN 不强制覆盖为长 TTL |
| 哈希资源、不可变清单 | `Cache-Control: public, max-age=31536000, immutable` |
| JSON / GLB / 音频 | 正确的 `Content-Type`，例如 `application/json`、`model/gltf-binary` |
| 公共无凭据内容 | `Access-Control-Allow-Origin: *`，支持 GET/HEAD 和必要的 OPTIONS |

原生资源下载要求 HTTPS。当前读取链路按公共无凭据内容设计；付费私有资源、鉴权或签名 URL 必须另行接入，不能只把存储桶改为私有。SHA-256 校验依赖来自 HTTPS 的清单，当前没有清单签名机制。

发布上传不得使用会删除旧对象的镜像同步选项。旧清单和哈希资源是历史场景重新下载的依据，不能按“当前目录未引用”直接删除。云端永久删除资源与手机缓存淘汰是两套策略。

内容回滚时将目录恢复到保留的旧版本并刷新目录缓存，不覆盖已有哈希地址。已保存的历史记录仍引用原版本，目录回滚不会自动迁移这些记录，也不会撤销已经下载的内容；有问题的历史版本需要另行制定兼容或停用处理。

## 4. 独立 App 构建与提交

仓库已有 `apps/mobile-expo/eas.json`：`preview` 为内部测试，Android 生成 APK；`production` 自动递增构建号，Android 生成 AAB。`app.json` 当前两端标识为 `com.helio.cyberbless`，尚未写入 EAS `projectId`。正式发行前按第 2 节确定项目归属和包名，绑定项目并配置签名。[EAS 初始化说明](https://docs.expo.dev/build/setup/)

在 `apps/mobile-expo` 目录运行以下初始化命令，完成后审查配置差异，保留现有构建 profile：

```powershell
npx eas-cli@latest login
npx eas-cli@latest build:configure
```

在 EAS 项目控制台为 `preview` 和 `production` 分别配置环境变量。测试环境使用独立域名或路径，避免试发布覆盖正式目录：

```dotenv
EXPO_PUBLIC_SCENE_CATALOG_URL=https://assets.example.com/scenes/catalog.json
# 仅启用原木鱼后台更新路径时设置：
EXPO_PUBLIC_SCENE_MANIFEST_URL=https://assets.example.com/scenes/woodfish.json
```

建议在对应 build profile 中显式增加 `"environment": "preview"` / `"environment": "production"`，保留已有字段。地址在构建时进入客户端，不能包含存储写入密钥；未设置目录地址时应用只展示内置条目。生产构建不要依赖开发电脑的 `.env.local`。[EAS 环境变量](https://docs.expo.dev/eas/environment-variables/)

构建前在仓库根目录运行 `npm run verify`。云端构建 Node 版本应满足根目录声明的 `>=22.18.0`，选定 EAS 构建镜像后核实实际版本。现有 `eas-build-post-install` 会准备内置资源；不把整个远端产物目录复制进安装包。

回到 `apps/mobile-expo`，按所需阶段运行：

```powershell
# Android 独立测试包，使用 preview 内容环境
npx eas-cli@latest build --platform android --profile preview

# 两端商店构建，使用 production 内容环境
npx eas-cli@latest build --platform all --profile production
```

iOS 上线前通过 TestFlight 验证正式签名构建；开发者账号和签名凭据需要提前配置。Android 的现有 production AAB 面向 Google Play；其他 Android 商店按各渠道要求增加构建 profile，不假定它们都接收 AAB。[正式构建说明](https://docs.expo.dev/deploy/build-project/)

以下命令在完成验收、准备商店资料后使用；交互中明确选择已经验收的构建：

```powershell
npx eas-cli@latest submit --platform android
npx eas-cli@latest submit --platform ios
```

EAS Submit 上传二进制，不代表审核通过或正式发布。iOS 上传后进入 App Store Connect/TestFlight，正式上架仍需选择构建、补齐资料并提交审核；Google Play 的测试轨道与正式发布也需在渠道侧完成配置。记录每次提交的 Git SHA、EAS 构建 ID、包版本、内容目录快照和验收设备。[提交说明](https://docs.expo.dev/deploy/submit-to-app-stores/)

## 5. 上线验收与运行检查

在正式资源域名和签名安装包上逐项记录结果，不用 Expo Go 或桌面浏览器结果替代真机结果。

| 检查 | 通过依据 |
| --- | --- |
| 独立运行 | 关闭开发服务器，手机正常启动并打开内置兜底 |
| 目录与推荐 | 浏览列表只请求元数据，没有批量下载模型或音频 |
| 首次打开和重开 | 首次下载、校验后打开；缓存完整时重开不下载二进制 |
| 淘汰与进度 | 清理或超过全局预算后重开历史，重新下载且进度、收藏不丢失 |
| 活动与共享资源 | 清理期间当前场景正常运行，共享文件不会被误删 |
| 离线和错误 | 缓存完整时离线打开；资源缺失、校验失败时状态和重试明确 |
| 中断与磁盘不足 | 取消、退后台、杀进程、低空间和系统回收缓存后恢复明确，无半包冒充完整资源 |
| 场景生命周期 | 多次进出观察真实设备 RAM/GPU、帧率、音频和触觉，确认资源不持续积累 |
| 内容更新与回滚 | 新旧 App 的引擎兼容检查正确；旧历史版本仍可下载 |

云端接通后关注目录/资源的 404、5xx、延迟、CDN 命中与流量费用，并设置预算告警。当前仓库没有接入线上遥测服务，不将这些检查描述为已经部署的监控。

现有验证记录见 [场景内容文档](scene-content.md#验证边界)：102 项单元测试、Web 构建、Expo 两端嵌入导出检查和四组浏览器测试已通过。这些来自前次实现验收；本手册编写没有重新执行构建，也没有完成签名 APK/IPA 或真机验收。

## 6. 代码与资料索引

| 手册内容 | 核对来源 |
| --- | --- |
| 现有 profile、包名、安装后资源准备 | [eas.json](../apps/mobile-expo/eas.json)、[app.json](../apps/mobile-expo/app.json)、[移动端 package.json](../apps/mobile-expo/package.json) |
| 环境变量接入 | [移动入口](../apps/mobile-expo/App.tsx) |
| 产物文件名、发布场景范围 | [发布脚本](../scripts/publish-scene-content.mjs) |
| 缓存、历史与引擎边界 | [场景内容分发](scene-content.md) |
| 构建、提交、变量与 DOM 限制 | 各节所附 Expo 官方页面，2026-09-24 核对，实际发布前复核变化 |

后续选型完成后，补充具体存储桶、域名、上传工具、CDN 配置与发布身份，并据此实现自动上传流程。本次仅整理手册和文档入口，不创建外部服务或修改运行配置。
