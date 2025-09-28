# -*- coding: utf-8 -*-
"""
PNG转3D模型使用示例
演示如何使用png2model模块进行图片转换
"""

import os
import sys
import logging
from pathlib import Path

# 添加当前目录到Python路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from config import config
from api_client import Tripo3DClient
from batch_processor import BatchProcessor

def setup_logging():
    """设置日志"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )

def example_single_image():
    """示例：处理单个图片"""
    print("="*50)
    print("📝 示例1: 处理单个图片")
    print("="*50)
    
    # 创建API客户端
    client = Tripo3DClient()
    
    # 选择一个PNG文件进行测试
    input_dir = Path(config.INPUT_DIR)
    png_files = list(input_dir.glob("*.png"))
    
    if not png_files:
        print("❌ 没有找到PNG文件，请先运行character2png模块生成图片")
        return
    
    # 选择第一个PNG文件
    test_image = png_files[0]
    output_path = os.path.join(config.OUTPUT_DIR, f"test_{test_image.stem}.glb")
    
    print(f"📁 输入文件: {test_image}")
    print(f"📁 输出文件: {output_path}")
    
    # 处理图片
    success, message = client.generate_3d_model(str(test_image), output_path)
    
    if success:
        print(f"✅ 处理成功: {message}")
    else:
        print(f"❌ 处理失败: {message}")

def example_batch_processing():
    """示例：批量处理"""
    print("\n" + "="*50)
    print("📝 示例2: 批量处理")
    print("="*50)
    
    # 创建批量处理器
    processor = BatchProcessor()
    
    # 获取PNG文件列表
    png_files = processor.get_png_files()
    
    if not png_files:
        print("❌ 没有找到PNG文件")
        return
    
    print(f"📁 找到 {len(png_files)} 个PNG文件")
    
    # 只处理前3个文件作为示例
    sample_files = png_files[:3]
    print(f"🔄 处理示例文件: {[os.path.basename(f) for f in sample_files]}")
    
    # 创建临时处理器
    class SampleProcessor(BatchProcessor):
        def get_png_files(self):
            return sample_files
    
    sample_processor = SampleProcessor()
    
    # 执行批量处理
    results = sample_processor.process_all(parallel=False)
    
    # 打印结果
    sample_processor.print_summary(results)

def example_configuration():
    """示例：配置检查"""
    print("\n" + "="*50)
    print("📝 示例3: 配置检查")
    print("="*50)
    
    print("🔧 当前配置:")
    print(f"  API密钥: {'已设置' if config.TRIPO3D_API_KEY else '❌ 未设置'}")
    print(f"  输入目录: {config.INPUT_DIR}")
    print(f"  输出目录: {config.OUTPUT_DIR}")
    print(f"  模型设置: {config.MODEL_SETTINGS}")
    print(f"  批量大小: {config.BATCH_SIZE}")
    
    # 检查目录
    input_dir = Path(config.INPUT_DIR)
    output_dir = Path(config.OUTPUT_DIR)
    
    print(f"\n📁 目录检查:")
    print(f"  输入目录存在: {'✅' if input_dir.exists() else '❌'}")
    print(f"  输出目录存在: {'✅' if output_dir.exists() else '❌'}")
    
    if input_dir.exists():
        png_count = len(list(input_dir.glob("*.png")))
        print(f"  PNG文件数量: {png_count}")

def example_error_handling():
    """示例：错误处理"""
    print("\n" + "="*50)
    print("📝 示例4: 错误处理")
    print("="*50)
    
    client = Tripo3DClient()
    
    # 测试不存在的文件
    print("🧪 测试不存在的文件:")
    success, message = client.generate_3d_model("nonexistent.png", "output.glb")
    print(f"  结果: {'成功' if success else '失败'}")
    print(f"  消息: {message}")
    
    # 测试无效的API密钥
    print("\n🧪 测试无效的API密钥:")
    original_key = config.TRIPO3D_API_KEY
    config.TRIPO3D_API_KEY = "invalid_key"
    
    # 这里会显示API错误
    print("  (需要有效的API密钥才能测试)")

def main():
    """主函数"""
    setup_logging()
    
    print("🚀 PNG转3D模型使用示例")
    print("这个示例将演示如何使用png2model模块")
    
    # 检查配置
    if not config.validate_config():
        print("\n❌ 配置验证失败！")
        print("请确保:")
        print("1. 设置了TRIPO3D_API_KEY环境变量")
        print("2. 输入目录存在且包含PNG文件")
        print("3. 输出目录可写")
        return
    
    try:
        # 运行示例
        example_configuration()
        example_single_image()
        example_batch_processing()
        example_error_handling()
        
        print("\n🎉 所有示例运行完成！")
        print("\n💡 提示:")
        print("- 使用 'python main.py single image.png' 处理单个图片")
        print("- 使用 'python main.py batch' 批量处理")
        print("- 使用 'python main.py check' 检查配置")
        
    except KeyboardInterrupt:
        print("\n⏹️ 用户中断示例")
    except Exception as e:
        print(f"\n💥 示例运行错误: {str(e)}")
        logging.exception("示例运行错误")

if __name__ == '__main__':
    main()
