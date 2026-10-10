# 一日一念商店发布记录

记录日期：2026-10-10，以下时间均为北京时间（UTC+8）。已配置并验证；四种构建完成；iOS 上传完成且 Apple 处理成功；**外部 TestFlight 审核未提交、正式 App Review 未提交、Google Play 未上传、未公开上架**。iOS 已保存手动发布，Android 仅授权推进 internal。

2026-10-11 已整合 origin/master 的 588e30a，包含 PR #20 的三入口场景、PR #21 的今日日常集合／心愿祈愿容器选择，以及 PR #22 的今日主仪式／已收藏三选一祈愿。移动发布修改已保留，包括新场景参数和离线法务入口。本记录下面的 iOS4／Android3 安装包均在这些产品改动之前生成，尚未包含 #20、#21、#22；后续需重新构建安装包，并同步更新截图和审核说明。源码合并与生产导出不会更新现有 TestFlight 或 Android 安装包。

2026-10-11 合并后的 `npm run verify` 和 `npm run mobile:archive:verify` 均通过：业务测试、Web 构建、移动类型和官方依赖检查、iOS／Android 原生与 DOM 生产导出，以及实际 EAS 上传归档在干净目录中的安装和双平台导出。两个平台各验证 9 项离线资源、共 10,898,848 字节的长度和哈希；未进行新一轮 EAS 云构建或商店提交。此次本地日志分别为 artifacts/git-merged-verify-20261011.log 和 artifacts/git-merged-archive-20261011.log。

## 实际构建、上传和 Apple 状态

