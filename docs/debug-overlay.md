# 场景 Shader 调试面板

运行 `npm run dev -- --port 5176`，进入场景后点击右侧 **SHADER LAB**。开发环境默认显示入口；生产构建需在页面地址添加 `?debug=1` 才启用。手机上入口和紧凑面板位于右下方。

当前接入木鱼，以及 `/dev/scene/celtic-folk-spring`（泉边一念）和 `/dev/scene/theravada-water`（花水位一倾）。选择原始光照、墨线卡通或柔和卡通后，会立即更新当前画布，不重置仪式进度。多个已挂载场景可以通过下拉框分别选择；离开场景会移除其调试项并释放后处理资源。

选择按场景 ID 保存到当前浏览器的 `wbr.debug.scene-styles.v1`，刷新或重新进入场景后仍然有效。存储不可用时仍可实时预览。点击“恢复内容默认”清除该场景覆盖，木鱼重新使用当前内容包的 `renderStyle`；两个旧场景默认使用原始光照。普通生产页面不读取或应用调试覆盖；面板不修改内容包或用户存档。Shader 绘制失败后回退到原始光照，并显示实际生效状态。

新 Three.js 场景可使用 `@wbr/scene-runtime/debug-render-style` 的 `createDebugRenderStyle(renderer, scene, camera, { id, label, invalidate })`。`id` 应稳定且独立；按需渲染场景通过 `invalidate` 请求新帧，持续渲染场景可省略。通过返回对象的 `setStyle` 设置内容默认风格，并接入 `render`、`resize` 和 `dispose`。渲染集成位于 `packages/scene-runtime/src/render-style.ts`，材质适配位于 `toon-surfaces.ts`。

## 开源实现与材质

2026-09-23 查询 GitHub：

| 项目 | Star | 许可证 | 用途 |
| --- | ---: | --- | --- |
| [Three.js](https://github.com/mrdoob/three.js) | 115,790 | MIT | 已采用官方 `MeshToonMaterial` 和 gradient map 配置 |
| [pmndrs/postprocessing](https://github.com/pmndrs/postprocessing) | 2,862 | Zlib | 已采用 `OutlineEffect`、`ToneMappingEffect` 和 composer；6.39.5 支持项目使用的 Three.js 0.170 |
| [pmndrs/drei](https://github.com/pmndrs/drei) | 9,886 | MIT | React Three Fiber 辅助库，当前原生 Three.js 场景无需增加 R3F 依赖 |
| [THREE-CustomShaderMaterial](https://github.com/FarazzShaikh/THREE-CustomShaderMaterial) | 1,337 | MIT | 适合扩展自定义 GLSL；本次直接使用成熟材质，因此未引入 |

旧的屏幕颜色量化与颜色差描边 Shader 已移除。墨线卡通采用较少光照层次和细棕色几何轮廓；柔和卡通增加光照层次、减轻轮廓。描边来自模型遮罩，不把木纹识别为边线。后处理使用半浮点缓冲和一次色调映射，保留透明背景。

木鱼卡通模式按“插画玩具”方向设置涂装底色，停用密集的木纹 albedo 和微法线，降低 AO 强度。通过 `mesh.userData.toonSurface = { color, simplifyMap: true, aoIntensity }` 指定场景美术参数。原贴图和 GLB 不做永久修改；每帧结束恢复原材质，切回原始光照或效果失败时即可恢复原 PBR 表现。透明水面、接触阴影和粒子保留各自材质。材质缓存、轮廓选择和 GPU 资源随风格切换及场景卸载释放。

浏览器回归：启动 Vite 后运行 `python scripts/test-debug-overlay.py` 和 `python scripts/test-woodfish-style.py`。默认测试地址是 `http://127.0.0.1:5176/`，可通过 `WBR_URL` 修改。
