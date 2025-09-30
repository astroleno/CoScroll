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

    // 体积渲染资源
    let neonShader: any = null;
    let bgShader: any = null;

    // OBJ模型资源
    let objModel: any = null;

    p.preload = () => {
      try {
        // 加载书法OBJ模型
        objModel = p.loadModel('/models/10k_obj/001_空.obj', true);
        console.log("[p5] Loading OBJ model: 001_空.obj");

        // 加载柔软体积shader
        neonShader = p.loadShader('/p5/shaders/soft_volume.vert', '/p5/shaders/soft_volume.frag');
        console.log("[p5] Loading soft volume shader");
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

        // 背景 shader（setup 创建一次）
        const bgVert = `precision mediump float;attribute vec3 aPosition;attribute vec2 aTexCoord;uniform mat4 uModelViewMatrix;uniform mat4 uProjectionMatrix;varying vec2 vUV;void main(){vUV=aTexCoord;gl_Position=uProjectionMatrix*uModelViewMatrix*vec4(aPosition,1.0);}`;
        const bgFrag = `precision mediump float;varying vec2 vUV;uniform float uTime;vec3 palette(float t){vec3 a=vec3(0.98,0.92,0.86);vec3 b=vec3(0.65,0.70,0.95);vec3 c=vec3(0.55,0.80,0.90);vec3 d=vec3(0.95,0.75,0.85);return mix(mix(a,b,t),mix(c,d,1.0-t),0.5+0.5*sin(t*6.2831));}void main(){vec2 uv=vUV;float tl=distance(uv,vec2(0.0,0.0));float tr=distance(uv,vec2(1.0,0.0));float bl=distance(uv,vec2(0.0,1.0));float br=distance(uv,vec2(1.0,1.0));float t=(tl+(1.0-tr)+(1.0-bl)+br)*0.25;vec3 col=palette(t);float r=length(uv-0.5);float vignette=smoothstep(0.95,0.35,r);col*=mix(0.9,1.0,vignette);gl_FragColor=vec4(col,1.0);}`;
        try {
          bgShader = p.createShader(bgVert, bgFrag);
        } catch (e) {
          console.error('[p5] create bg shader error', e);
        }

        // 简化设置 - 直接使用主canvas渲染
        console.log('[p5] Using direct shader rendering on main canvas');

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
        p.clear();
        p.background(6, 8, 12);

        // 背景渐变
        if (bgShader) {
          p.push();
          p.resetMatrix();
          p.shader(bgShader);
          bgShader.setUniform('uTime', p.millis()/1000.0);
          p.rectMode(p.CORNERS);
          p.noStroke();
          p.rect(-p.width/2, -p.height/2, p.width/2, p.height/2);
          p.pop();
        }

        // 用柔软体积shader渲染OBJ
        if (objModel && neonShader) {
          p.push();

          // 🔑 启用alpha混合 (关键！)
          p.blendMode(p.BLEND);

          // 调整相机 - FOV和距离解决显示不全
          const fov = Math.PI / 3; // 60度视野
          const aspect = p.width / p.height;
          p.perspective(fov, aspect, 0.1, 5000);
          p.camera(0, 0, 600, 0, 0, 0, 0, 1, 0);

          p.shader(neonShader);

          // 简化的uniforms
          neonShader.setUniform('uTime', p.millis() / 1000.0);
          neonShader.setUniform('uMainColor', [0.3, 0.9, 0.5]);
          neonShader.setUniform('uSecondaryColor', [0.9, 0.7, 0.3]);
          neonShader.setUniform('uRimColor', [0.9, 0.4, 0.8]);
          neonShader.setUniform('uSoftness', 0.8); // 🔑 更高柔软度

          // 渲染模型
          p.scale(2.2);
          p.rotateX(Math.PI); // 修正上下颠倒
          p.rotateY(p.millis() / 2000.0);
          p.model(objModel);

          p.pop();
        }

        // 衰减滚动速度
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


