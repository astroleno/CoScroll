#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
字体转PNG工具
支持批量将字体文件转换为文字PNG图片
"""

import os
import sys
from PIL import Image, ImageDraw, ImageFont
from typing import List, Tuple, Optional, Dict, Any
import argparse
import json


class FontToPNGConverter:
    """字体转PNG转换器"""
    
    def __init__(self, font_path: str, font_size: int = 64):
        """
        初始化转换器
        
        Args:
            font_path: 字体文件路径
            font_size: 字体大小，默认64
        """
        self.font_path = font_path
        self.font_size = font_size
        self.font = None
        
        # 加载字体
        self._load_font()
    
    def _load_font(self):
        """加载字体文件"""
        try:
            if not os.path.exists(self.font_path):
                raise FileNotFoundError(f"字体文件不存在: {self.font_path}")
            
            self.font = ImageFont.truetype(self.font_path, self.font_size)
            print(f"✅ 成功加载字体: {self.font_path}, 大小: {self.font_size}")
            
        except Exception as e:
            print(f"❌ 加载字体失败: {e}")
            # 如果字体加载失败，使用默认字体
            try:
                self.font = ImageFont.load_default()
                print("⚠️  使用默认字体")
            except:
                raise Exception("无法加载任何字体")
    
    def create_text_image(self, text: str, 
                        image_size: Tuple[int, int] = (128, 128),
                        text_color: str = "black",
                        background_color: str = "white",
                        text_position: str = "center") -> Image.Image:
        """
        创建文字图片
        
        Args:
            text: 要渲染的文字
            image_size: 图片尺寸 (宽度, 高度)
            text_color: 文字颜色
            background_color: 背景颜色，None表示透明背景
            text_position: 文字位置 ("center", "left", "right", "top", "bottom")
        
        Returns:
            PIL Image对象
        """
        try:
            # 创建图片
            if background_color is None:
                # 透明背景
                image = Image.new('RGBA', image_size, (0, 0, 0, 0))
            else:
                # 纯色背景
                image = Image.new('RGB', image_size, background_color)
            
            # 创建绘图对象
            draw = ImageDraw.Draw(image)
            
            # 计算文字位置
            bbox = draw.textbbox((0, 0), text, font=self.font)
            text_width = bbox[2] - bbox[0]
            text_height = bbox[3] - bbox[1]
            
            # 根据位置参数计算坐标
            if text_position == "center":
                x = (image_size[0] - text_width) // 2
                y = (image_size[1] - text_height) // 2
            elif text_position == "left":
                x = 10
                y = (image_size[1] - text_height) // 2
            elif text_position == "right":
                x = image_size[0] - text_width - 10
                y = (image_size[1] - text_height) // 2
            elif text_position == "top":
                x = (image_size[0] - text_width) // 2
                y = 10
            elif text_position == "bottom":
                x = (image_size[0] - text_width) // 2
                y = image_size[1] - text_height - 10
            else:
                x = (image_size[0] - text_width) // 2
                y = (image_size[1] - text_height) // 2
            
            # 绘制文字
            draw.text((x, y), text, font=self.font, fill=text_color)
            
            return image
            
        except Exception as e:
            print(f"❌ 创建文字图片失败: {e}")
            raise
    
    def batch_convert(self, 
                     text_list: List[str], 
                     output_dir: str,
                     image_size: Tuple[int, int] = (128, 128),
                     text_color: str = "black",
                     background_color: str = "white",
                     text_position: str = "center",
                     filename_prefix: str = "text") -> List[str]:
        """
        批量转换文字为PNG图片
        
        Args:
            text_list: 文字列表
            output_dir: 输出目录
            image_size: 图片尺寸
            text_color: 文字颜色
            background_color: 背景颜色
            text_position: 文字位置
            filename_prefix: 文件名前缀
        
        Returns:
            生成的图片文件路径列表
        """
        try:
            # 创建输出目录
            os.makedirs(output_dir, exist_ok=True)
            
            generated_files = []
            
            print(f"🚀 开始批量转换，共 {len(text_list)} 个文字...")
            
            for i, text in enumerate(text_list):
                try:
                    # 创建图片
                    image = self.create_text_image(
                        text=text,
                        image_size=image_size,
                        text_color=text_color,
                        background_color=background_color,
                        text_position=text_position
                    )
                    
                    # 生成文件名（处理特殊字符）
                    safe_text = "".join(c for c in text if c.isalnum() or c in (' ', '-', '_')).strip()
                    if not safe_text:
                        safe_text = f"char_{i+1}"
                    
                    filename = f"{filename_prefix}_{safe_text}_{i+1:03d}.png"
                    filepath = os.path.join(output_dir, filename)
                    
                    # 保存图片
                    image.save(filepath, "PNG")
                    generated_files.append(filepath)
                    
                    print(f"✅ 已生成: {filename}")
                    
                except Exception as e:
                    print(f"❌ 生成第 {i+1} 个文字失败: {text} - {e}")
                    continue
            
            print(f"🎉 批量转换完成！共生成 {len(generated_files)} 个图片文件")
            return generated_files
            
        except Exception as e:
            print(f"❌ 批量转换失败: {e}")
            raise


def load_text_from_file(file_path: str) -> List[str]:
    """
    从文件加载文字列表
    
    Args:
        file_path: 文件路径
    
    Returns:
        文字列表
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read().strip()
            
        # 按行分割，过滤空行
        text_list = [line.strip() for line in content.split('\n') if line.strip()]
        
        print(f"📖 从文件加载了 {len(text_list)} 个文字")
        return text_list
        
    except Exception as e:
        print(f"❌ 加载文件失败: {e}")
        raise


