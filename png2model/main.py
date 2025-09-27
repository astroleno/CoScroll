# -*- coding: utf-8 -*-
"""
PNG转3D模型主程序
提供命令行接口和批量处理功能
"""

import os
import sys
import argparse
import logging
from pathlib import Path

# 添加当前目录到Python路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from config import config
from batch_processor import BatchProcessor

def setup_logging():
    """设置日志配置"""
    logging.basicConfig(
        level=getattr(logging, config.LOG_LEVEL),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(config.LOG_FILE, encoding='utf-8'),
            logging.StreamHandler(sys.stdout)
        ]
    )

def process_single_image(image_path: str, output_path: str = None):
    """
    处理单个图片
    
    Args:
        image_path: 输入图片路径
        output_path: 输出模型路径（可选）
    """
    from api_client import Tripo3DClient
    
    logger = logging.getLogger(__name__)
    
    # 检查输入文件
    if not os.path.exists(image_path):
        logger.error(f"❌ 输入文件不存在: {image_path}")
        return False
    
    # 生成输出路径
    if not output_path:
        image_file = Path(image_path)
        output_path = os.path.join(
            config.OUTPUT_DIR, 
            f"{image_file.stem}.{config.MODEL_SETTINGS['format']}"
        )
    
    logger.info(f"🚀 开始处理单个图片: {image_path}")
    logger.info(f"📁 输出路径: {output_path}")
    
    # 创建API客户端并处理
    client = Tripo3DClient()
    success, message = client.generate_3d_model(image_path, output_path)
    
    if success:
        logger.info(f"✅ 处理成功: {message}")
        return True
    else:
        logger.error(f"❌ 处理失败: {message}")
        return False

def process_batch_images(parallel: bool = False, max_workers: int = 3):
    """
    批量处理图片
    
    Args:
        parallel: 是否使用并行处理
        max_workers: 并行处理时的最大并发数
    """
    logger = logging.getLogger(__name__)
    
    logger.info("🔄 开始批量处理PNG图片")
    logger.info(f"📁 输入目录: {config.INPUT_DIR}")
    logger.info(f"📁 输出目录: {config.OUTPUT_DIR}")
    logger.info(f"⚙️ 处理模式: {'并行' if parallel else '顺序'}")
    
    # 创建批量处理器
    processor = BatchProcessor()
    
    # 执行批量处理
    results = processor.process_all(parallel=parallel, max_workers=max_workers)
    
    # 打印结果摘要
    processor.print_summary(results)
    
    return results

def main():
    """主函数"""
    # 设置日志
    setup_logging()
    logger = logging.getLogger(__name__)
    
    # 创建命令行参数解析器
    parser = argparse.ArgumentParser(
        description='PNG转3D模型工具',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:
  # 处理单个图片
  python main.py single image.png
  
  # 处理单个图片并指定输出路径
  python main.py single image.png -o model.glb
  
  # 批量处理所有PNG图片（顺序模式）
  python main.py batch
  
  # 批量处理所有PNG图片（并行模式）
  python main.py batch --parallel --workers 3
  
  # 检查配置
  python main.py check
        """
    )
    
    subparsers = parser.add_subparsers(dest='command', help='可用命令')
    
    # 单个图片处理命令
    single_parser = subparsers.add_parser('single', help='处理单个图片')
    single_parser.add_argument('image_path', help='输入图片路径')
    single_parser.add_argument('-o', '--output', help='输出模型路径')
    
    # 批量处理命令
    batch_parser = subparsers.add_parser('batch', help='批量处理图片')
    batch_parser.add_argument('--parallel', action='store_true', help='使用并行处理')
    batch_parser.add_argument('--workers', type=int, default=3, help='并行处理时的最大并发数')
    
    # 配置检查命令
    subparsers.add_parser('check', help='检查配置')
    
    # 解析命令行参数
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    # 检查配置
    if not config.validate_config():
        logger.error("❌ 配置验证失败，请检查配置")
        return
    
    try:
        if args.command == 'single':
            # 处理单个图片
            success = process_single_image(args.image_path, args.output)
            if success:
                logger.info("🎉 单个图片处理完成")
            else:
                logger.error("💥 单个图片处理失败")
                sys.exit(1)
                
        elif args.command == 'batch':
            # 批量处理
            results = process_batch_images(
                parallel=args.parallel, 
                max_workers=args.workers
            )
            
            # 检查是否有失败的文件
            if results['stats']['failed'] > 0:
                logger.warning(f"⚠️ 有 {results['stats']['failed']} 个文件处理失败")
            else:
                logger.info("🎉 所有文件处理完成")
                
        elif args.command == 'check':
            # 检查配置
            logger.info("✅ 配置检查通过")
            logger.info(f"API密钥: {'已设置' if config.TRIPO3D_API_KEY else '未设置'}")
            logger.info(f"输入目录: {config.INPUT_DIR}")
            logger.info(f"输出目录: {config.OUTPUT_DIR}")
            logger.info(f"模型设置: {config.MODEL_SETTINGS}")
            
    except KeyboardInterrupt:
        logger.info("⏹️ 用户中断处理")
    except Exception as e:
        logger.error(f"💥 程序执行错误: {str(e)}")
        sys.exit(1)

if __name__ == '__main__':
    main()
