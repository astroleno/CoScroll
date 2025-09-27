#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
最终版本 - 使用用户提供的字体，固定输出目录
"""

import os
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
from matplotlib import font_manager
import numpy as np


def find_user_font():
    """查找用户提供的字体"""
    # 用户提供的字体名称
    user_fonts = [
        '演示悠然小楷 Regular',
        'slideyouran Regular', 
        '演示悠然小楷',
        'slideyouran'
    ]
    
    # 获取所有可用字体
    all_fonts = [f.name for f in fm.fontManager.ttflist]
    
    print("🔍 正在查找用户指定的字体...")
    for font_name in user_fonts:
        if font_name in all_fonts:
            print(f"✅ 找到用户字体: {font_name}")
            return font_name
    
    print("❌ 未找到用户指定的字体")
    print("📋 可用的字体列表:")
    for font in all_fonts[:20]:  # 显示前20个字体
        print(f"  - {font}")
    
    return None


def create_text_image_final(text, font_name=None, font_size=400, image_size=(1024, 1024)):
    """使用用户字体创建文字图片"""
    try:
        # 创建图形
        fig, ax = plt.subplots(figsize=(image_size[0]/100, image_size[1]/100), dpi=100)
        
        # 设置用户指定的字体
        if font_name:
            try:
                plt.rcParams['font.sans-serif'] = [font_name]
                plt.rcParams['axes.unicode_minus'] = False
                print(f"✅ 使用用户字体: {font_name}")
            except:
                print(f"⚠️  用户字体 {font_name} 设置失败，使用默认字体")
        else:
            print("⚠️  使用系统默认字体")
        
        # 隐藏坐标轴
        ax.set_xlim(0, 1)
        ax.set_ylim(0, 1)
        ax.axis('off')
        
        # 设置背景为白色
        fig.patch.set_facecolor('white')
        ax.set_facecolor('white')
        
        # 绘制文字
        ax.text(0.5, 0.5, text, 
               fontsize=font_size, 
               ha='center', 
               va='center',
               color='black',
               fontweight='bold')
        
        return fig, ax
        
    except Exception as e:
        print(f"❌ 创建图片失败: {e}")
        return None, None


def convert_20_words_final():
    """最终转换 - 使用用户字体，固定输出目录"""
    print("🚀 开始转换20个字 (使用用户字体版本)...")
    
    # 加载文字
    try:
        with open('words_20.txt', 'r', encoding='utf-8') as f:
            content = f.read().strip()
        text_list = [line.strip() for line in content.split('\n') if line.strip()]
        print(f"📖 加载了 {len(text_list)} 个文字")
    except Exception as e:
        print(f"❌ 加载文字文件失败: {e}")
        return
    
    # 查找用户字体
    user_font = find_user_font()
    
    # 使用固定的输出目录
    output_dir = 'words_output'  # 固定目录名
    os.makedirs(output_dir, exist_ok=True)
    
    print(f"\n🎨 开始生成1024x1024图片...")
    print(f"📏 字体大小: 400像素")
    print(f"📁 输出目录: {output_dir}")
    
    generated_files = []
    
    # 逐个生成
    for i, word in enumerate(text_list, 1):
        try:
            print(f"\n🔄 正在生成第 {i} 个字: {word}")
            
            # 创建图片
            fig, ax = create_text_image_final(
                text=word,
                font_name=user_font,
                font_size=400,
                image_size=(1024, 1024)
            )
            
            if fig is None:
                print(f"❌ 第 {i} 个字生成失败")
                continue
            
            # 固定文件名格式：001_X.png
            filename = f"{i:03d}_{word}.png"
            filepath = os.path.join(output_dir, filename)
            
            # 保存图片
            fig.savefig(filepath, 
                       dpi=100, 
                       bbox_inches='tight', 
                       pad_inches=0,
                       facecolor='white',
                       edgecolor='none')
            
            # 关闭图形以释放内存
            plt.close(fig)
            
            generated_files.append(filepath)
            print(f"✅ 已生成: {filename}")
            
        except Exception as e:
            print(f"❌ 生成第 {i} 个文字失败: {word} - {e}")
            continue
    
    print(f"\n🎉 转换完成！生成了 {len(generated_files)} 个文件")
    print("\n📁 生成的文件:")
    for i, file_path in enumerate(generated_files, 1):
        filename = os.path.basename(file_path)
        word = text_list[i-1] if i <= len(text_list) else "未知"
        print(f"  {i:2d}. {filename} (第{i}个字: {word})")
    
    print(f"\n📂 输出目录: {os.path.abspath(output_dir)}")
    print(f"📏 图片规格: 1024x1024像素")
    print(f"🔤 字体大小: 400像素")
    if user_font:
        print(f"🎨 使用字体: {user_font}")
    else:
        print(f"⚠️  使用系统默认字体")


if __name__ == "__main__":
    convert_20_words_final()
