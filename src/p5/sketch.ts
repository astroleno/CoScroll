/*
  p5 最小骨架（instance 模式）
  - 提供安全的 setup/draw 包装
  - 绑定滚动速度到状态（可接入 stores）
  - 预留 WEBGL 渲染与 shader 接口
*/

// 可按需替换为事件总线或自定义 store
import { stores } from "@/shared";

export interface SketchOptions {
  container?: HTMLElement | null;
  debug?: boolean;
}

export function createSketch(options: SketchOptions = {}) {
  const { container = document.body, debug = false } = options;

  // 在全局开关下输出更多日志
  const verbose = debug || (window as any).__COSCROLL_DEBUG__ === true;

  const sketch = (p: any) => {
    // 示例状态（可换成 stores.scrollStore）
    let scrollVelocity = 0;
    let lastScrollY = 0;

    // 资源占位
    let shader: any = null;
    let torus: any = null;
    let sphere: any = null;

    p.preload = () => {
      try {
        const vert = (window as any).__NEON_VERT__ || undefined;
        const frag = (window as any).__NEON_FRAG__ || undefined;
        if (!vert || !frag) {
          // 通过相对路径加载打包后的资源
          // 注意：Next 静态打包时需要允许加载这些文本资源。这里用 fetch 读取。
        }
      } catch (err) {
        console.error("[p5] preload error", err);
      }
    };

    p.setup = () => {
      try {
        p.createCanvas(window.innerWidth, window.innerHeight, p.WEBGL);
        p.pixelDensity(1);
        p.noStroke();
        if (verbose) console.log("[p5] setup complete");

        // 创建材质（从内联字符串创建，避免额外构建配置）
        // 直接内嵌 shader 源码，避免构建器特殊配置
        const neonVert = `precision mediump float;attribute vec3 aPosition;attribute vec3 aNormal;uniform mat4 uModelViewMatrix;uniform mat4 uProjectionMatrix;varying vec3 vNormal;varying vec3 vViewDir;void main(){vec4 worldPos=uModelViewMatrix*vec4(aPosition,1.0);gl_Position=uProjectionMatrix*worldPos;vViewDir=normalize(-worldPos.xyz);vNormal=mat3(uModelViewMatrix)*aNormal;}`;
        const neonFrag = `precision mediump float;varying vec3 vNormal;varying vec3 vViewDir;uniform float uTime;uniform vec3 uMainColor;uniform vec3 uSecondaryColor;uniform vec3 uRimColor;uniform float uNoiseScale;uniform float uBreathingSpeed;uniform float uFresnelIntensity;uniform float uNoiseLayers;float hash(vec3 p){p=vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6)));return fract(sin(p)*43758.5453123).x;}float noise(vec3 x){vec3 i=floor(x);vec3 f=fract(x);f=f*f*(3.0-2.0*f);float n000=hash(i+vec3(0,0,0));float n100=hash(i+vec3(1,0,0));float n010=hash(i+vec3(0,1,0));float n110=hash(i+vec3(1,1,0));float n001=hash(i+vec3(0,0,1));float n101=hash(i+vec3(1,0,1));float n011=hash(i+vec3(0,1,1));float n111=hash(i+vec3(1,1,1));float nx00=mix(n000,n100,f.x);float nx10=mix(n010,n110,f.x);float nx01=mix(n001,n101,f.x);float nx11=mix(n011,n111,f.x);float nxy0=mix(nx00,nx10,f.y);float nxy1=mix(nx01,nx11,f.y);return mix(nxy0,nxy1,f.z);}float fbm(vec3 p,float layers){float v=0.0;float a=0.5;for(float i=0.0;i<8.0;i+=1.0){if(i>=layers)break;v+=a*noise(p);p*=2.0;a*=0.5;}return v;}void main(){vec3 n=normalize(vNormal);vec3 v=normalize(vViewDir);float fres=pow(1.0-max(dot(n,v),0.0),uFresnelIntensity);vec3 p=v*uNoiseScale+vec3(0.0,0.0,-uTime*0.1);float f=fbm(p,uNoiseLayers);f=pow(f*0.5+0.75,3.0);float breath=0.5+0.5*sin(uTime*uBreathingSpeed);vec3 baseCol=mix(uMainColor,uSecondaryColor,f);vec3 col=baseCol*(0.6+0.4*breath)+uRimColor*fres;gl_FragColor=vec4(col,1.0);}`;
        try {
          shader = p.createShader(neonVert, neonFrag);
        } catch (e) {
          console.error('[p5] createShader error', e);
        }

        // 初始化滚动监听（简单示例，可换 IntersectionObserver + 自定义采样）
        lastScrollY = window.scrollY;
        window.addEventListener("scroll", () => {
          const currentY = window.scrollY;
          scrollVelocity = currentY - lastScrollY;
          lastScrollY = currentY;
        }, { passive: true });
      } catch (err) {
        console.error("[p5] setup error", err);
      }
    };

    p.windowResized = () => {
      try {
        p.resizeCanvas(window.innerWidth, window.innerHeight);
      } catch (err) {
        console.error("[p5] resize error", err);
      }
    };

    p.draw = () => {
      try {
        // 背景与坐标
        p.push();
        p.background(6, 8, 12);

        const rotation = p.millis() * 0.0003 + scrollVelocity * 0.002;

        if (shader) {
          p.shader(shader);
          shader.setUniform('uTime', p.millis() / 1000.0);
          shader.setUniform('uMainColor', [1.0, 0.72, 0.49]);
          shader.setUniform('uSecondaryColor', [0.49, 0.73, 1.0]);
          shader.setUniform('uRimColor', [1.0, 0.86, 0.76]);
          shader.setUniform('uNoiseScale', 1.2);
          shader.setUniform('uBreathingSpeed', 0.6);
          shader.setUniform('uFresnelIntensity', 2.4);
          shader.setUniform('uNoiseLayers', 4.0);

          p.push();
          p.rotateX(-Math.PI/2);
          p.rotateY(rotation);
          // 近似 ShaderPark 中 torus + sphere 组合
          p.torus(160, 28, 64, 32);
          p.pop();

          p.push();
          p.rotateY(rotation * 0.6);
          p.translate(0, 0, 0);
          p.sphere(120, 48, 32);
          p.pop();
        }

        p.pop();

        // 衰减滚动速度（简单的阻尼）
        scrollVelocity *= 0.9;
      } catch (err) {
        console.error("[p5] draw error", err);
      }
    };
  };

  try {
    // 动态导入以避免服务端渲染报错
    // 使用 require 以绕过类型依赖（项目未安装 @types/p5 亦可运行）
    const P5 = require("p5");
    const instance = new P5(sketch, container || undefined);
    if (verbose) console.log("[p5] instance created");
    return instance as any;
  } catch (err) {
    console.error("[p5] createSketch error", err);
    throw err;
  }
}


