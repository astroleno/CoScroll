'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as dat from 'dat.gui';

/**
 * VolumeTest - 麻薯体积感 + 模糊边界测试版本
 */
export default function VolumeTest() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const guiRef = useRef<dat.GUI | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    console.log('[VolumeTest] === useEffect触发 ===');

    // 如果已有渲染器且还在DOM中，跳过
    if (rendererRef.current && document.contains(rendererRef.current.domElement)) {
      console.log('[VolumeTest] 渲染器已存在且有效，跳过');
      return;
    }

    console.log('[VolumeTest] === 开始初始化 ===');

    // 场景 + 渐变背景
    const scene = new THREE.Scene();

    // 创建渐变背景（更深色调，增强对比）
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, '#c8b5d0');    // 顶部：中紫
    gradient.addColorStop(0.5, '#a898b8'); // 中部：深紫灰
    gradient.addColorStop(1, '#7a9ec8');    // 底部：深蓝
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 2, 256);

    const gradientTexture = new THREE.CanvasTexture(canvas);
    scene.background = gradientTexture;
    console.log('[VolumeTest] 场景创建完成（带渐变背景）');

    // 相机
    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.set(0, 0, 3);
    console.log('[VolumeTest] 相机位置:', camera.position);

    // 渲染器
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    rendererRef.current = renderer;

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // 强制设置canvas样式，确保可见
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';

    containerRef.current.appendChild(renderer.domElement);
    console.log('[VolumeTest] Canvas尺寸:', renderer.domElement.width, 'x', renderer.domElement.height);
    console.log('[VolumeTest] Canvas已添加到容器');
    console.log('[VolumeTest] 容器元素:', containerRef.current);

    // 控制器
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // === 加载真实SDF数据 ===
    async function loadSDFFromFile(
      url: string,
      resX: number,
      resY: number,
      resZ: number
    ): Promise<Uint8Array> {
      console.log(`[VolumeTest] 加载SDF: ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch SDF: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const volumeData = new Uint8Array(buffer);

      const expectedSize = resX * resY * resZ;
      if (volumeData.length !== expectedSize) {
        throw new Error(
          `SDF大小不匹配: 期望${expectedSize}, 实际${volumeData.length}`
        );
      }

      console.log(`[VolumeTest] SDF加载成功: ${resX}×${resY}×${resZ} = ${volumeData.length.toLocaleString()} 体素`);
      return volumeData;
    }

    // === 异步加载shader和创建体积渲染 ===
    async function setupVolumeRendering() {
      try {
        // 加载真实SDF数据（按模型实际比例：32x192x152）
        // 模型实际尺寸比例 X:Y:Z = 1:8:6.2 → 厚:高:宽
        const resX = 32, resY = 192, resZ = 152;
        const volumeData = await loadSDFFromFile(
          '/volumes/001_空_sdf_32x192x152.bin',
          resX, resY, resZ
        );

        // 创建3D纹理
        // Numpy C-order存储，Three.js按width-height-depth解释
        const volumeTexture = new THREE.Data3DTexture(volumeData, resZ, resY, resX);
        volumeTexture.format = THREE.RedFormat;
        volumeTexture.type = THREE.UnsignedByteType;
        volumeTexture.minFilter = THREE.LinearFilter;
        volumeTexture.magFilter = THREE.LinearFilter;
        volumeTexture.wrapS = THREE.ClampToEdgeWrapping;
        volumeTexture.wrapT = THREE.ClampToEdgeWrapping;
        volumeTexture.wrapR = THREE.ClampToEdgeWrapping;
        volumeTexture.needsUpdate = true;

        console.log('[VolumeTest] 3D纹理已创建');

        // 加载shader
        const [vertexShader, fragmentShader] = await Promise.all([
          fetch('/shaders/volume.vert.glsl').then(r => r.text()),
          fetch('/shaders/volume.frag.glsl').then(r => r.text())
        ]);

        console.log('[VolumeTest] Shader已加载');

        // === 可调参数默认值（简化调试版）===
        const params = {
          softEdgeWidth: 0.25,     // 软边宽度
          densityMultiplier: 8.0,  // 密度倍增器（提高可见度）
          coreBoost: 0.5,          // 核心密度（当前简化未使用）
          noiseStrength: 0.0,      // 暂时关闭噪声
          brightness: 7.0,         // 整体亮度
          opacityMultiplier: 1.0,  // 整体不透明度（当前简化未使用）
          edgeGlowStrength: 0.0,   // 暂时关闭边缘发光
          densityCutoff: 0.01,     // 低阈值
          zThickness: 6.0,         // X轴厚度缩放
          colorBottom: [0.5, 0.7, 1.0],  // 蓝色
          colorMiddle: [1.0, 0.9, 0.6], // 黄色
          colorTop: [1.0, 0.7, 0.9],     // 粉色
          axisMapping: 'zyx'       // 轴向映射（zyx为正确）
        };

        const axisMappings: { [key: string]: number } = {
          'xyz': 0,
          'xzy': 1,
          'yxz': 2,
          'yzx': 3,
          'zxy': 4,
          'zyx': 5
        };

        // 创建材质
        const volumeMaterial = new THREE.ShaderMaterial({
          uniforms: {
            uVolumeTexture: { value: volumeTexture },
            uTime: { value: 0 },
            uCameraPos: { value: camera.position },
            uModelMatrixInv: { value: new THREE.Matrix4() },
            // 新增可调参数
            uSoftEdgeWidth: { value: params.softEdgeWidth },
            uDensityMultiplier: { value: params.densityMultiplier },
            uCoreBoost: { value: params.coreBoost },
            uNoiseStrength: { value: params.noiseStrength },
            uBrightness: { value: params.brightness },
            uOpacityMultiplier: { value: params.opacityMultiplier },
            uEdgeGlowStrength: { value: params.edgeGlowStrength },
            uDensityCutoff: { value: params.densityCutoff },
            uColorBottom: { value: new THREE.Vector3(...params.colorBottom) },
            uColorMiddle: { value: new THREE.Vector3(...params.colorMiddle) },
            uColorTop: { value: new THREE.Vector3(...params.colorTop) },
            uVolumeScale: { value: new THREE.Vector3(1.0, 1.0, 1.0) }, // 稍后更新
            uAxisMapping: { value: axisMappings[params.axisMapping] }
          },
          vertexShader,
          fragmentShader,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide
        });

        // === 创建dat.GUI控制面板 ===
        if (guiRef.current) {
          guiRef.current.destroy();
        }
        const gui = new dat.GUI();
        guiRef.current = gui;

        const effectFolder = gui.addFolder('麻薯效果参数');
        effectFolder.add(params, 'brightness', 0.5, 8.0).name('💡 整体亮度').onChange((value: number) => {
          volumeMaterial.uniforms.uBrightness.value = value;
        });
        effectFolder.add(params, 'opacityMultiplier', 0.1, 3.0).name('🎭 不透明度').onChange((value: number) => {
          volumeMaterial.uniforms.uOpacityMultiplier.value = value;
        });
        effectFolder.add(params, 'edgeGlowStrength', 0.0, 8.0).name('✨ 边缘发光').onChange((value: number) => {
          volumeMaterial.uniforms.uEdgeGlowStrength.value = value;
        });
        effectFolder.add(params, 'densityCutoff', 0.0, 0.5).name('🧹 清理阈值').onChange((value: number) => {
          volumeMaterial.uniforms.uDensityCutoff.value = value;
        });
        effectFolder.add(params, 'zThickness', 0.3, 10.0).name('📏 X轴厚度').onChange((value: number) => {
          const maxDim = Math.max(resX, resY, resZ);
          const baseScaleX = 2.0 * (resX / maxDim);
          volumeMaterial.uniforms.uVolumeScale.value.x = (baseScaleX / 2.0) * value;
          console.log(`[VolumeTest] X厚度: ${value} → ${volumeMaterial.uniforms.uVolumeScale.value.x}`);
        });
        effectFolder.add(params, 'softEdgeWidth', 0.1, 0.8).name('软边宽度').onChange((value: number) => {
          volumeMaterial.uniforms.uSoftEdgeWidth.value = value;
        });
        effectFolder.add(params, 'densityMultiplier', 1.0, 10.0).name('体积感强度').onChange((value: number) => {
          volumeMaterial.uniforms.uDensityMultiplier.value = value;
        });
        effectFolder.add(params, 'coreBoost', 0.0, 1.0).name('💪 核心密度').onChange((value: number) => {
          volumeMaterial.uniforms.uCoreBoost.value = value;
        });
        effectFolder.add(params, 'noiseStrength', 0.0, 0.5).name('边缘噪声').onChange((value: number) => {
          volumeMaterial.uniforms.uNoiseStrength.value = value;
        });
        effectFolder.add(params, 'axisMapping', Object.keys(axisMappings)).name('🔄 轴向映射').onChange((value: string) => {
          volumeMaterial.uniforms.uAxisMapping.value = axisMappings[value];
        });
        effectFolder.open();

        const colorFolder = gui.addFolder('渐变色彩');
        colorFolder.addColor(params, 'colorBottom').name('底部颜色（蓝）').onChange((value: number[]) => {
          volumeMaterial.uniforms.uColorBottom.value.set(value[0] / 255, value[1] / 255, value[2] / 255);
        });
        colorFolder.addColor(params, 'colorMiddle').name('中部颜色（黄）').onChange((value: number[]) => {
          volumeMaterial.uniforms.uColorMiddle.value.set(value[0] / 255, value[1] / 255, value[2] / 255);
        });
        colorFolder.addColor(params, 'colorTop').name('顶部颜色（粉）').onChange((value: number[]) => {
          volumeMaterial.uniforms.uColorTop.value.set(value[0] / 255, value[1] / 255, value[2] / 255);
        });
        colorFolder.open();

        // 创建包围盒mesh（匹配模型实际比例 1:8:6.2）
        // 归一化到最大维度为2.0
        const maxDim = Math.max(resX, resY, resZ); // 192
        const scaleX = 2.0 * (resX / maxDim); // 2.0 * (32/192) = 0.333
        const scaleY = 2.0 * (resY / maxDim); // 2.0 * (192/192) = 2.0
        const scaleZ = 2.0 * (resZ / maxDim); // 2.0 * (152/192) = 1.583

        // 传入体积盒半尺寸给shader（应用厚度参数）
        volumeMaterial.uniforms.uVolumeScale.value.set(
          (scaleX / 2.0) * params.zThickness,  // 应用X轴厚度（默认6.0）
          scaleY / 2.0,  // 1.0
          scaleZ / 2.0   // 0.7917
        );

        const boxGeometry = new THREE.BoxGeometry(scaleX, scaleY, scaleZ);
        const volumeMesh = new THREE.Mesh(boxGeometry, volumeMaterial);
        scene.add(volumeMesh);

        console.log(`[VolumeTest] 包围盒尺寸: ${scaleX} × ${scaleY} × ${scaleZ}`);
        console.log(`[VolumeTest] 体积半尺寸: ${scaleX/2} × ${scaleY/2} × ${scaleZ/2}`);

        console.log('[VolumeTest] 体积mesh已添加');

        // 渲染循环
        const clock = new THREE.Clock();

        function animate() {
          requestAnimationFrame(animate);

          const elapsed = clock.getElapsedTime();

          // 更新uniforms
          volumeMaterial.uniforms.uTime.value = elapsed;
          volumeMaterial.uniforms.uCameraPos.value.copy(camera.position);
          volumeMaterial.uniforms.uModelMatrixInv.value
            .copy(volumeMesh.matrixWorld)
            .invert();

          controls.update();
          renderer.render(scene, camera);
        }

        animate();
        console.log('[VolumeTest] === 体积渲染循环已启动 ===');

      } catch (error) {
        console.error('[VolumeTest] 体积渲染初始化失败:', error);
      }
    }

    setupVolumeRendering();

    // Resize
    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', onResize);

    // 清理函数
    return () => {
      console.log('[VolumeTest] === 清理函数执行 ===');
      window.removeEventListener('resize', onResize);

      // 清理GUI
      if (guiRef.current) {
        guiRef.current.destroy();
        guiRef.current = null;
      }

      // 注意：保留canvas运行
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-screen"
      style={{
        position: 'relative',
        width: '100%',
        height: '100vh',
        overflow: 'hidden'
      }}
    />
  );
}