| 用途 | 版本/构建号 | EAS build ID | 完成时间/结果 |
| --- | --- | --- | --- |
| iOS 商店 IPA | 1.0.0 (4) | [c62983e4-f64e-420d-8175-a7f36f029c6d](https://expo.dev/accounts/cheblito/projects/cyber-bless/builds/c62983e4-f64e-420d-8175-a7f36f029c6d) | 15:56:49 FINISHED |
| iOS Ad Hoc IPA | 1.0.0 (4) | [684115fb-db82-4b08-9da9-8f9c47d3b3f4](https://expo.dev/accounts/cheblito/projects/cyber-bless/builds/684115fb-db82-4b08-9da9-8f9c47d3b3f4) | 16:09:51 FINISHED |
| Android production AAB | 1.0.0 (3) | [e48070df-7315-47c1-b014-fc07cf76fb4d](https://expo.dev/accounts/cheblito/projects/cyber-bless/builds/e48070df-7315-47c1-b014-fc07cf76fb4d) | 16:13:23 FINISHED |
| Android preview APK | 1.0.0 (3) | [19fdef42-3a5f-4103-875a-9bc96891d51a](https://expo.dev/accounts/cheblito/projects/cyber-bless/builds/19fdef42-3a5f-4103-875a-9bc96891d51a) | 16:18:16 FINISHED |

iOS EAS submission [5cd5aac3-1748-48e9-8ec4-63b140ccd0c9](https://expo.dev/accounts/cheblito/projects/cyber-bless/submissions/5cd5aac3-1748-48e9-8ec4-63b140ccd0c9) 于15:57:02 FINISHED，明确关联生产 build c62983e4。Apple 上传时间15:57:44；16:20官方API核查 processingState=VALID、版本1.0.0、构建4、com.helio.cyberbless、非豁免加密=false。Apple build UUID 是 `5f5a12fb-7cb7-4256-a20f-228b85ba1c40`，最低iOS16.4。内部状态 READY_FOR_BETA_TESTING，外部 READY_FOR_BETA_SUBMISSION。不要重复上传此包。

App Store 草稿 version ID `84ab28c1-b40b-4d0c-ade2-d3e02d2eaf62`，状态 PREPARE_FOR_SUBMISSION，releaseType=MANUAL。本轮未点击最终正式提交，没有正式 review submission ID、时间或审核结果。EAS submission ID 只代表上传，不代表 App Review。

历史失败：iOS build3 [789e6a31-fcdb-4885-8663-a999e13850ff](https://expo.dev/accounts/cheblito/projects/cyber-bless/builds/789e6a31-fcdb-4885-8663-a999e13850ff) 在15:49:23因Sharp安装失败；其submission `3a824bec-2205-44ea-a248-767c211376d3` 为 CANCELED。构建1/2在签名准备阶段消耗远程号，没有云构建任务。修复后成功构建4，不回退号。Android旧APK1、AAB2已被移除悬浮窗权限后的版本3取代，均未上传Play。第一次过大源码归档在云构建创建前中断，build:list确认当时无任务。

本地包与哈希：

| 文件（artifacts/packages） | 字节 | SHA-256 |
| --- | --- | --- |
| cyber-bless-4.ipa | 20,178,252 | 9117053345dc98d529f7519ed47f8953b2646aab467b892f94f2f2a015315741 |
| cyber-bless-preview-4.ipa | 18,427,084 | ff081f8ba6a3498025d2117297e3de8a8f956c7a269f8850ec5463c38e7a3bc9 |
| cyber-bless-3.aab | 59,414,522 | a64a12f398773a99d7f7141f4a4667bc7d3cb572210b35dc4a9be37a851e73fa |
| cyber-bless-preview-3.apk | 81,741,457 | a490ed5da77d2b945d26cb1f72b4e778c8cf6daa0124524ae77102fecadba6c4 |

签名凭据、最低系统、配置和重复运行命令见 [mobile-app.md](mobile-app.md)。不把IPA下载地址当作TestFlight安装链接；商店签名IPA也不供普通iPhone直接安装。

## iOS 资料与审核摘要

[本应用商店草稿](https://appstoreconnect.apple.com/apps/6821271597/distribution/ios/version/inflight) 的身份：一日一念，中文主语言，1.0.0，SKU cyber-bless-ios，Apple ID6821271597，Team6PG2WW6L6N。Developer会员已核查有效至2027-04-08，最新Developer协议于2026-10-10已接受，未发现当前协议待处理提示。本轮没有代替用户接受协议、付款或复制其他应用的私密联系人。

| 资料 | 当前结果 |
| --- | --- |
| 名称/副标题 | 一日一念 / 心愿记录与轻松日常仪式，已保存 |
| 分类 | 生活（LIFESTYLE），已保存 |
| 描述/关键词/推广文本 | store/ios/zh-Hans.json，已保存到本应用草稿 |
| 截图 | 五张1206×2622 PNG，无alpha；官方API上传并处理COMPLETE |
| 年龄问卷 | store/ios/age-rating.json，已保存；因含日常放松/自我照顾主题，healthOrWellnessTopics=true；没有医疗建议、赌注、广告、聊天或公开UGC |
| 商店当前分级 | UI显示9+（172个地区）、越南12+，韩国全部；低于OS26的旧分级全球4+（区域有例外）。API旧字段FOUR_PLUS不能代替当前UI的9+ |
| 登录 | 不需要，已选；无需审核账号 |
| 审核步骤 | 修正版已在JSON中准备；Apple要求联系人齐全才能保存更新，暂未保存修正版 |
| 审核联系人/版权主体 | 尚未获得本应用事实，未填写 |
| App Privacy | 已保存“未收集数据”草稿；隐私URL和最终发布待完成 |
| 内容版权声明 | 待确认两张UI图商业发行权后填写；未虚构全部原创或许可证 |
| 价格/供应地区/相关资质 | 待确认；建议免费，未直接启用中国大陆/越南或推断DSA经营者身份 |
| 正式构建关联 | 尚未关联，待最终法务内容重建、处理和完整摘要核对后选择对应Apple build |
| 发布方式 | MANUAL已保存；不自动公开发布 |

截图来自本项目生产Web界面的Chrome浏览器移动视口，使用CDP截图生成实际像素，包含今日、心愿、木鱼交互、小天地、离线隐私页。示例心愿为本轮测试文字，没有真机或模拟器状态栏。未使用Historia截图，也没有拼接或假设备框。源文件保存在 store/screenshots/ios/zh-Hans，上传清单在 store/ios/zh-Hans.json。API截图集ID `c57bd4cf-09fa-40f0-81c8-55c596eac4cc`，类型APP_IPHONE_61，五项COMPLETE。Apple现行要求必需的Dynamic Island medium显示尺寸包含1206×2622，见[官方规格](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)。后续真机安全区验收后，可替换为原生实际截图。

审核操作：冷启动 → 今日/许个愿 → 输入保存 → 木鱼轻敲12次 → 收藏 → 心愿/小天地查记录 → 退出重开 → 我的隐私与帮助。仪式是娱乐、创意与日常放松，不承诺实现愿望、宗教效力或健康改善。仪式文字可以由用户主动系统分享或复制；没有开发者分享服务器。当前商店已有旧备注含“不存在用户分享”的不准确句子，修正版已准备，必须在正式提审前替换；联系人为空时API和网页保存均被必填校验拒绝。

首次正式提审的剩余动作：填本应用联系人与版权/内容声明，确认价格与地区和必要资质；公开支持/隐私页并匿名核验，填URL，发布隐私答案；完成最终法务内容的下一生产构建、上传和处理，关联对应Apple build；展示完整最终摘要，核对后“添加以供审核”，继续最终“提交以供审核”。必须确认 App Review 的 Waiting for Review/In Review 等实际状态并保存正式submission ID、时间和截图。当前并未达到这个阶段，不把TestFlight提交代替它。

若补充App内联系方式、修改法务文字或其他产品代码，需要先验证并重建下一生产构建号，再上传、处理和关联该新构建。当前工作区新增了分享隐私说明；已上传4与已构建Android3的原文尚未包含该补充。最终提审必须核对所选包与最终法务资料，不能只凭“最新上传”选择旧包。

## TestFlight 与 iPhone 安装

[本应用TestFlight](https://appstoreconnect.apple.com/teams/35eae2d8-e82b-42cb-b481-f0b20d0fb72f/apps/6821271597/testflight) 已建立：

| 组 | ID | 构建/测试者/链接 |
| --- | --- | --- |
| Team (Expo)，内部 | f6096459-cc7f-421b-ad5c-b6cc1fbf8683 | 已关联Apple build4；0测试者 |
| 一日一念 External，外部 | e70946c3-b95d-4ba6-a9d9-c223e1c706ed | 未关联外部可测构建；0测试者；publicLinkEnabled=false，无链接 |

构建4中文“测试内容”已保存，betaBuildLocalization ID `af7c5c8d-42f6-4a98-a6a6-60c9d16e5b86`。反馈邮箱、Beta Review联系人和隐私URL仍缺，因此首次外部Beta审核未提交。没有邀请团队，也没有开启公开邀请。

自己测试：在iPhone安装Apple官方TestFlight；使用获本应用访问权限的App Store Connect用户，把本人加入内部组后，用邀请邮件/兑换入口在TestFlight接受并安装1.0.0(4)。内部组成员须具备适用的App Store Connect角色和本应用访问权限，不要求注册UDID。当前0测试者，所以仅有包上传成功，尚无本人安装邀请。

团队测试：用户先提供授权邀请的邮箱名单；外部组在必填信息齐全后提交首次Beta App Review，等待批准，再发邀请或明确授权后开启公开链接。测试者用TestFlight接受、安装、通过TestFlight发送反馈。外部测试者不必成为App Store Connect用户，也不要求注册UDID。TestFlight构建最长90天有效，本轮Apple记录到期2027-01-08北京时间约15:57。

iOS内部Ad Hoc安装是另一条路径：[preview构建页](https://expo.dev/accounts/cheblito/projects/cyber-bless/builds/684115fb-db82-4b08-9da9-8f9c47d3b3f4)。当前profile只有一个既有注册设备。新增iPhone先在本项目目录运行EAS device:create，让设备持有人按登记链接安装描述文件提交UDID；通过本Team注册后重建preview或针对指定preview执行build:resign。EAS安装页面只对profile包含的设备有效；达到Apple年度设备注册限制后不能靠公开链接绕过。商店/TestFlight包不受Ad Hoc设备列表限制。

## 支持/隐私页面与数据审计

共享离线文本已进入App。“我的 → 隐私说明/使用帮助”可离线阅读。公开页面源由 `npm run mobile:legal:prepare` 重建，不需要Web SDK或分析脚本。Sites项目、部署ID及来源commit保存在 store/support-site.json；生成目录sites/cyber-bless-support是本应用独立Sites源码checkout，排除根Git和EAS归档。页面源逻辑和共享文本在根项目中保存，可在新checkout重建并沿用原Sites项目，不能重复创建新站点身份。

私有审阅部署于16:01:15完成，项目 `appgprj_6ac9ef2b05948191ac9ad8cb7bf4c9d5`，deployment `appgdep_6ac9f0bd26c88191937290cb7080078a`：[审阅站点](https://cyber-bless-support.syrupyfern16.chatgpt.site)。这不是匿名可访问的商店合规URL。拟定公开路径为 /privacy/ 和 /support/，待公开邮箱确认并更新部署/公开访问后再填写商店。发布准备时必须检查匿名HTTP200和实际正文，不能仅看Sites私有部署成功。

| 审计项 | 当前1.0.0构建事实与披露 |
| --- | --- |
| 账号/登录/云同步 | 无；记录仅本机，不上传开发者服务器 |
| 权限 | Android INTERNET、VIBRATE及自身广播权限；无危险权限。iOS无相机、麦克风、定位请求 |
| 分析/广告/崩溃/支付 | 无相应SDK、跟踪、订阅或IAP；构建工具遥测不属于App运行时SDK |
| 网络 | 当前未配置在线目录/manifest；基础资源随包。以后启用内容服务须核对IP/日志保存及第三方收集 |
| 用户分享 | 主动调用系统分享/复制文本；接收服务由用户选择，无开发者分享服务器 |
| 支持/TestFlight/系统备份 | 用户主动反馈及平台系统行为按平台政策处理；不得把开发者主动加入的SDK收集当作平台例外 |
| iOS Privacy Manifest | 实际IPA包含九份manifest；数据收集列表为空，tracking=false；聚合required API理由为UserDefaults CA92.1、文件时间戳C617.1、启动时间35F9.1 |
| 加密 | 无自定义业务加密；实际用途为系统HTTPS和资源SHA-256完整性，不以哈希当作加密。Apple处理确认usesNonExemptEncryption=false |
| 版权 | 字体两份OFL随包；模型本项目制作；两张用户UI图片发行权需确认 |

当前App Privacy无收集答案已保存但未最终发布。Android Data safety草稿同样基于当前无服务端收集/分享，必须在Play记录建立后核对实际问卷并保存；目前不能声称Play已填写。以后增加账号、线上日志、分析、广告、诊断或支付时必须重新审计和披露。

## Google Play 独立核查与 Android 安装

[当前Play Developer控制台](https://play.google.com/console/u/0/developers/9079668922252340806/app-list) 为个人账号。开发者记录存在，但身份文件验证未完成；电话验证依赖身份批准，“创建应用”禁用。付款状态与设备验证完成状态未获得独立确认。没有本应用Play记录、Play App Signing设置、有效的应用发布服务账号或internal测试链接；没有尝试上传到错误应用。

17:02通过EAS官方SDK按本项目ID和包名读取远程凭据，确认Android keystore存在、默认构建凭据属于本应用，googleServiceAccountKeyForSubmissions为空；未读取或输出私钥到文件。安全摘要保存在artifacts/mobile-verification/android-credentials-status.json。

用户必须在该控制台完成其要求的身份文件、电话、必要的实体Android设备验证及任何付款/协议提示。身份文件、OTP、付款与协议由用户本人处理。解锁后创建本应用：一日一念，应用，默认中文，包名com.helio.cyberbless；进入App Integrity核对Play App Signing，保留本轮EAS上传密钥。不要选择Historia的商店记录。

按[Expo当前EAS Submit Android官方流程](https://docs.expo.dev/submit/android/)在Google Cloud启用Android Developer API，并为本应用配置Google服务账号。Play用户/权限只授予该服务账号本应用所需测试轨道发布权限与必要查看权限，避免全局Admin或无关应用访问。通过 `npm exec -w @wbr/mobile -- eas credentials -p android` 的EAS Submit凭据入口上传JSON到EAS远程，不提交JSON到Git。当前官方流程可用EAS Submit完成首次上传；若本账号/应用实际返回必须控制台处理的错误，再根据错误安排手动步骤，不采用“首次必然手动”的旧结论。

凭据就绪后只上传已完成的AAB3：`npm run mobile:eas:submit:android -- e48070df-7315-47c1-b014-fc07cf76fb4d`。本轮没有执行该上传，因为账号尚无法创建应用。核对实际versionCode3、包名、internal轨道、release状态及可加入测试入口。后续新版本使用mobile:eas:android:internal构建并自动提交，production公开轨道必须另获明确授权。

商店中文名称、简介、说明、图标/置顶图与手机截图准备在store/android和store/screenshots/android；隐私、无广告、无登录的应用访问说明与Data safety依据本审计填写。内容分级需要在控制台完成真实问卷，不能将Apple9+直接当作IARC结果。目标受众与地区需用户确认，未宣称儿童专用；闭测/生产访问也未申请。

新个人账号的后续公开生产访问通常要求至少12位测试者连续加入封闭测试14天，并通过生产访问申请；以当前账号实际控制台要求为准，[Google官方说明](https://support.google.com/googleplay/android-developer/answer/14151465)。internal测试不替代此闭测要求，本轮范围止于internal。

现在安装APK：在Android设备打开[APK preview构建页](https://expo.dev/accounts/cheblito/projects/cyber-bless/builds/19fdef42-3a5f-4103-875a-9bc96891d51a)，下载APK，为该下载来源临时允许安装未知应用，核对一日一念后安装；安装后可关闭该来源许可。最低Android7.0。AAB不能直接点击安装。Play就绪后：把用户授权的Google邮箱加入internal测试者列表，测试者用该账号访问真实加入测试链接，接受测试并通过Play安装。当前没有链接或邀请，不能凭包名猜测测试URL。

## 继续工作所需的最少用户事实

1. 公开支持/反馈邮箱；本应用版权发行主体；App Review与Beta Review联系人的名字、姓氏、邮箱、国际格式电话。可以明确授权复用指定已有事实；不能默认跨应用复制私密信息。
2. 确认两张现有UI参考图具备商业发行权；确认免费或其他定价、首发地区（建议先排除未提供相关资质的地区），以及适用的地区资格/DSA经营者事实。需要法律承诺的最终操作在具体资料准备后核对。
3. 在Play控制台完成阻塞的身份、电话及控制台要求的付款/设备验证；提供被授权邀请的测试者名单后才发邀请。没有名单也可以先完成构建和审核准备。

Chrome原版本页出现“未保存的更改将会丢失”确认框，用户选择稍后处理；未强行关闭。已用官方API和新页继续完成独立资料、隐私草稿及终端工作。审核联系人空值是独立且真实的提审阻塞；解除浏览器框不会代替必填事实。

本轮证据位于 artifacts/store-evidence：apple-bundle-id.png、app-store-record.png、apple-processing-build-4.png、app-review-contact-required.png、app-privacy-draft.png、app-info-9plus.png、google-play-verification-required.png。API原始状态的安全摘要位于artifacts/mobile-verification，构建/提交/包检查脚本可重取最新状态。最终正式审核与Play发布截图目前不存在，因为尚未提交。验证详细边界见mobile-app.md。
