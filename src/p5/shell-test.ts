/*
  多层壳体渲染测试 - PPL方案实现
  - 4层壳体，每层微小放大
  - 分层透明度控制
  - Fresnel + 3D噪声
  - 软糯边界效果
*/

export interface ShellTestOptions {
  container?: HTMLElement | null;
  debug?: boolean;
}

export function createShellTestSketch(options: ShellTestOptions = {}) {
  const { container = document.body, debug = false } = options;

  const sketch = (p: any) => {
    // 资源
    let objModel: any = null;
    let shellShader: any = null;

    // 渲染参数
    const NUM_SHELLS = 8;           // 增加到8层
    const SCALE_INCREMENT = 0.012;  // 加大外扩幅度

    p.preload = () => {
      try {
        objModel = p.loadModel('/models/10k_obj/001_空.obj', true);
        console.log("[shell-test] Loading OBJ: 001_空.obj");

        // 加载专用shader
        shellShader = p.loadShader(
          '/p5/shaders/shell.vert',
          '/p5/shaders/shell.frag'
        );
        console.log("[shell-test] Loading shell shader");
      } catch (err) {
        console.error("[shell-test] preload error", err);
      }
    };

    p.setup = () => {
      try {
        p.createCanvas(window.innerWidth, window.innerHeight, p.WEBGL);
        p.pixelDensity(1);
        p.noStroke();
        console.log("[shell-test] setup complete");
      } catch (err) {
        console.error("[shell-test] setup error", err);
      }
    };

    p.windowResized = () => {
      try {
        p.resizeCanvas(window.innerWidth, window.innerHeight);
      } catch (err) {
        console.error("[shell-test] resize error", err);
      }
    };

    p.draw = () => {
      try {
        // 等待资源加载
        if (!objModel || !shellShader) {
          p.background(20);
          p.fill(255);
          p.text('Loading...', 0, 0);
          return;
        }

        p.clear();
        p.background(12, 15, 20);

        // 相机设置
        const fov = Math.PI / 3;
        const aspect = p.width / p.height;
        p.perspective(fov, aspect, 0.1, 5000);
        p.camera(0, 0, 650, 0, 0, 0, 0, 1, 0);

        // 基础旋转
        const baseRotation = p.millis() / 2500.0;

        // 渲染多层壳体（从外到内）
        for (let i = NUM_SHELLS - 1; i >= 0; i--) {
          // 外层使用加法混合（增强光晕），内层使用普通混合
          if (i >= NUM_SHELLS / 2) {
            p.blendMode(p.ADD);  // 外层：加法混合
          } else {
            p.blendMode(p.BLEND); // 内层：正常混合
          }
          p.push();

          p.shader(shellShader);

          // 设置uniforms
          shellShader.setUniform('uTime', p.millis() / 1000.0);
          shellShader.setUniform('uLayer', i);
          shellShader.setUniform('uTotalLayers', NUM_SHELLS);

          // 参考图配色: 青绿中心 → 浅蓝 → 粉紫边缘
          shellShader.setUniform('uMainColor', [0.4, 0.9, 0.7]);
          shellShader.setUniform('uSecondaryColor', [0.6, 0.85, 0.95]);
          shellShader.setUniform('uRimColor', [0.95, 0.7, 0.85]);

          // 柔软度
          shellShader.setUniform('uSoftness', 0.92);

          // 每层缩放
          const scaleOffset = 1.0 + i * SCALE_INCREMENT;
          p.scale(2.2 * scaleOffset);

          // 旋转
          p.rotateX(Math.PI);
          p.rotateY(baseRotation);

          // 渲染模型
          p.model(objModel);

          p.pop();
        }

        // 调试信息（控制台输出，避免WebGL字体错误）
        if (debug && p.frameCount % 60 === 0) {
          console.log(`[shell-test] FPS: ${Math.round(p.frameRate())} | Layers: ${NUM_SHELLS}`);
        }

      } catch (err) {
        console.error("[shell-test] draw error", err);
      }
    };
  };

  try {
    const P5 = require("p5");
    const instance = new P5(sketch, container || undefined);
    console.log("[shell-test] instance created");
    return instance as any;
  } catch (err) {
    console.error("[shell-test] createSketch error", err);
    throw err;
  }
}