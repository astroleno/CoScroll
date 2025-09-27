#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
字体转PNG工具 - 示例运行脚本
演示如何使用FontToPNGConverter类
"""

import os
from font_to_png import FontToPNGConverter, load_text_from_file


def demo_single_text():
    """演示单个文字转换"""
    print("=" * 50)
    print("🎯 演示1：单个文字转换")
    print("=" * 50)
    
    # 假设字体文件在当前目录
    font_path = "YanShiYouRanXiaoKai-2.ttf"
    
    if not os.path.exists(font_path):
        print(f"❌ 字体文件不存在: {font_path}")
        print("请将字体文件放在当前目录下")
        return
    
    try:
        # 创建转换器
        converter = FontToPNGConverter(font_path, font_size=72)
        
        # 生成单个文字图片
        image = converter.create_text_image(
            text="你好世界",
            image_size=(200, 200),
            text_color="red",
            background_color="white",
            text_position="center"
        )
        
        # 保存图片
        output_path = "demo_single.png"
        image.save(output_path, "PNG")
        print(f"✅ 单个文字图片已生成: {output_path}")
        
    except Exception as e:
        print(f"❌ 单个文字转换失败: {e}")


def demo_batch_convert():
    """演示批量转换"""
    print("\n" + "=" * 50)
    print("🎯 演示2：批量转换")
    print("=" * 50)
    
    font_path = "YanShiYouRanXiaoKai-2.ttf"
    
    if not os.path.exists(font_path):
        print(f"❌ 字体文件不存在: {font_path}")
        return
    
    try:
        # 创建转换器
        converter = FontToPNGConverter(font_path, font_size=64)
        
        # 准备文字列表
        text_list = ["Python", "字体", "PNG", "批量", "转换"]
        
        # 批量转换
        generated_files = converter.batch_convert(
            text_list=text_list,
            output_dir="demo_output",
            image_size=(150, 150),
            text_color="blue",
            background_color="transparent",
            text_position="center",
            filename_prefix="demo"
        )
        
        print(f"✅ 批量转换完成，生成了 {len(generated_files)} 个文件")
        for file_path in generated_files:
            print(f"   📄 {file_path}")
            
    except Exception as e:
        print(f"❌ 批量转换失败: {e}")


def demo_from_file():
    """演示从文件读取文字"""
    print("\n" + "=" * 50)
    print("🎯 演示3：从文件读取文字")
    print("=" * 50)
    
    font_path = "YanShiYouRanXiaoKai-2.ttf"
    text_file = "example_text.txt"
    
    if not os.path.exists(font_path):
        print(f"❌ 字体文件不存在: {font_path}")
        return
        
    if not os.path.exists(text_file):
        print(f"❌ 文字文件不存在: {text_file}")
        return
    
    try:
        # 从文件加载文字
        text_list = load_text_from_file(text_file)
        print(f"📖 从文件加载了 {len(text_list)} 个文字")
        
        # 创建转换器
        converter = FontToPNGConverter(font_path, font_size=80)
        
        # 批量转换
        generated_files = converter.batch_convert(
            text_list=text_list,
            output_dir="file_output",
            image_size=(200, 200),
            text_color="green",
            background_color="white",
            text_position="center",
            filename_prefix="file"
        )
        
        print(f"✅ 从文件批量转换完成，生成了 {len(generated_files)} 个文件")
        
    except Exception as e:
        print(f"❌ 从文件转换失败: {e}")


def demo_different_styles():
    """演示不同样式"""
    print("\n" + "=" * 50)
    print("🎯 演示4：不同样式效果")
    print("=" * 50)
    
    font_path = "YanShiYouRanXiaoKai-2.ttf"
    
    if not os.path.exists(font_path):
        print(f"❌ 字体文件不存在: {font_path}")
        return
    
    try:
        converter = FontToPNGConverter(font_path, font_size=60)
        
        # 不同样式的配置
        styles = [
            {"color": "red", "bg": "white", "pos": "center", "name": "红色白底居中"},
            {"color": "blue", "bg": "transparent", "pos": "center", "name": "蓝色透明底"},
            {"color": "green", "bg": "yellow", "pos": "left", "name": "绿色黄底左对齐"},
            {"color": "purple", "bg": "lightgray", "pos": "right", "name": "紫色灰底右对齐"},
        ]
        
        for i, style in enumerate(styles):
            image = converter.create_text_image(
                text="样式测试",
                image_size=(180, 180),
                text_color=style["color"],
                background_color=style["bg"],
                text_position=style["pos"]
            )
            
            filename = f"style_{i+1}_{style['name']}.png"
            image.save(filename, "PNG")
            print(f"✅ 已生成: {filename}")
            
    except Exception as e:
        print(f"❌ 样式演示失败: {e}")


def main():
    """主函数"""
    print("🚀 字体转PNG工具 - 演示程序")
    print("=" * 50)
    
    # 检查字体文件
    font_path = "YanShiYouRanXiaoKai-2.ttf"
    if not os.path.exists(font_path):
        print(f"❌ 请将字体文件 {font_path} 放在当前目录下")
        print("然后重新运行此演示程序")
        return
    
    # 运行各种演示
    demo_single_text()
    demo_batch_convert()
    demo_from_file()
    demo_different_styles()
    
    print("\n" + "=" * 50)
    print("🎉 所有演示完成！")
    print("📁 请查看生成的图片文件")
    print("=" * 50)


if __name__ == "__main__":
    main()
