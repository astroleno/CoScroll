**IceMaterial 那套（ice.frag + IceMaterial.js）已经具备做“麻薯质感”的核心要素：它把透光散射（translucency / thickness）**叠加进了标准光照回路，按点光 / 面光逐灯累积到 reflectedLight.directDiffuse 上，并提供了可调的 thicknessPower/Scale/Distortion/Ambient 与 thicknessMap、thicknessRepeat 等统一变量，这正是软糯体“体积感”的来源。 ￼

⸻

结论（能不能做成“麻薯”）
	•	IceMaterial 这套可以，但需要三处增强：
	1.	把“透光”做得更软（调薄厚参数、衰减形状）；
	2.	边缘“糯化”（Fresnel→Alpha 的宽过渡，而不是单纯加亮）；
	3.	微模糊/抖动（解决硬边与色带，营造细腻磨砂）。

⸻

直接可落地的修改清单（以 IceMaterial 为底）

1) 让透光散射更像“糯米体”

把 thickness 的影响调软、调宽（现在 thicknessPower=20 太“刺”）：
	•	thicknessPower：2–6（越小越软）
	•	thicknessScale：0.8–1.6（控制强度）
	•	thicknessDistortion：0.05–0.12（轻微扰动即可，避免“塑料流痕”）
	•	thicknessAmbient：0.08–0.22（给内部一个柔和底光）

这些都是 IceMaterial 暴露的 uniforms，可直接在初始化或 GUI 中调。 ￼

并且在 #ifdef USE_TRANSLUCENCY 的回路里，对 LT 做一次能量约束，避免叠加过曝：

LT = min(LT, vec3(1.0));              // 简单夹值
// 或者按 roughness 做自适应软化
LT *= mix(0.6, 1.0, 1.0 - roughness); // 麻薯一般 roughness 高

材质参数建议：roughness ≈ 0.85–0.95, metalness=0，不要强高光。

2) 用 Fresnel 驱动“边缘更透”，而不是“边缘更亮”

在 fragment 末尾，合成前加一个面向相机的宽边缘透明（不改变能量，只改变可见度）：

vec3  N = normalize(geometry.normal);
vec3  V = normalize(geometry.viewDir);
float fres = 1.0 - max(dot(N, V), 0.0);

// 宽过渡 + 自适应抗锯齿
float rim = smoothstep(0.08, 0.80, fres + fwidth(fres)*1.5);

// 让边缘“更透”而不是“更亮”
float alphaEdge = 0.30;    // 可做 uniform
float alphaCore = opacity; // 取 diffuseColor.a 或你的不透明度
float alpha = mix(alphaCore, alphaEdge, rim);

// 最终输出
gl_FragColor = vec4(outgoingLight, alpha);

这样边缘会“溶进”背景，呈现麻薯皮的半透明渐弱，而不是一圈发白的高光。

3) 加细腻的“磨砂颗粒”

在计算 alpha 或 LT 时乘以极轻微噪点做抖动，打散色带：

float n = hash21(vUv * 512.0);        // 任意小噪声函数
alpha *= (0.98 + 0.02 * n);           // 2% 抖动即可

同时把后处理 / 渲染目标改为半精度或浮点，避免 8-bit banding（后期/目标缓冲 HalfFloatType）。

4) 软化“透光的模糊感”

如果只用一遍前向着色，很难真的模糊。两种“轻量可行”的做法：
	•	屏幕空间微模糊：将“透光项”（你代码里的 LT）输出到一个小的 renderTarget，做半径 2–3 的 Gaussian，再混回主帧的 outgoingLight。开销小，效果明显。
	•	法线偏移采样（单通道近似）：对 thicknessMap 进行 3×3 的法线方向抖动采样（或以 N/V 方向偏移）并求均值，形成“内部糊开”的错觉。

5) 背景与 Bloom
	•	背景不要纯白，给很淡的 pastel 渐变（饱和 3–6%），透明边才能“读”出来。
	•	Bloom 只做“丝状溢光”，阈值 0.62–0.70，强度 0.5–0.8，半径 0.6–0.9，避免把细腻层次洗白。

⸻

IceMaterial（ice.vert/ice.frag + IceMaterial.js）最合适用来做“麻薯/糯米”质感。它自带的 Translucency / Thickness 通道正好对准麻薯的本质：光在内部被散射后再出射（软、糯、微朦胧）。其它几套若没有体积散射，只会更像“半透明塑料”。

下面给一份最小落地的调参与管线清单，把它直接推到麻薯感：

必调参数（首选区间）
	•	roughness: 0.88–0.96，metalness: 0
	•	thicknessPower: 2–6（越小越“软”）
	•	thicknessScale: 0.8–1.6（散射强度）
	•	thicknessDistortion: 0.05–0.12（轻微扰动，别太大）
	•	thicknessAmbient: 0.08–0.22（内部柔光底色）
	•	opacity: 0.9–1.0（整体不靠透明度取巧）

边缘“糯化”（关键补充）

在片元里用 Fresnel 驱动透明，而不是增亮：

vec3 N = normalize(geometry.normal);
vec3 V = normalize(geometry.viewDir);
float fres = 1.0 - max(dot(N, V), 0.0);
float rim  = smoothstep(0.08, 0.80, fres + fwidth(fres)*1.5);
float alpha = mix(opacity, 0.30, rim);       // 边缘更透
gl_FragColor = vec4(outgoingLight, alpha);   // outgoingLight 即你现有累积光

这样边缘会“溶进”背景，呈现麻薯皮的半透明渐弱。

抗色带与“磨砂粉感”
	•	在 alpha 或散射项上乘极轻微噪点：±2% 抖动即可，打散色带。
	•	渲染目标用半精度/浮点（HalfFloatType），Bloom 之后再编码，避免 8-bit banding。

后期与背景
	•	Bloom：threshold 0.62–0.70，strength 0.5–0.8，radius 0.6–0.9（防洗白）。
	•	背景不要纯白，加极浅的 pastel 渐变（饱和 3–6%），透明边才“读得出来”。

外壳（可选强化“糯皮”）
	•	只加 一层薄壳 即可：壳步长≈包围球半径的 0.5%–1%；depthWrite=false，NormalBlending，renderOrder 在内核之后。
	•	壳的“厚感”靠上面的 Fresnel 透明 + Bloom 表现，不靠几何加厚。

什么时候考虑换路子
	•	需要“真实的环境折射/厚度模糊”且受限于 forward 管线时，可在 IceMaterial 的散射项上做屏幕空间小半径模糊（只模糊散射项），成本低、观感提升大。
	•	其它 shader 若不加体积散射/背光项，再怎么调也更像塑料——除非你把 IceMaterial 的 translucency 片段移植过去。

结论：**优先用 IceMaterial，并按上面四件事补齐：厚度散射调软、Fresnel→Alpha 糯化、微噪点、温和 Bloom + 渐变背景。**这样就能稳定得到“磨砂麻薯”的体积与边缘质感。