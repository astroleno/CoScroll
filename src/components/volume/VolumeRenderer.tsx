'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export default function VolumeRenderer() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // 防止开发模式重复初始化
    if ((containerRef.current as any).__volume_init) return;
    (containerRef.current as any).__volume_init = true;

    console.log('[Volume] 开始初始化...');

    // 场景
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c0f14); // 深灰背景

    // 相机
    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.set(0, 0, 3);

    // 渲染器
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);

    console.log('[Volume] Canvas已添加，尺寸:', renderer.domElement.width, renderer.domElement.height);

    // 控制器
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // 创建一个简单的红色立方体测试
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    console.log('[Volume] 红色立方体已添加');

    // 渲染循环
    function animate() {
      requestAnimationFrame(animate);

      cube.rotation.x += 0.01;
      cube.rotation.y += 0.01;

      controls.update();
      renderer.render(scene, camera);
    }

    console.log('[Volume] 开始渲染循环');
    animate();

    // 窗口resize
    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', onResize);

    // 清理
    return () => {
      window.removeEventListener('resize', onResize);
      controls.dispose();
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      if (containerRef.current) {
        try {
          containerRef.current.removeChild(renderer.domElement);
        } catch (e) {
          console.warn('[Volume] 清理时canvas已被移除');
        }
      }
    };
  }, []);

  return <div ref={containerRef} className="w-full h-screen" />;
}