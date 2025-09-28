#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
终极修复版本的字体转换脚本
解决字体加载和中文显示问题
"""

import os
from PIL import Image, ImageDraw, ImageFont
import sys


def get_system_fonts():
    """获取系统可用字体"""
    import matplotlib.font_manager as fm
    
    # 获取所有字体
    fonts = [f.name for f in fm.fontManager.ttflist]
    
    # 查找中文字体
    chinese_fonts = []
    for font in fonts:
        if any(keyword in font.lower() for keyword in ['sim', 'hei', 'song', 'kai', 'ming', 'chinese', 'cjk']):
            chinese_fonts.append(font)
    
    return chinese_fonts


def create_text_image_ultimate(text, font_size=400, image_size=(1024, 1024)):
    """
    创建文字图片 - 终极版本
    """
    try:
        # 创建白色背景图片
        image = Image.new('RGB', image_size, 'white')
        draw = ImageDraw.Draw(image)
        
        # 字体候选列表（按优先级排序）
        font_candidates = [
            # 中文字体
            'SimHei',  # 黑体
            'SimSun',  # 宋体
            'Microsoft YaHei',  # 微软雅黑
            'Microsoft YaHei UI',
            'KaiTi',  # 楷体
            'FangSong',  # 仿宋
            'STHeiti',  # 华文黑体
            'STSong',  # 华文宋体
            # 英文字体（作为备选）
            'Arial',
            'Times New Roman',
            'Calibri'
        ]
        
        font = None
        used_font = None
        
        # 尝试加载字体
        for font_name in font_candidates:
            try:
                font = ImageFont.truetype(font_name, font_size)
                used_font = font_name
                print(f"✅ 成功加载字体: {font_name}")
                break
            except Exception as e:
                print(f"❌ 字体 {font_name} 加载失败: {e}")
                continue
        
        # 如果所有字体都失败，使用默认字体
        if font is None:
            try:
                font = ImageFont.load_default()
                used_font = "PIL默认字体"
                print("⚠️  使用PIL默认字体")
            except:
                print("❌ 无法加载任何字体")
                return None
        
        # 计算文字位置
        try:
            # 使用textbbox获取文字边界
            bbox = draw.textbbox((0, 0), text, font=font)
            text_width = bbox[2] - bbox[0]
            text_height = bbox[3] - bbox[1]
        except:
            # 如果textbbox失败，使用textsize
            try:
                text_width, text_height = draw.textsize(text, font=font)
            except:
                # 如果都失败，使用估算值
                text_width = font_size
                text_height = font_size
        
        # 居中计算
        x = (image_size[0] - text_width) // 2
        y = (image_size[1] - text_height) // 2
        
        # 绘制文字
        try:
            draw.text((x, y), text, font=font, fill='black')
            print(f"✅ 文字 '{text}' 绘制成功，使用字体: {used_font}")
        except Exception as e:
            print(f"❌ 绘制文字失败: {e}")
            # 绘制错误信息
            draw.text((50, 50), f"Error: {text}", font=font, fill='red')
        
        return image
        
    except Exception as e:
        print(f"❌ 创建图片失败: {e}")
        # 创建错误图片
        error_image = Image.new('RGB', image_size, 'red')
        draw = ImageDraw.Draw(error_image)
        try:
            default_font = ImageFont.load_default()
            draw.text((50, 50), f"Error: {text}", font=default_font, fill='white')
        except:
            pass
        return error_image


def convert_20_words_ultimate():
    """转换20个字 - 终极版本"""
    print("🚀 开始转换20个字 (终极修复版本)...")
    
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
    output_dir = 'words_1024_ultimate'
    os.makedirs(output_dir, exist_ok=True)
    
    print(f"\n🎨 开始生成1024x1024图片...")
    print(f"📏 字体大小: 400像素")
    
    generated_files = []
    
    # 逐个生成
    for i, word in enumerate(text_list, 1):
        try:
            print(f"\n🔄 正在生成第 {i} 个字: {word}")
            
            # 创建图片
            image = create_text_image_ultimate(
                text=word,
                font_size=400,
                image_size=(1024, 1024)
            )
            
            if image is None:
                print(f"❌ 第 {i} 个字生成失败")
                continue
            
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
    convert_20_words_ultimate()
