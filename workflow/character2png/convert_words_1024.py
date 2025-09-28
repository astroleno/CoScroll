#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
专门用于转换20个字的脚本 - 1024x1024规格
"""

from font_to_png import FontToPNGConverter, load_text_from_file
import os
from PIL import ImageFont


def find_font():
    """查找可用的字体"""
    font_candidates = [
        '演示悠然小楷 Regular',
        'slideyouran Regular', 
        '演示悠然小楷',
        'slideyouran',
        'YanShiYouRanXiaoKai-2.ttf'
    ]
    
    print("🔍 正在查找可用字体...")
    
    for font_name in font_candidates:
        try:
            font = ImageFont.truetype(font_name, 200)  # 增大字体以适应1024x1024
            print(f"✅ 找到字体: {font_name}")
            return font_name
        except Exception as e:
            print(f"❌ 字体 {font_name} 不可用")
    
    print("⚠️  未找到指定字体，将使用默认字体")
    return None


def convert_20_words_1024():
    """转换20个字 - 1024x1024规格"""
    print("🚀 开始转换20个字 (1024x1024规格)...")
    
    # 查找字体
    font_name = find_font()
    
    # 加载文字
    text_list = load_text_from_file('words_20.txt')
    print(f"📖 加载了 {len(text_list)} 个文字")
    
    # 显示文字列表（带编号）
    print("\n📋 文字列表（按顺序编号）:")
    for i, word in enumerate(text_list, 1):
        print(f"  {i:2d}. {word}")
    
    try:
        # 创建转换器 - 使用更大的字体
        if font_name:
            converter = FontToPNGConverter(font_name, font_size=200)
        else:
            # 使用默认字体
            converter = FontToPNGConverter("", font_size=200)
        
        # 创建输出目录
        output_dir = 'words_1024_output'
        os.makedirs(output_dir, exist_ok=True)
        
        print(f"\n🎨 开始生成1024x1024图片...")
        
        generated_files = []
        
        # 逐个生成，使用自定义命名
        for i, word in enumerate(text_list, 1):
            try:
                # 创建图片
                image = converter.create_text_image(
                    text=word,
                    image_size=(1024, 1024),
                    text_color='black',
                    background_color='white',
                    text_position='center'
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
        
    except Exception as e:
        print(f"❌ 转换失败: {e}")


if __name__ == "__main__":
    convert_20_words_1024()
