#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
专门用于转换20个字的脚本
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
            font = ImageFont.truetype(font_name, 64)
            print(f"✅ 找到字体: {font_name}")
            return font_name
        except Exception as e:
            print(f"❌ 字体 {font_name} 不可用")
    
    print("⚠️  未找到指定字体，将使用默认字体")
    return None


def convert_20_words():
    """转换20个字"""
    print("🚀 开始转换20个字...")
    
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
        # 创建转换器
        if font_name:
            converter = FontToPNGConverter(font_name, font_size=100)
        else:
            # 使用默认字体
            converter = FontToPNGConverter("", font_size=100)
        
        # 批量转换
        generated_files = converter.batch_convert(
            text_list=text_list,
            output_dir='words_output',
            image_size=(200, 200),
            text_color='black',
            background_color='white',
            text_position='center',
            filename_prefix='word'
        )
        
        print(f"\n🎉 转换完成！生成了 {len(generated_files)} 个文件")
        print("\n📁 生成的文件:")
        for i, file_path in enumerate(generated_files, 1):
            filename = os.path.basename(file_path)
            word_index = i
            word = text_list[i-1] if i <= len(text_list) else "未知"
            print(f"  {i:2d}. {filename} (第{word_index}个字: {word})")
        
        print(f"\n📂 输出目录: {os.path.abspath('words_output')}")
        
    except Exception as e:
        print(f"❌ 转换失败: {e}")


if __name__ == "__main__":
    convert_20_words()
