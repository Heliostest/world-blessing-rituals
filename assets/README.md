# 本地视觉素材

`reference-ui/wishes.png` 与 `reference-ui/rituals.png` 是用户于 2026-09-20 提供的两张 1536 × 1024 UI 参考图的原样副本。`packages/app/src/art.tsx` 用坐标裁切显示木鱼、纸鹤、心愿灯与纪念章，CSS 柔化边缘并与奶油背景混合；没有重绘原图，也不是透明背景的独立抠图。后续可替换为同风格的高清透明素材。界面文字、表单、按钮和导航均为可交互组件，不是整屏图片。

`fonts/noto-sans-sc.woff2` 为 Noto Sans SC 可变字体的本地子集，保留拉丁、基础汉字、中文标点和全角字符，支持 100–900 字重。字体用于接近参考图的粗黑中文层级；无法从参考图确定其原始字体，不能视为完全一致。来源为 Google Fonts 官方仓库：

- https://github.com/google/fonts/tree/main/ofl/notosanssc
- 上游文件 `NotoSansSC[wght].ttf`；授权见同目录 `fonts/OFL.txt`（SIL Open Font License 1.1）。

生成子集使用 fontTools + Brotli：

```powershell
python -m fontTools.subset NotoSansSC.ttf --output-file=noto-sans-sc.woff2 --flavor=woff2 --unicodes="U+0000-00FF,U+2000-206F,U+3000-303F,U+4E00-9FFF,U+FF00-FFEF" --layout-features="*" --name-IDs="*" --name-legacy --name-languages="*"
```

Vite 使用此目录作为 publicDir；Expo 启动/构建前由 `scripts/prepare-app-assets.mjs` 复制所需文件到其 public 目录，`EXPO_BASE_URL` 解析嵌入资源位置。所有图片与字体在运行时无需外部网络。`npm run mobile:verify` 校验两端导出资源与源文件的长度和 SHA-256。

## 当前 Blender 木鱼（2026-09-21）

运行时读取 `woodfish/blender-v2/woodfish.glb`，两个独立网格、真实 UV 与切线、内嵌颜色/法线/打包粗糙度和 AO，约 6.90 MiB、93,816 三角面。Blender 5.2.1 中建模、展开 UV，内置 image_gen 参考 UV 布局细化基色，再从同一来源在 Blender 烘焙对应法线和粗糙度。`.blend`、UV 图、生成原图和制作过程见 `design/woodfish/README.md`。GLB 纳入 Expo 复制及 SHA-256 完整性检查，`node scripts/check-woodfish-glb.mjs` 检查实际导出网格的封闭性、绕序、UV、切线、材质与离线资源。

## 旧版木鱼资产（保留，不再用于仪式页运行时）

`woodfish/body.bin` 为依照 `reference-ui/rituals.png` 轮廓制作的闭合木壳网格，含内腔、斜向开缝、圆形共鸣孔和鱼嘴。37,854 顶点 / 75,704 三角面。文件头为两个 little-endian uint32（顶点数、索引数），依次跟随 float32 positions、float32 normals、uint32 indices。木槌由 Three.js 基础几何组合。

`woodfish/color.png`、`normal.png`、`roughness.png` 保留为 **程序化原版 PBR 材质，不是 GPT Image 2.5 生成**。第一轮因无法指定/核实该模型而使用程序化材质。随后用户授权尝试其他生图方法，当时场景曾切到 `woodfish/generated-v1/` 中内置 image_gen 工具生成的三张贴图。具体模型未披露，原始输出、提示词和局限见该目录 README。

三张图均为 512 × 512 RGB、周期木纹，同一个高度场导出颜色、OpenGL (+Y) 法线和粗糙度。颜色图无烘焙光照/投影；颜色采用 sRGB，数据贴图保持线性。通过同一组物体空间三向投射和权重覆盖正面、背面、顶部、底部、开口边缘及内腔。避免球体 UV 极点和裸露背面；交叉投射的过渡仍属于临时材质的视觉局限。内腔遮蔽由几何位置计算，不写入颜色贴图。

用 `node scripts/generate-woodfish.mjs` 重建模型与程序化原版，不覆盖生成图；`node scripts/check-woodfish-assets.mjs` 检查闭合性、绕序、法线和两套贴图尺寸。该旧版加载生成版（1254px × 3，PNG 合计 6.23 MB，含 mipmaps 约 24 MiB GPU 内存），模型与生成贴图纳入 Expo 复制和 SHA-256 完整性检查；原始 UI 参考图保留原样。

未来指定模型可用时的材质指令：以参考原图的温润浅棕木质为色彩和木种参考，生成可平铺的纯木材基色贴图，正交平面、均匀无方向照明、细长自然纤维，不画木鱼物体、孔洞、边缘、环境、投影、强高光、文字。法线图需严格对应同一基色纤维，切线空间 OpenGL +Y，克制微表面起伏；粗糙度图也需严格对应同一纤维，灰度、无方向光照、主体约 0.65–0.8。必须逐张检查对齐与周期边缘，并在当前 PBR 场景验证，不能把三次独立随机生成的纹理当作对应贴图。
