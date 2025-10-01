可行，而且思路对路。把它落到 three.js 上，按下面这套“最小改动→增强”的顺序做，基本就能同时解决自重叠发白/穿插与磨砂麻薯质感不足两类问题。

⸻

A. 先解决“自身重叠发白/穿插”

1) 深度预通道（最稳妥）

先用同一几何渲染一遍 depth-only，写入深度；再渲染冰麻材质时不开深度写入，只做深度测试，这样自遮挡就不会反复叠加。

// 预通道材质：只写深度
const depthMat = new THREE.MeshBasicMaterial({
  colorWrite: false,      // 不写颜色
});
depthMat.depthWrite = true;
depthMat.depthTest  = true;

const prepass = new THREE.Mesh(geom, depthMat);
prepass.renderOrder = 0;

// 正式通道：你的 IceMaterial（或改造版）
const ice = new IceMaterial(params);
ice.transparent = true;
ice.depthWrite  = false;  // 关键：不再写深度
ice.depthTest   = true;
ice.blending    = THREE.NormalBlending;
const mesh = new THREE.Mesh(geom, ice);
mesh.renderOrder = 1;

// 渲染顺序：先 prepass，再 ice
scene.add(prepass, mesh);

如果想更严格，可把 ice 的深度测试设为 LessEqual（默认就是），或在 WebGL2 管线里用 renderer.state.setDepthFunc(LEQUAL)。

2) 抖动弃片（Alpha→AlphaTest 的近似 OIT）

WebGL 没有 Alpha-to-Coverage，可以用蓝噪点将 alpha 转成“抖动丢弃”，让深度可写、无需排序（近看有细微点阵，移动/旋转时很干净）。

片元里：

// a = 你最终的透明度
float a = finalAlpha;
float n = blueNoise(gl_FragCoord.xy); // 0..1 的蓝噪
if (a < n) discard;                   // 抖动弃片
gl_FragColor.a = 1.0;                 // 既然写深度，输出全不透明

同时把材质切回 transparent=false, depthWrite=true。
此法与预通道二选一；做产品时优先预通道，更细腻。

⸻

B. 把“磨砂麻薯”补齐（在 IceMaterial 基础上）

你的 IceMaterial 已有 厚度透光（translucency/thickness），再补三件小事：更软的散射、边缘糯化、细微颗粒/小模糊。

1) 厚度散射调软

把默认很“刺”的参数改软一些（可做 GUI）：

ice.uniforms.thicknessPower.value     = 3.5;   // 2~6
ice.uniforms.thicknessScale.value     = 1.2;   // 0.8~1.6
ice.uniforms.thicknessDistortion.value= 0.08;  // 0.05~0.12
ice.uniforms.thicknessAmbient.value   = 0.15;  // 0.08~0.22
ice.roughness = 0.9;  // 0.88~0.96
ice.metalness = 0.0;

2) “边缘更透而不是更亮”（Fresnel→Alpha 宽边）

在 ice.frag 末尾（gl_FragColor 输出前）加入：

vec3 N = normalize(geometry.normal);
vec3 V = normalize(geometry.viewDir);
float fres = 1.0 - max(dot(N, V), 0.0);

// 自适应软化，避免硬边/闪烁
float rim = smoothstep(0.08, 0.80, fres + fwidth(fres)*1.5);

// 核心：用 rim 改“透明”，不去加亮
float alphaCore = diffuseColor.a;     // 例如 1.0
float alphaEdge = 0.30;               // 边缘目标透明度（可做 uniform）
float alpha = mix(alphaCore, alphaEdge, rim);

gl_FragColor = vec4(outgoingLight, alpha);

效果：边缘“溶进背景”，有糯皮的半透明渐弱。

3) 细微磨砂颗粒 + 抗色带

给 alpha 或散射项乘极轻噪点（1–2%），并使用高位深渲染目标。

// 极轻噪点
float dn = hash21(gl_FragCoord.xy * 0.5); // 或蓝噪贴图
alpha *= (0.99 + 0.01 * dn);              // 1% 抖动即可

// 后处理/离屏目标尽量用半浮点，避免 8-bit 色带
const rt = new THREE.WebGLRenderTarget(w, h, {
  type: THREE.HalfFloatType,
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
});

4) SSS“小半径模糊”（只模糊透光项，成本低）

若你能把“透光散射”那一项单独输出到一个 RT（例如在 #ifdef USE_TRANSLUCENCY 分支累计的 LT），再做半径 2–3 的高斯或 Kawase 模糊，回贴到主帧，可显著提升“糯糊感”。

伪流程：

Pass A: 主体常规 + 记录散射(LT)到 scatterRT
Pass B: 模糊 scatterRT → scatterBlurRT（半分辨率即可）
Pass C: 合成  outgoingLight += texture(scatterBlurRT)

若不拆 Pass，也可在片元里对 thicknessMap 做 3×3 小核均值（沿法线/切线方向微偏移采样）来“糊开”。

⸻

C. 背景 & Bloom 的配合
	•	背景不要纯白，给极浅 pastel 渐变（饱和 3–6%），边缘透明才“读得出来”。
	•	Bloom 仅做轻微溢光，避免洗白：
threshold 0.62~0.70, strength 0.5~0.8, radius 0.6~0.9。

⸻

D. 参数建议（起步一套就接近成品）
	•	roughness 0.92, metalness 0
	•	thicknessPower 3.5, thicknessScale 1.2, thicknessDistortion 0.08, thicknessAmbient 0.15
	•	Fresnel→Alpha：alphaEdge 0.30
	•	预通道启用；Bloom 轻量；HalfFloat RT；1% dither

⸻

一句话

你的方案完全可行：
	•	预通道解决自重叠；
	•	IceMaterial + 厚度软化 + Fresnel→Alpha提供“体积+糯皮”；
	•	细噪 + 小半径 SSS 模糊把“磨砂”补齐。

按上面的顺序落地，你会从“半透明蜡/胶”直接跨到“磨砂麻薯”。