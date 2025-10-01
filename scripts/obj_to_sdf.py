#!/usr/bin/env python3
"""
OBJ模型 → SDF体素化脚本
输出: 64³ 的R8格式二进制文件

使用说明:
  python scripts/obj_to_sdf.py <input.obj> [output.bin] [resolution]

重要说明:
- 优先尝试使用 igl 的广义绕组数进行符号判定；若不可用，自动回退到 normal 方法
- 该脚本会将模型归一化到 [-1, 1] 立方体内，再进行SDF采样
"""

import sys
from pathlib import Path

import numpy as np
import trimesh
from mesh_to_sdf import mesh_to_sdf


def obj_to_sdf(obj_path: str, output_path: str, resolution: int | tuple = 64, verbose: bool = True) -> Path:
    """将OBJ模型转换为SDF体素并量化为R8二进制文件。

    参数:
        obj_path: OBJ文件路径
        output_path: 输出.bin文件路径
        resolution: 体素分辨率（默认64）
                   - int: 立方体（如64表示64³）
                   - tuple: (resX, resY, resZ)（如(192,192,32)）
        verbose: 是否打印详细信息
    返回:
        输出文件路径 Path
    """

    try:
        if verbose:
            print(f"[1/5] 加载OBJ: {obj_path}")

        mesh = trimesh.load(obj_path, force='mesh')

        if verbose:
            print(f"  └─ 顶点数: {len(mesh.vertices)}")
            print(f"  └─ 三角面数: {len(mesh.faces)}")

        # 步骤2：将模型归一化到 [-1, 1]
        if verbose:
            print("[2/5] 归一化模型...")
        bounds = mesh.bounds
        center = (bounds[0] + bounds[1]) / 2
        mesh.vertices -= center
        scale = np.abs(mesh.vertices).max()
        mesh.vertices /= max(scale, 1e-8)

        if verbose:
            print(f"  └─ 中心: {center}")
            print(f"  └─ 缩放: {scale}")

        # 步骤3：生成采样网格
        if isinstance(resolution, int):
            resX = resY = resZ = resolution
            res_str = f"{resolution}³"
        else:
            resX, resY, resZ = resolution
            res_str = f"{resX}×{resY}×{resZ}"

        if verbose:
            print(f"[3/5] 生成{res_str}采样网格...")

        x = np.linspace(-1, 1, resX)
        y = np.linspace(-1, 1, resY)
        z = np.linspace(-1, 1, resZ)
        X, Y, Z = np.meshgrid(x, y, z, indexing='ij')
        points = np.stack([X, Y, Z], axis=-1).reshape(-1, 3)

        # 步骤4：计算SDF（优先Winding Number符号）
        if verbose:
            print("[4/5] 计算SDF值（可能需要1-2分钟）...")

        try:
            import igl  # 可选依赖
            # 使用igl的fast_winding_number计算符号
            # 转换trimesh.TrackedArray到纯numpy数组
            V = np.array(mesh.vertices, dtype=np.float64)
            F = np.array(mesh.faces, dtype=np.int64)
            P = np.array(points, dtype=np.float64)
            wn = igl.fast_winding_number(V, F, P)
            sign = np.where(wn > 0.5, -1.0, 1.0)  # 内为负号
            sdf_unsigned = np.abs(mesh_to_sdf(mesh, points, surface_point_method='scan'))
            sdf_values = sdf_unsigned * sign
            if verbose:
                print("  └─ 使用方法: Fast Winding Number（推荐）")
        except Exception as e:
            if verbose:
                print(f"  └─ Winding Number失败({type(e).__name__})，回退到normal方法")
            sdf_values = mesh_to_sdf(
                mesh,
                points,
                surface_point_method='scan',
                sign_method='normal',
                bounding_radius=1.5,
            )

        sdf_values = sdf_values.reshape(resX, resY, resZ)

        if verbose:
            print(f"  └─ SDF范围: [{sdf_values.min():.3f}, {sdf_values.max():.3f}]")

        # 步骤5：量化到 [0, 255] 并保存
        # 注意：不转置，保持(resX, resY, resZ)形状
        # 在shader中处理坐标映射
        if verbose:
            print("[5/5] 量化到R8格式...")
        sdf_clipped = np.clip(sdf_values, -1.0, 1.0)
        sdf_quantized = ((sdf_clipped + 1.0) * 127.5).astype(np.uint8)

        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        sdf_quantized.tofile(output_path)

        if verbose:
            size_kb = output_path.stat().st_size / 1024
            total_voxels = resX * resY * resZ
            print("\n✅ 成功!")
            print(f"  └─ 输出: {output_path}")
            print(f"  └─ 大小: {size_kb:.1f} KB")
            print(f"  └─ 维度: {res_str} = {total_voxels:,} 体素")

        return output_path
    except Exception as e:
        print("❌ 失败:", e)
        raise


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("用法: python scripts/obj_to_sdf.py <input.obj> [output.bin] [resolution]")
        print("示例:")
        print("  python scripts/obj_to_sdf.py model.obj output.bin 64")
        print("  python scripts/obj_to_sdf.py model.obj output.bin 192,192,32")
        sys.exit(1)

    input_obj = sys.argv[1]
    output_bin = sys.argv[2] if len(sys.argv) > 2 else 'public/volumes/output_sdf64.bin'

    # 解析分辨率参数（支持 "64" 或 "192,192,32"）
    if len(sys.argv) > 3:
        res_arg = sys.argv[3]
        if ',' in res_arg:
            resolution = tuple(map(int, res_arg.split(',')))
        else:
            resolution = int(res_arg)
    else:
        resolution = 64

    obj_to_sdf(input_obj, output_bin, resolution)


