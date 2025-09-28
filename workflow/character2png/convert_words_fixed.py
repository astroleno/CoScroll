#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
修复版本的字体转换脚本
解决字体加载和大小问题
"""

import os
from PIL import Image, ImageDraw, ImageFont
import sys


def create_text_image_fixed(text, font_size=400, image_size=(1024, 1024), 
                          text_color='black', background_color='white'):
    """
    创建文字图片 - 修复版本
    """
    try:
        # 创建图片
        if background_color == 'transparent':
            image = Image.new('RGBA', image_size, (0, 0, 0, 0))
        else:
            image = Image.new('RGB', image_size, background_color)
        
        # 创建绘图对象
        draw = ImageDraw.Draw(image)
        
        # 尝试加载字体
        font = None
        font_candidates = [
            '演示悠然小楷 Regular',
            'slideyouran Regular', 
            '演示悠然小楷',
            'slideyouran',
            'YanShiYouRanXiaoKai-2.ttf'
        ]
        
        # 尝试加载指定字体
        for font_name in font_candidates:
            try:
                font = ImageFont.truetype(font_name, font_size)
                print(f"✅ 使用字体: {font_name}")
                break
            except:
                continue
        
        # 如果所有字体都失败，使用默认字体
        if font is None:
            try:
                # 尝试使用系统默认字体
                font = ImageFont.truetype("arial.ttf", font_size)
                print("✅ 使用系统默认字体: arial.ttf")
            except:
                try:
                    font = ImageFont.truetype("simhei.ttf", font_size)  # 黑体
                    print("✅ 使用黑体字体")
                except:
                    try:
                        font = ImageFont.truetype("simsun.ttc", font_size)  # 宋体
                        print("✅ 使用宋体字体")
                    except:
                        # 最后使用PIL默认字体
                        font = ImageFont.load_default()
                        print("⚠️  使用PIL默认字体（可能显示效果不佳）")
        
        # 计算文字位置
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        
        # 居中计算
        x = (image_size[0] - text_width) // 2
        y = (image_size[1] - text_height) // 2
        
        # 绘制文字
        draw.text((x, y), text, font=font, fill=text_color)
        
        return image
        
    except Exception as e:
        print(f"❌ 创建图片失败: {e}")
        # 创建一个错误提示图片
        error_image = Image.new('RGB', image_size, 'red')
        draw = ImageDraw.Draw(error_image)
        try:
            default_font = ImageFont.load_default()
            draw.text((50, 50), f"Error: {text}", font=default_font, fill='white')
        except:
            pass
        return error_image


def convert_20_words_fixed():
    """转换20个字 - 修复版本"""
    print("🚀 开始转换20个字 (修复版本)...")
    
    # 加载文字
    try:
        with open('words_20.txt', 'r', encoding='utf-8') as f:
            content = f.read().strip()
        text_list = [line.strip() for line in content.split('\n') if line.strip()]
        print(f"📖 加载了 {len(text_list)} 个文字")
    except Exception as e:
        print(f"❌ 加载文字文件失败: {e}")
        return
    
    # 显示文字列表
    print("\n📋 文字列表:")
    for i, word in enumerate(text_list, 1):
        print(f"  {i:2d}. {word}")
    
    # 创建输出目录
    output_dir = 'words_1024_fixed'
    os.makedirs(output_dir, exist_ok=True)
    
    print(f"\n🎨 开始生成1024x1024图片...")
    print(f"📏 字体大小: 400 (适应1024x1024画布)")
    
    generated_files = []
    
    # 逐个生成
    for i, word in enumerate(text_list, 1):
        try:
            print(f"🔄 正在生成第 {i} 个字: {word}")
            
            # 创建图片
            image = create_text_image_fixed(
                text=word,
                font_size=400,  # 增大字体
                image_size=(1024, 1024),
                text_color='black',
                background_color='white'
            )
            
            # 自定义文件名格式：001_X.png
            filename = f"{i:03d}_{word}.png"
            filepath = os.path.join(output_dir, filename)
            
            # 保存图片
            image.save(filepath, "PNG")
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
    convert_20_words_fixed()
