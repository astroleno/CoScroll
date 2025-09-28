#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
单独生成一个字 - 色
"""

import os
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
from matplotlib import font_manager
import numpy as np


def find_user_font():
    """查找用户提供的字体"""
    user_fonts = [
        '演示悠然小楷 Regular',
        'slideyouran Regular', 
        '演示悠然小楷',
        'slideyouran'
    ]
    
    all_fonts = [f.name for f in fm.fontManager.ttflist]
    
    print("🔍 正在查找用户指定的字体...")
    for font_name in user_fonts:
        if font_name in all_fonts:
            print(f"✅ 找到用户字体: {font_name}")
            return font_name
    
    print("❌ 未找到用户指定的字体")
    return None


def create_text_image_centered(text, font_name=None, font_size=600, image_size=(1024, 1024)):
    """创建完美居中的透明背景文字图片"""
    try:
        # 创建图形 - 确保尺寸正确
        fig, ax = plt.subplots(figsize=(image_size[0]/100, image_size[1]/100), dpi=100)
        
        # 设置用户指定的字体
        if font_name:
            try:
                plt.rcParams['font.sans-serif'] = [font_name]
                plt.rcParams['axes.unicode_minus'] = False
            except:
                pass
        
        # 设置坐标轴范围 - 确保完全覆盖画布
        ax.set_xlim(0, image_size[0])
        ax.set_ylim(0, image_size[1])
        ax.axis('off')
        
        # 设置透明背景
        fig.patch.set_facecolor('none')
        ax.set_facecolor('none')
        
        # 计算完美居中位置
        center_x = image_size[0] / 2
        center_y = image_size[1] / 2
        
        # 绘制文字 - 完美居中
        ax.text(center_x, center_y, text, 
               fontsize=font_size,
               ha='center',  # 水平居中
               va='center',  # 垂直居中
               color='black',
               fontweight='bold',
               transform=ax.transData)  # 使用数据坐标
        
        return fig, ax
        
    except Exception as e:
        print(f"❌ 创建图片失败: {e}")
        return None, None


def generate_single_word():
    """生成单个字 - 色"""
    print("🚀 开始生成单个字: 色")
    
    # 查找用户字体
    user_font = find_user_font()
    
    # 创建输出目录
    output_dir = 'single_word_output'
    os.makedirs(output_dir, exist_ok=True)
    
    print(f"\n🎨 开始生成1024x1024透明背景图片...")
    print(f"📏 字体大小: 600像素 (更大，填充更满)")
    print(f"🎨 背景: 透明")
    print(f"📍 文字位置: 完美居中")
    print(f"📁 输出目录: {output_dir}")
    
    try:
        # 创建图片
        fig, ax = create_text_image_centered(
            text="色",
            font_name=user_font,
            font_size=600,
            image_size=(1024, 1024)
        )
        
        if fig is None:
            print(f"❌ 生成失败")
            return
        
        # 文件名
        filename = "色.png"
        filepath = os.path.join(output_dir, filename)
        
        # 保存图片 - 透明背景，确保居中
        fig.savefig(filepath, 
                   dpi=100, 
                   bbox_inches='tight', 
                   pad_inches=0,
                   facecolor='none',  # 透明背景
                   edgecolor='none',
                   transparent=True)  # 确保透明
        
        # 关闭图形以释放内存
        plt.close(fig)
        
        print(f"✅ 已生成: {filename}")
        
        print(f"\n🎉 生成完成！")
        print(f"📂 输出目录: {os.path.abspath(output_dir)}")
        print(f"📏 图片规格: 1024x1024像素")
        print(f"🔤 字体大小: 600像素 (更大，填充更满)")
        print(f"🎨 背景: 透明")
        print(f"📍 文字位置: 完美居中")
        if user_font:
            print(f"🎨 使用字体: {user_font}")
        else:
            print(f"⚠️  使用系统默认字体")
        
    except Exception as e:
        print(f"❌ 生成失败: {e}")


if __name__ == "__main__":
    generate_single_word()
