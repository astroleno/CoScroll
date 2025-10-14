Program.js:82 ERROR: 0:22: 'return' : function return is not matching type:

Fragment Shader
1: #version 300 es
2: precision highp float;
3: 
4: out vec4 fragColor;
5: 
6: uniform float uTime;
7: uniform vec2 uResolution;
8: uniform vec3 uColorA;
9: uniform vec3 uColorB;
10: uniform vec3 uColorAccent;
11: uniform float uSpeed;
12: uniform float uNoiseScale;
13: uniform float uWaveAmp;
14: uniform float uExposure;
15: uniform float uGamma;
16: uniform float uGrainAmount;
17: uniform float uGrainScale;
18: 
19: // 简单 hash 噪声
20: float hash(vec2 p){
21:   p = vec2(dot(p, vec2(127.1,311.7)), dot(p, vec2(269.5,183.3)));
22:   return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
23: }
24: 
25: // 二维 value 噪声
26: float noise(vec2 p){
27:   vec2 i = floor(p);
28:   vec2 f = fract(p);
29:   float a = hash(i);
30:   float b = hash(i + vec2(1.0, 0.0));
31:   float c = hash(i + vec2(0.0, 1.0));
32:   float d = hash(i + vec2(1.0, 1.0));
33:   vec2 u = f*f*(3.0-2.0*f);
34:   return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
35: }
36: 
37: // 两层简化 fbm，偏向横向流动
38: float fbm(vec2 p){
39:   float v = 0.0;
40:   float a = 0.65;
41:   v += a * noise(p);
42:   p *= 2.02; a *= 0.5; v += a * noise(p);
43:   return v;
44: }
45: 
46: vec3 tonemap(vec3 c, float exposure){
47:   c *= exposure; // 简单 reinhard
48:   return c / (1.0 + c);
49: }
50: 
51: void main(){
52:   vec2 uv = gl_FragCoord.xy / max(uResolution, vec2(1.0));
53:   vec2 st = uv * 2.0 - 1.0;
54: 
55:   // 丝绸流动：对 uv 施加随时间的弯曲位移
56:   float t = uTime * uSpeed;
57:   float n1 = fbm(uv * uNoiseScale + vec2(0.10 * t, 0.0));
58:   float n2 = fbm(uv.yx * (uNoiseScale*0.7) + vec2(-0.08 * t, 0.05 * t));
59:   float curve = (n1 * 0.8 + n2 * 0.2);
60:   vec2 flowUV = uv + uWaveAmp * 0.08 * vec2(curve, -curve);
61: 
62:   // 左右渐变取色
63:   vec3 grad = mix(uColorA, uColorB, smoothstep(0.0, 1.0, flowUV.x));
64: 
65:   // 强调色按噪声权重轻混合，形成丝绸高光/阴影过渡
66:   float highlight = smoothstep(0.4, 0.9, curve);
67:   vec3 col = mix(grad, uColorAccent, 0.25 * highlight);
68: 
69:   // 轻微纵向遮罩，增强丝绸中心带
70:   float band = 0.85 + 0.15 * (1.0 - abs(st.y));
71:   col *= band;
72: 
73:   // tonemap + gamma
74:   col = tonemap(max(col, vec3(0.0)), uExposure);
75:   col = pow(max(col, vec3(0.0)), vec3(1.0 / max(0.0001, uGamma)));
76: 
77:   // film grain（按像素坐标与时间扰动）
78:   float grain = noise(gl_FragCoord.xy / max(1.0, uGrainScale) + vec2(23.17, 91.7) + t * 0.3);
79:   col += (grain * 2.0 - 1.0) * (0.08 * uGrainAmount);
80: 
81:   // 边缘细微羽化避免硬边
82:   float edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
83:   float edgeFeather = smoothstep(0.0, 0.06, edge);
84:   col *= mix(0.97, 1.0, edgeFeather);
85: 
86:   fragColor = vec4(col, 1.0);
87: }
Program.js:89 Fragment shader is not compiled.

Program.js:82 ERROR: 0:22: 'return' : function return is not matching type:

