#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
使用matplotlib生成文字图片的脚本
解决中文字体显示问题
"""

import os
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
from matplotlib import font_manager
import numpy as np


def find_chinese_font():
    """查找可用的中文字体"""
    # 获取所有字体
    fonts = [f.name for f in fm.fontManager.ttflist]
    
    # 中文字体候选
    chinese_fonts = [
        'Microsoft YaHei',
        'Microsoft YaHei UI', 
        'SimHei',
        'SimSun',
        'KaiTi',
        'FangSong',
        'STHeiti',
        'STSong',
        'STKaiti',
        'STFangsong',
        'STSong',
        'STHeiti',
        'WenQuanYi Micro Hei',
        'WenQuanYi Zen Hei',
        'Noto Sans CJK SC',
        'Source Han Sans SC',
        'Source Han Serif SC'
    ]
    
    print("🔍 正在查找中文字体...")
    for font_name in chinese_fonts:
        if font_name in fonts:
            print(f"✅ 找到中文字体: {font_name}")
            return font_name
    
    print("❌ 未找到中文字体，将使用默认字体")
    return None


def create_text_image_matplotlib(text, font_name=None, font_size=400, image_size=(1024, 1024)):
    """使用matplotlib创建文字图片"""
    try:
        # 创建图形
        fig, ax = plt.subplots(figsize=(image_size[0]/100, image_size[1]/100), dpi=100)
        
        # 设置字体
        if font_name:
            try:
                plt.rcParams['font.sans-serif'] = [font_name]
                plt.rcParams['axes.unicode_minus'] = False
                print(f"✅ 使用字体: {font_name}")
            except:
                print(f"⚠️  字体 {font_name} 设置失败，使用默认字体")
        
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
        
        # 保存图片
        plt.tight_layout()
        
        return fig, ax
        
    except Exception as e:
        print(f"❌ 创建图片失败: {e}")
        return None, None


def convert_20_words_matplotlib():
    """使用matplotlib转换20个字"""
    print("🚀 开始转换20个字 (matplotlib版本)...")
    
    # 加载文字
    try:
        with open('words_20.txt', 'r', encoding='utf-8') as f:
            content = f.read().strip()
        text_list = [line.strip() for line in content.split('\n') if line.strip()]
        print(f"📖 加载了 {len(text_list)} 个文字")
    except Exception as e:
        print(f"❌ 加载文字文件失败: {e}")
        return
    
    # 查找中文字体
    font_name = find_chinese_font()
    
    # 创建输出目录
    output_dir = 'words_1024_matplotlib'
    os.makedirs(output_dir, exist_ok=True)
    
    print(f"\n🎨 开始生成1024x1024图片...")
    print(f"📏 字体大小: 400像素")
    
    generated_files = []
    
    # 逐个生成
    for i, word in enumerate(text_list, 1):
        try:
            print(f"\n🔄 正在生成第 {i} 个字: {word}")
            
            # 创建图片
            fig, ax = create_text_image_matplotlib(
                text=word,
                font_name=font_name,
                font_size=400,
                image_size=(1024, 1024)
            )
            
            if fig is None:
                print(f"❌ 第 {i} 个字生成失败")
                continue
            
            # 自定义文件名格式：001_X.png
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


if __name__ == "__main__":
    convert_20_words_matplotlib()
