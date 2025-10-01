#!/usr/bin/env python3
"""
可视化SDF体素切片（用于验证）
使用说明:
  python scripts/visualize_sdf.py <sdf.bin> [output_dir] [resolution]
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image


def visualize_sdf(sdf_path: str, output_dir: str, resolution: int = 64) -> None:
    try:
        sdf_data = np.fromfile(sdf_path, dtype=np.uint8)
        voxels = sdf_data.reshape(resolution, resolution, resolution)

        out_dir = Path(output_dir)
        out_dir.mkdir(parents=True, exist_ok=True)

        mid = resolution // 2
        slices = {
            'xy': voxels[:, :, mid],
            'xz': voxels[:, mid, :],
            'yz': voxels[mid, :, :],
        }

        for name, slice_data in slices.items():
            img = Image.fromarray(slice_data, mode='L')
            img.save(out_dir / f"sdf_slice_{name}.png")
            print(f"保存切片: {out_dir / f'sdf_slice_{name}.png'}")
    except Exception as e:
        print("❌ 可视化失败:", e)
        raise


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("用法: python scripts/visualize_sdf.py <sdf.bin> [output_dir] [resolution]")
        sys.exit(1)

    sdf_path = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else 'public/volumes/debug'
    resolution = int(sys.argv[3]) if len(sys.argv) > 3 else 64
    visualize_sdf(sdf_path, output_dir, resolution)