Fragment Shader
1: #version 300 es
2: precision highp float;
3: 
4: out vec4 fragColor;
5: 
6: uniform float uTime;
7: uniform vec2 uResolution;
8: uniform vec3 uColorA;
9: uniform vec3 uColorB;
10: uniform vec3 uColorAccent;
11: uniform float uSpeed;
12: uniform float uNoiseScale;
13: uniform float uWaveAmp;
14: uniform float uExposure;
15: uniform float uGamma;
16: uniform float uGrainAmount;
17: uniform float uGrainScale;
18: 
19: // 简单 hash 噪声
20: float hash(vec2 p){
21:   p = vec2(dot(p, vec2(127.1,311.7)), dot(p, vec2(269.5,183.3)));
22:   return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
23: }
24: 
25: // 二维 value 噪声
26: float noise(vec2 p){
27:   vec2 i = floor(p);
28:   vec2 f = fract(p);
29:   float a = hash(i);
30:   float b = hash(i + vec2(1.0, 0.0));
31:   float c = hash(i + vec2(0.0, 1.0));
32:   float d = hash(i + vec2(1.0, 1.0));
33:   vec2 u = f*f*(3.0-2.0*f);
34:   return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
35: }
36: 
37: // 两层简化 fbm，偏向横向流动
38: float fbm(vec2 p){
39:   float v = 0.0;
40:   float a = 0.65;
41:   v += a * noise(p);
42:   p *= 2.02; a *= 0.5; v += a * noise(p);
43:   return v;
44: }
45: 
46: vec3 tonemap(vec3 c, float exposure){
47:   c *= exposure; // 简单 reinhard
48:   return c / (1.0 + c);
49: }
50: 
51: void main(){
52:   vec2 uv = gl_FragCoord.xy / max(uResolution, vec2(1.0));
53:   vec2 st = uv * 2.0 - 1.0;
54: 
55:   // 丝绸流动：对 uv 施加随时间的弯曲位移
56:   float t = uTime * uSpeed;
57:   float n1 = fbm(uv * uNoiseScale + vec2(0.10 * t, 0.0));
58:   float n2 = fbm(uv.yx * (uNoiseScale*0.7) + vec2(-0.08 * t, 0.05 * t));
59:   float curve = (n1 * 0.8 + n2 * 0.2);
60:   vec2 flowUV = uv + uWaveAmp * 0.08 * vec2(curve, -curve);
61: 
62:   // 左右渐变取色
63:   vec3 grad = mix(uColorA, uColorB, smoothstep(0.0, 1.0, flowUV.x));
64: 
65:   // 强调色按噪声权重轻混合，形成丝绸高光/阴影过渡
66:   float highlight = smoothstep(0.4, 0.9, curve);
67:   vec3 col = mix(grad, uColorAccent, 0.25 * highlight);
68: 
69:   // 轻微纵向遮罩，增强丝绸中心带
70:   float band = 0.85 + 0.15 * (1.0 - abs(st.y));
71:   col *= band;
72: 
73:   // tonemap + gamma
74:   col = tonemap(max(col, vec3(0.0)), uExposure);
75:   col = pow(max(col, vec3(0.0)), vec3(1.0 / max(0.0001, uGamma)));
76: 
77:   // film grain（按像素坐标与时间扰动）
78:   float grain = noise(gl_FragCoord.xy / max(1.0, uGrainScale) + vec2(23.17, 91.7) + t * 0.3);
79:   col += (grain * 2.0 - 1.0) * (0.08 * uGrainAmount);
80: 
81:   // 边缘细微羽化避免硬边
82:   float edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
83:   float edgeFeather = smoothstep(0.0, 0.06, edge);
84:   col *= mix(0.97, 1.0, edgeFeather);
85: 
86:   fragColor = vec4(col, 1.0);
87: }
Program.js:89 Fragment shader is not compiled.

Program.js:178 WebGL: INVALID_OPERATION: useProgram: program not valid
4
SilkBackground.tsx:278 SilkBackground: 渲染失败 TypeError: Cannot read properties of undefined (reading 'forEach')
    at update (SilkBackground.tsx:275:21)
silk:1 Uncaught (in promise) 
Object
SilkBackground.tsx:278 SilkBackground: 渲染失败 TypeError: Cannot read properties of undefined (reading 'forEach')
    at update (SilkBackground.tsx:275:21)
silk:1 Uncaught (in promise) 
Object
336
SilkBackground.tsx:278 SilkBackground: 渲染失败 TypeError: Cannot read properties of undefined (reading 'forEach')
    at update (SilkBackground.tsx:275:21)
hot-reloader-client.js:162 [Fast Refresh] rebuilding
SilkBackground.tsx:278 SilkBackground: 渲染失败 TypeError: Cannot read properties of undefined (reading 'forEach')
    at update (SilkBackground.tsx:275:21)
SilkBackground.tsx:278 SilkBackground: 渲染失败 TypeError: Cannot read properties of undefined (reading 'forEach')
    at update (SilkBackground.tsx:275:21)
SilkBackground.tsx:278 SilkBackground: 渲染失败 TypeError: Cannot read properties of undefined (reading 'forEach')
    at update (SilkBackground.tsx:275:21)
SilkBackground.tsx:278 SilkBackground: 渲染失败 TypeError: Cannot read properties of undefined (reading 'forEach')
    at update (SilkBackground.tsx:275:21)
SilkBackground.tsx:278 SilkBackground: 渲染失败 TypeError: Cannot read properties of undefined (reading 'forEach')
    at update (SilkBackground.tsx:275:21)
SilkBackground.tsx:278 SilkBackground: 渲染失败 TypeError: Cannot read properties of undefined (reading 'forEach')
    at update (SilkBackground.tsx:275:21)
