⏺ User approved Claude's plan:
  ⎿  体积渲染最基础版本实施计划

     目标

     创建一个完全独立的体积渲染组件，实现：
     - Python工具链：OBJ → SDF体素（64³）
     - Three.js组件：加载并渲染SDF体积
     - 最简shader：8步Ray Marching，看到模糊的形状
     - 独立测试页面：/volume-test

     实施步骤（约2小时）

     第1步：Python工具链（30分钟）

     - 创建 scripts/obj_to_sdf.py（带winding number回退）
     - 创建 scripts/visualize_sdf.py（验证工具）
     - 安装依赖并测试转换001_空.obj

     第2步：Three.js组件（30分钟）

     - 创建 src/components/volume/VolumeRenderer.tsx（独立组件）
     - 加载SDF二进制文件
     - 创建Data3DTexture
     - 基础场景设置（相机、OrbitControls）

     第3步：最简Shader（30分钟）

     - 创建 public/shaders/volume-minimal.vert.glsl
     - 创建 public/shaders/volume-minimal.frag.glsl
       - 8步固定步长Ray Marching
       - 简单密度计算：smoothstep(0.1, -0.1, sdf)
       - 单色青绿色
       - 无优化（AABB、FBM等后续添加）

     第4步：独立测试页面（30分钟）

     - 创建 src/app/volume-test/page.tsx
     - 全屏黑色背景
     - 导入VolumeRenderer组件
     - 简单调试UI（显示FPS和加载状态）

     验收标准

     - Python脚本能成功生成262KB的SDF文件
     - 访问/volume-test能看到黑色背景
     - 能看到模糊的青绿色体积形状
     - 鼠标可以旋转视角
     - Console无错误
     - 不影响现有任何代码（完全独立）

     架构隔离原则

     - 新目录: src/components/volume/（不碰core/layout）
     - 新路由: /volume-test（不修改主页面）
     - 新依赖: 仅添加Python工具，不改package.json的运行时依赖
     - 零侵入: 现有Model3D、AnchorGlyphRegion等组件保持不变