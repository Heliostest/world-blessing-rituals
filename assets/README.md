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
