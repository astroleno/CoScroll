是的，边缘的“半透明”现在不够明显。主要有三类原因：
	1.	透明链路没真正生效（深度、混合方式、顺序）。
	2.	边缘函数太窄或被 Bloom/ToneMapping 洗白。
	3.	背景过白，对比不足。

下面按“最小改动→增强效果”给出具体做法。

1. 让透明真正生效（three.js 设置）
	•	对外壳层：
	•	material.transparent = true
	•	material.depthWrite = false（重要，否则先写深度会挡住后面的光晕）
	•	material.depthTest = true（保留遮挡关系）
	•	material.blending = THREE.AdditiveBlending 或自定义混合（更柔）：

material.blending = THREE.CustomBlending;
material.blendEquation = THREE.AddEquation;
material.blendSrc = THREE.SrcAlphaFactor;
material.blendDst = THREE.OneMinusSrcAlphaFactor;
renderer.getContext().blendFuncSeparate(
  gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA
);


	•	渲染顺序：内核在前，外壳在后
inner.renderOrder = 0; shell.renderOrder = 1;
	•	画布：若要更干净的边缘合成，renderer.premultipliedAlpha = true。

2. 放宽并“提亮”边缘函数

外壳片元里用 Fresnel 驱动 alpha，并加宽过渡区：

// N, V 已单位化
float f = 1.0 - max(dot(N, V), 0.0);       // 0..1
// 使用 fwidth 做自适应软化，避免锯齿/过窄
float rim = smoothstep(0.15, 0.75, f + fwidth(f)*1.5);
// Gamma/幂次微调边缘形状
rim = pow(rim, 0.8);
// 半透明与自发光分开控制
float alpha = 0.25 * rim;                   // 透明度（决定“看穿度”）
vec3  glow  = rim * vec3(0.9,0.95,1.0) * 0.6; // 颜色（决定“亮度/溢光”）

要“更透”，提升 alpha（0.25→0.35），同时适当降低 glow，避免 Bloom 把透明边洗白。

3. 加“深度衰减”来显式拉出半透明

让边缘随场景深度/自身厚度淡出（对着白底尤其有效）：

// 若已有 depthTexture，可做真实深度淡出；没有的话用近似：
float nv  = 1.0 - max(dot(N,V),0.0);
float fade = smoothstep(0.0, 0.7, nv);   // 视角越掠，越透明
alpha *= fade;

或（有 depthTexture 时）：

float sceneZ = linearizeDepth(texture2D(uDepthTex, vUv).r);
float fragZ  = linearizeDepth(gl_FragCoord.z);
float dfade  = smoothstep(0.0, 0.02, sceneZ - fragZ); // 贴近其他表面更透明
alpha *= dfade;

4. 两层壳更明显（薄亮外壳 + 稍厚内壳）
	•	壳1（外层）：alpha≈0.35、AdditiveBlending、颜色偏冷（青/蓝），thicknessOffset≈+1.5%半径
	•	壳2（内层）：alpha≈0.18、颜色更暖（粉/橙），thicknessOffset≈+0.7%半径
	•	顶点膨胀：

pos += normal * shellStep; // shellStep 不同层不同



5. 别让 Bloom“抹掉”透明
	•	UnrealBloomPass: 适度降低 strength（如 0.8→0.6），提高 threshold（0.55→0.65），保留透明层的亮度梯度。
	•	Tone mapping 保持 ACES，但略降曝光；否则边缘被压平。

6. 给它对比的背景

纯白背景会“吃掉”半透明层。加一层极浅的 pastel 渐变（例如左上淡黄、右下淡蓝，饱和度 5%），立刻让半透明边更可见。

7. 快速排错清单
	•	看到边缘“只是亮，不透”：大概率是 depthWrite=true 或 Additive + Bloom 过强。
	•	边缘仍然“硬”：放宽 smoothstep 的阈值（如 0.15,0.75），并加入 fwidth。
	•	透明排序错位：设置 renderOrder，并保证外壳 depthWrite=false。

按上面调一轮：放宽 rim、提高 alpha、关掉外壳的 depthWrite、适度减 Bloom，再加一层极浅背景渐变。半透明边会立刻变“可读”，而且更像你要的麻薯壳。