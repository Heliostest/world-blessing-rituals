# 内置生图工具材质试版 · 2026-09-21

用户授权「用其他的生图方法看看」后，通过内置 `image_gen.imagegen` 生成；**模型名称未由工具返回，不能标为 GPT Image 2.5**。三张 PNG 原样复制至此，尺寸均为工具实际返回的 1254 × 1254 RGB（提示词请求 1024，实际未遵从）。无手工或脚本修图。原版程序化材质在上一层保留。

- color.png：先生成温润浅棕木纹基色。
- normal.png：以 color.png 为编辑输入，要求保持纹理位置，输出 OpenGL +Y 法线。
- roughness.png：同样以 color.png 为编辑输入，输出粗糙度。

工具原始文件 ID 分别为 exec-732b421d-b7da-44eb-939e-e615522b9906、exec-2e9c7e1c-3027-452c-a720-4b3ffbe0ed9f、exec-82b1562c-683a-4179-a32b-bb18079249ff。三个 PNG 合计 6,228,250 字节。

## 检查与实际使用

颜色均值 RGB 180.93 / 118.68 / 65.83；法线均值 126.62 / 130.20 / 252.29，解码后向量长度均值约 0.99；粗糙度均值约 0.588，偏离请求的 0.70。材质将粗糙度数据映射到 0.62–0.82（均值约 0.738），法线保持克制的 0.24 强度。

基色与粗糙度的灰度相关系数约 0.84，说明大体纹路相符，但这不是物理扫描，也无法保证三个生成结果逐像素严格对应。法线只是视觉近似；不要将它宣称为精确高度场推导结果。

边缘差异检查不支持“完美无缝”断言：基色左右边平均差约 6.42/255，上下约 9.64/255，相邻行约 7.23/255。当前模型使用同一物体坐标 `position * 0.36 + 0.52` 三向投射；所有采样落在图像内部，避免跨越生成图的周期边界。顶部、侧面、背面、底面和切口共享同一组坐标与权重，不使用正面照片覆盖球体。投射混合处仍有细微方向变化。

已查看实际 Three.js 的六角度渲染，并验证加载三张本地资源、PBR 反光、孔口深度。生成版 GPU 纹理内存约 24 MiB（含 mipmaps），高于原程序化版本，物理手机性能尚待验收。运行时不访问外链。

## 原始提示词

### 基色

Use case: photorealistic-natural. Asset type: a production PBR BASE COLOR / ALBEDO texture for the complete surface of a warm wooden temple fish instrument in a Three.js app. Generate ONE square 1024x1024 image filled edge to edge ONLY with fine natural wood grain, mostly horizontal, organically varied elongated interlocking fibers, subtle small pores and understated irregular annual grain. Color: warm medium-light honey brown / natural camphor wood, approximately #AD7C50, restrained saturation, smooth sanded satin wood. Material texture only, not an object render or illustration. Orthographic flat scan. Perfectly uniform unlit base color: NO highlights, shading, cast shadows, ambient occlusion, gradients or vignette. Seamless and tileable on BOTH axes; matching opposite edges. Fine realistic grain, not thick ripples, carved ridges, stripes, knots, plank seams, rings, holes or grooves. No wooden fish silhouette, mallet, perspective, background, UI, text, frame or watermark. This will wrap a rounded 3D mesh using triplanar projection and be paired with subtle normal and roughness maps, so all lighting must come from the real-time renderer.

### 法线（以上述基色为编辑输入）

Edit the provided wood albedo into its corresponding production PBR tangent-space NORMAL MAP. Preserve the exact image dimensions, crop, orientation and exact pixel locations of every grain fiber and pore. Do not invent or move any grain. OpenGL +Y convention, neutral flat areas RGB(128,128,255). Very subtle sanded wood microsurface, restrained shallow fiber relief only, mostly neutral lavender blue with tiny cyan/pink gradient variations. Fine pores slightly recessed, no deep grooves or thick ridges. This is a data texture, not a blue-colored wood photograph: completely remove all brown/albedo information and brightness shading, encode normalized surface direction only. Preserve matching tileable opposing edges. One full-frame normal-map image only, no labels, grids, objects or backgrounds.

### 粗糙度（以上述基色为编辑输入）

Edit the provided wood base-color texture into its exactly corresponding PBR ROUGHNESS data map. Preserve exact dimensions, crop, scale, and every grain fiber and pore position; no new or shifted grain. Output neutral GRAYSCALE ONLY (R=G=B), edge-to-edge single texture. Physical roughness of finely sanded satin camphor wood: average 0.70 (approximately RGB 179,179,179), subtle variation mostly 0.62–0.79. Fine recessed pores a little rougher/lighter, dense smooth fibers slightly less rough/darker. No black or white extremes, no high contrast, no illumination, directional shading, shadows, highlights, vignette or gradients. Maintain seamless matching opposing edges. This is material data for a real-time wooden fish mesh, not a grayscale photograph, not a gloss map; white means rough. No objects, text, labels, border, legend.
