#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试生成的图片内容
"""

from PIL import Image
import os


def test_image_content():
    """测试图片内容"""
    print("🔍 测试生成的图片内容...")
    
    output_dir = 'words_1024_fixed'
    
    if not os.path.exists(output_dir):
        print(f"❌ 输出目录不存在: {output_dir}")
        return
    
    files = [f for f in os.listdir(output_dir) if f.endswith('.png')]
    files.sort()
    
    print(f"📁 找到 {len(files)} 个PNG文件")
    
    for i, filename in enumerate(files[:5], 1):  # 只测试前5个文件
        filepath = os.path.join(output_dir, filename)
        try:
            # 打开图片
            image = Image.open(filepath)
            
            # 获取图片信息
            width, height = image.size
            mode = image.mode
            
            print(f"  {i}. {filename}")
            print(f"     尺寸: {width}x{height}")
            print(f"     模式: {mode}")
            
            # 检查图片是否为空（全白或全透明）
            if mode == 'RGB':
                # 检查是否为全白图片
                pixels = list(image.getdata())
                if all(pixel == (255, 255, 255) for pixel in pixels):
                    print(f"     ⚠️  警告: 图片可能是全白的")
                else:
                    print(f"     ✅ 图片包含内容")
            elif mode == 'RGBA':
                # 检查透明度
                pixels = list(image.getdata())
                if all(pixel[3] == 0 for pixel in pixels):
                    print(f"     ⚠️  警告: 图片可能是全透明的")
                else:
                    print(f"     ✅ 图片包含内容")
            
        except Exception as e:
            print(f"  {i}. {filename} - ❌ 读取失败: {e}")
    
    print(f"\n📊 总共检查了 {min(5, len(files))} 个文件")


if __name__ == "__main__":
    test_image_content()