def save_config(config: Dict[str, Any], file_path: str):
    """保存配置到JSON文件"""
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(config, f, ensure_ascii=False, indent=2)
        print(f"💾 配置已保存到: {file_path}")
    except Exception as e:
        print(f"❌ 保存配置失败: {e}")


def load_config(file_path: str) -> Dict[str, Any]:
    """从JSON文件加载配置"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
        print(f"📖 配置已加载: {file_path}")
        return config
    except Exception as e:
        print(f"❌ 加载配置失败: {e}")
        return {}


def main():
    """主函数 - 命令行界面"""
    parser = argparse.ArgumentParser(description='字体转PNG工具')
    
    # 必需参数
    parser.add_argument('font_path', help='字体文件路径')
    parser.add_argument('text_source', help='文字来源：文件路径或直接输入的文字')
    
    # 可选参数
    parser.add_argument('-o', '--output', default='output', help='输出目录 (默认: output)')
    parser.add_argument('-s', '--size', type=int, default=64, help='字体大小 (默认: 64)')
    parser.add_argument('-w', '--width', type=int, default=128, help='图片宽度 (默认: 128)')
    parser.add_argument('-h', '--height', type=int, default=128, help='图片高度 (默认: 128)')
    parser.add_argument('-c', '--color', default='black', help='文字颜色 (默认: black)')
    parser.add_argument('-b', '--background', default='white', help='背景颜色，使用"transparent"表示透明 (默认: white)')
    parser.add_argument('-p', '--position', default='center', 
                       choices=['center', 'left', 'right', 'top', 'bottom'],
                       help='文字位置 (默认: center)')
    parser.add_argument('--prefix', default='text', help='文件名前缀 (默认: text)')
    parser.add_argument('--config', help='配置文件路径')
    
    args = parser.parse_args()
    
    try:
        # 处理背景颜色
        background_color = None if args.background == 'transparent' else args.background
        
        # 创建转换器
        converter = FontToPNGConverter(args.font_path, args.size)
        
        # 确定文字来源
        if os.path.exists(args.text_source):
            # 从文件加载
            text_list = load_text_from_file(args.text_source)
        else:
            # 直接使用输入的文字
            text_list = [args.text_source]
        
        # 批量转换
        generated_files = converter.batch_convert(
            text_list=text_list,
            output_dir=args.output,
            image_size=(args.width, args.height),
            text_color=args.color,
            background_color=background_color,
            text_position=args.position,
            filename_prefix=args.prefix
        )
        
        print(f"\n🎊 所有任务完成！")
        print(f"📁 输出目录: {os.path.abspath(args.output)}")
        print(f"📊 生成文件数: {len(generated_files)}")
        
    except Exception as e:
        print(f"❌ 程序执行失败: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