SilkBackground.tsx:278 SilkBackground: 渲染失败 TypeError: Cannot read properties of undefined (reading 'forEach')
    at update (SilkBackground.tsx:275:21)
SilkBackground.tsx:278 SilkBackground: 渲染失败 TypeError: Cannot read properties of undefined (reading 'forEach')
    at update (SilkBackground.tsx:275:21)
SilkBackground.tsx:278 SilkBackground: 渲染失败 TypeError: Cannot read properties of undefined (reading 'forEach')
    at update (SilkBackground.tsx:275:21)
SilkBackground.tsx:278 SilkBackground: 渲染失败 TypeError: Cannot read properties of undefined (reading 'forEach')
    at update (SilkBackground.tsx:275:21)
SilkBackground.tsx:278 SilkBackground: 渲染失败 TypeError: Cannot read properties of undefined (reading 'forEach')
    at update (SilkBackground.tsx:275:21)
SilkBackground.tsx:278 SilkBackground: 渲染失败 TypeError: Cannot read properties of undefined (reading 'forEach')
    at update (SilkBackground.tsx:275:21)
SilkBackground.tsx:278 SilkBackground: 渲染失败 TypeError: Cannot read properties of undefined (reading 'forEach')
    at update (SilkBackground.tsx:275:21)
SilkBackground.tsx:278 SilkBackground: 渲染失败 TypeError: Cannot read properties of undefined (reading 'forEach')
    at update (SilkBackground.tsx:275:21)
SilkBackground.tsx:278 SilkBackground: 渲染失败 TypeError: Cannot read properties of undefined (reading 'forEach')
    at update (SilkBackground.tsx:275:21)
SilkBackground.tsx:278 SilkBackground: 渲染失败 TypeError: Cannot read properties of undefined (reading 'forEach')
    at update (SilkBackground.tsx:275:21)
SilkBackground.tsx:278 SilkBackground: 渲染失败 TypeError: Cannot read properties of undefined (reading 'forEach')
    at update (SilkBackground.tsx:275:21)
SilkBackground.tsx:278 SilkBackground: 渲染失败 TypeError: Cannot read properties of undefined (reading 'forEach')
    at update (SilkBackground.tsx:275:21)
SilkBackground.tsx:278 SilkBackground: 渲染失败 TypeError: Cannot read properties of undefined (reading 'forEach')
    at update (SilkBackground.tsx:275:21)
SilkBackground.tsx:278 SilkBackground: 渲染失败 TypeError: Cannot read properties of undefined (reading 'forEach')
    at update (SilkBackground.tsx:275:21)
SilkBackground.tsx:278 SilkBackground: 渲染失败 TypeError: Cannot read properties of undefined (reading 'forEach')
    at update (SilkBackground.tsx:275:21)
SilkBackground.tsx:278 SilkBackground: 渲染失败 TypeError: Cannot read properties of undefined (reading 'forEach')
    at update (SilkBackground.tsx:275:21)
SilkBackground.tsx:278 SilkBackground: 渲染失败 TypeError: Cannot read properties of undefined (reading 'forEach')
    at update (SilkBackground.tsx:275:21)
SilkBackground.tsx:278 SilkBackground: 渲染失败 TypeError: Cannot read properties of undefined (reading 'forEach')
    at update (SilkBackground.tsx:275:21)
SilkBackground.tsx:278 SilkBackground: 渲染失败 TypeError: Cannot read properties of undefined (reading 'forEach')
    at update (SilkBackground.tsx:275:21)
SilkBackground.tsx:278 SilkBackground: 渲染失败 TypeError: Cannot read properties of undefined (reading 'forEach')
    at update (SilkBackground.tsx:275:21)
SilkBackground.tsx:278 SilkBackground: 渲染失败 TypeError: Cannot read properties of undefined (reading 'forEach')
    at update (SilkBackground.tsx:275:21)
SilkBackground.tsx:278 SilkBackground: 渲染失败 TypeError: Cannot read properties of undefined (reading 'forEach')
    at update (SilkBackground.tsx:275:21)
SilkBackground.tsx:278 SilkBackground: 渲染失败 TypeError: Cannot read properties of undefined (reading 'forEach')
    at update (SilkBackground.tsx:275:21)
SilkBackground.tsx:278 SilkBackground: 渲染失败 TypeError: Cannot read properties of undefined (reading 'forEach')
    at update (SilkBackground.tsx:275:21)
SilkBackground.tsx:278 SilkBackground: 渲染失败 TypeError: Cannot read properties of undefined (reading 'forEach')
    at update (SilkBackground.tsx:275:21)
SilkBackground.tsx:278 SilkBackground: 渲染失败 TypeError: Cannot read properties of undefined (reading 'forEach')
    at update (SilkBackground.tsx:275:21)
766
SilkBackground.tsx:278 SilkBackground: 渲染失败 TypeError: Cannot read properties of undefined (reading 'forEach')
    at update (SilkBackground.tsx:275:21)
