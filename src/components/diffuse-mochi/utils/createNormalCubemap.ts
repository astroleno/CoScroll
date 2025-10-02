/**
 * Normal Cubemap生成工具
 * 基于subsurface-refraction-shader实现
 * 用于生成模型的法线cubemap，供次表面散射shader使用
 */

import * as THREE from 'three';

/**
 * 创建法线cubemap
 * @param renderer WebGLRenderer实例
 * @param geometry 模型几何体
 * @param resolution cubemap分辨率（默认256）
 * @returns CubeTexture - 法线cubemap
 */
export async function createNormalCubemap(
  renderer: THREE.WebGLRenderer,
  geometry: THREE.BufferGeometry,
  resolution: number = 256
): Promise<THREE.CubeTexture> {
  // 1. 创建场景和相机
  const scene = new THREE.Scene();

  // CubeCamera: 从中心点向6个方向渲染
  const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(resolution, {
    generateMipmaps: true,
    minFilter: THREE.LinearMipMapLinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    colorSpace: THREE.LinearSRGBColorSpace,
    type: THREE.HalfFloatType,
  });

  const cubeCamera = new THREE.CubeCamera(0.1, 10, cubeRenderTarget);
  cubeCamera.position.set(0, 0, 0);

  // 2. 创建法线材质
  // 将法线从[-1,1]编码到[0,1]存储到颜色
  const normalMaterial = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec3 vNormal;

      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vNormal;

      void main() {
        // 法线从[-1,1]编码到[0,1]
        vec3 encodedNormal = vNormal * 0.5 + 0.5;
        gl_FragColor = vec4(encodedNormal, 1.0);
      }
    `,
    side: THREE.DoubleSide,
  });

  // 3. 创建网格并渲染
  const mesh = new THREE.Mesh(geometry, normalMaterial);
  scene.add(mesh);
  scene.add(cubeCamera);

  // 渲染cubemap
  cubeCamera.update(renderer, scene);

  // 4. 清理
  scene.remove(mesh);
  scene.remove(cubeCamera);
  normalMaterial.dispose();

  // 5. 返回cubemap texture
  return cubeRenderTarget.texture;
}

/**
 * 预览cubemap（调试用）
 * 创建一个球体显示cubemap效果
 */
export function createCubemapPreviewMesh(
  cubemap: THREE.CubeTexture
): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(1, 64, 64);
  const material = new THREE.MeshBasicMaterial({
    envMap: cubemap,
    side: THREE.BackSide,
  });

  return new THREE.Mesh(geometry, material);
}
