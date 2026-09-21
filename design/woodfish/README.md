# Blender 木鱼 · UV 与一致材质

2026-09-21，使用本机 Blender 5.2.1 LTS 制作。Codex 当前工具列表尚未刷新出 Blender MCP，因此通过已安装插件的本地命令桥接（127.0.0.1:9876）发送 `execute_code`。没有调用第三方模型资产服务。

## 文件

- `woodfish.blend`：可继续编辑的模型、UV、材质节点、相机和三盏柔光灯。
- `woodfishbody-uv.png` / `mallet-uv.png`：Blender 正式导出的 2048px UV 布局。
- `uv-generated-candidate.png`：内置 image_gen 图生图原始输出，1254px；当前已采用为木鱼基色，不是三维渲染截图。
- `../../assets/woodfish/blender-v2/`：烘焙的颜色、法线、粗糙度、AO 和最终 `woodfish.glb`。运行时只读取 GLB；独立 PNG 用于继续制作。

## 制作与验证

1. Blender 中制作连成一体的外壳，布尔雕出共鸣孔、斜缝与内腔；圆角嘴部、单独木槌。外壳 88,060 三角面，木槌 5,756，共 93,816，均为封闭流形。
2. 展开并打包 UV，边缘留间距；把连续物体坐标木纹先烘焙到 UV。保留同一三角划分，导出切线，避免烘焙法线与 glTF 切线基准不一致。
3. 把烘焙基色和 UV 布局交给 image_gen，限定只细化木纹与色调，不改变岛的位置和边界。原始工具文件：`exec-eebf21a8-a06a-4c27-acce-b707351dcdb5.png`；工具未披露底层模型名称。
4. 检查实际 UV 覆盖范围：2,188,089 个参考像素。归一化至相同尺寸后，AI 图没有引入新的黑色覆盖缺口。这只验证覆盖，不能宣称生成器逐像素保持了所有纤维；回贴后的前后、侧面、顶底均另做视觉检查。
5. 采用生成基色后，在 Blender 从这同一来源制作克制的微表面高度与 0.43–0.56 粗糙度，再烘焙切线法线和粗糙度；AO 从真实腔体几何烘焙。木槌保留连续木纹并匹配色调。AO 单件隔离烘焙，防止导出原点处重叠的木槌在木鱼底部留下永久暗斑；物体间阴影只由运行时计算。
6. 导出标准 glTF PBR，AO/粗糙度打包共用纹理，基色 sRGB、数据贴图线性。GLB 内嵌全部贴图，无网络资源。网页不再使用之前的三向投射和自定义法线混合。

微表面高度是受控的艺术近似，不是由颜色恢复出的实测木材高度；粗糙度也不是物理扫描。法线、粗糙度没有分别交给生图模型随机生成。轮廓、切口和内腔的深度由几何负责。

## 重现

在独立 Blender 会话运行 `scripts/blender/start_bridge.py`，然后在项目根目录执行：

```powershell
python scripts/blender/bridge.py scripts/blender/build_woodfish.py
python scripts/blender/bridge.py scripts/blender/finish_woodfish.py
node scripts/check-woodfish-glb.mjs
```

第一步保留既有 `generated-v1/color.png` 作为连续木纹来源；第二步使用本目录已经保存的 UV 图生图结果，不会再次调用付费或外部生成服务。仅在指定的独立工程里运行，脚本拒绝替换无关的已打开 Blender 文档。

## 图生图提示词（内置工具）

输入 1：`assets/woodfish/blender-v2/body-color.png`；输入 2：`design/woodfish/woodfishbody-uv.png`。

> Edit the FIRST image, a production UV albedo texture atlas for a wooden temple fish instrument. The second image is its exact UV layout, a structural reference only, DO NOT draw its grid. Critical: retain EXACT positions, shapes, scale, silhouettes and grain directions of EVERY existing wood-colored island. All black background pixels stay black. Do not move, merge, resize, rotate, add, remove, reframe any island. Preserve every original fiber's placement and continuous direction. ONLY refine surface appearance into finely sanded natural warm medium brown camphor wood, subtle pores, restrained fine fibers and gentle honey undertones, slightly richer and warmer than input. No lighting, highlights, shadows, AO, gloss, gradients, seams, grid lines, text. Uniform unlit albedo only. Output square image matching original layout edge to edge. This is a precision texture edit, not an illustration or a new UV layout.

## 运行时边界

anime.js 跟随、触屏松手停止、受接触约束的刚体摆动、接触音效、计数存档与回退逻辑延续原流程。主光和补光都计算遮挡，避免照穿壳体；静止时仍只按需绘制。移动端真实设备的帧率、触觉和离线 WebView 生命周期尚需真机验收。
