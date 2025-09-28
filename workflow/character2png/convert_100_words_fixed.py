#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
100个字批量生成 - 使用重新排序的文件，完美居中，透明背景，字体填充更满
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


def convert_100_words_fixed():
    """转换100个字 - 使用重新排序的文件，完美居中，透明背景，字体填充更满"""
    print("🚀 开始转换100个字 (重新排序版本)...")
    
    # 加载重新排序的文字文件
    try:
        with open('words_100_fixed.txt', 'r', encoding='utf-8') as f:
            content = f.read().strip()
        text_list = [line.strip() for line in content.split('\n') if line.strip()]
        print(f"📖 加载了 {len(text_list)} 个文字")
    except Exception as e:
        print(f"❌ 加载文字文件失败: {e}")
        return
    
    # 查找用户字体
    user_font = find_user_font()
    
    # 使用固定的输出目录
    output_dir = 'words_100_output'
    os.makedirs(output_dir, exist_ok=True)
    
    print(f"\n🎨 开始生成1024x1024透明背景图片...")
    print(f"📏 字体大小: 600像素 (更大，填充更满)")
    print(f"🎨 背景: 透明")
    print(f"📍 文字位置: 完美居中")
    print(f"📁 输出目录: {output_dir}")
    print(f"📊 总数量: {len(text_list)} 个字")
    
    # 显示前20个字的顺序（确认与20个字文件一致）
    print(f"\n📋 前20个字顺序:")
    for i in range(min(20, len(text_list))):
        print(f"  {i+1:2d}. {text_list[i]}")
    
    generated_files = []
    failed_count = 0
    
    # 逐个生成
    for i, word in enumerate(text_list, 1):
        try:
            if i % 10 == 1:  # 每10个字显示一次进度
                print(f"\n🔄 正在生成第 {i}-{min(i+9, len(text_list))} 个字...")
            
            # 创建图片
            fig, ax = create_text_image_centered(
                text=word,
                font_name=user_font,
                font_size=600,  # 增大字体
                image_size=(1024, 1024)
            )
            
            if fig is None:
                print(f"❌ 第 {i} 个字生成失败: {word}")
                failed_count += 1
                continue
            
            # 固定文件名格式：001_X.png
            filename = f"{i:03d}_{word}.png"
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
            
            generated_files.append(filepath)
            
            if i % 10 == 0:  # 每10个字显示一次进度
                print(f"✅ 已完成 {i}/{len(text_list)} 个字")
            
        except Exception as e:
            print(f"❌ 生成第 {i} 个文字失败: {word} - {e}")
            failed_count += 1
            continue
    
    print(f"\n🎉 转换完成！")
    print(f"✅ 成功生成: {len(generated_files)} 个文件")
    print(f"❌ 失败数量: {failed_count} 个")
    print(f"📊 成功率: {len(generated_files)/len(text_list)*100:.1f}%")
    
    print(f"\n📂 输出目录: {os.path.abspath(output_dir)}")
    print(f"📏 图片规格: 1024x1024像素")
    print(f"🔤 字体大小: 600像素 (更大，填充更满)")
    print(f"🎨 背景: 透明")
    print(f"📍 文字位置: 完美居中")
    if user_font:
        print(f"🎨 使用字体: {user_font}")
    else:
        print(f"⚠️  使用系统默认字体")
    
    # 显示前20个生成的文件（确认顺序）
    print(f"\n📁 前20个生成的文件 (确认顺序):")
    for i, file_path in enumerate(generated_files[:20], 1):
        filename = os.path.basename(file_path)
        word = text_list[i-1] if i <= len(text_list) else "未知"
        print(f"  {i:2d}. {filename} (第{i}个字: {word})")
    
    if len(generated_files) > 20:
        print(f"  ... 还有 {len(generated_files)-20} 个文件")


if __name__ == "__main__":
    convert_100_words_fixed()
