# -*- coding: utf-8 -*-
"""
批量处理模块
负责批量将PNG图片转换为3D模型
"""

import os
import time
import logging
from pathlib import Path
from typing import List, Dict, Any, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed

from config import config
from api_client import Tripo3DClient

class BatchProcessor:
    """批量处理器类"""
    
    def __init__(self):
        """初始化批量处理器"""
        self.client = Tripo3DClient()
        self.logger = logging.getLogger(__name__)
        
        # 处理统计
        self.stats = {
            'total': 0,
            'success': 0,
            'failed': 0,
            'skipped': 0
        }
    
    def get_png_files(self) -> List[str]:
        """
        获取所有PNG文件列表
        
        Returns:
            PNG文件路径列表
        """
        png_files = []
        input_dir = Path(config.INPUT_DIR)
        
        if not input_dir.exists():
            self.logger.error(f"❌ 输入目录不存在: {config.INPUT_DIR}")
            return png_files
        
        # 查找所有PNG文件
        for png_file in input_dir.glob("*.png"):
            png_files.append(str(png_file))
        
        # 按文件名排序
        png_files.sort()
        
        self.logger.info(f"📁 找到 {len(png_files)} 个PNG文件")
        return png_files
    
    def get_output_path(self, png_path: str) -> str:
        """
        根据PNG文件路径生成输出路径
        
        Args:
            png_path: PNG文件路径
            
        Returns:
            输出模型文件路径
        """
        png_file = Path(png_path)
        output_dir = Path(config.OUTPUT_DIR)
        
        # 生成输出文件名（替换扩展名）
        model_name = png_file.stem + f".{config.MODEL_SETTINGS['format']}"
        output_path = output_dir / model_name
        
        return str(output_path)
    
    def process_single_image(self, png_path: str) -> Tuple[bool, str, str]:
        """
        处理单个图片
        
        Args:
            png_path: PNG文件路径
            
        Returns:
            (是否成功, 消息, 输出路径)
        """
        try:
            output_path = self.get_output_path(png_path)
            
            # 检查输出文件是否已存在
            if os.path.exists(output_path):
                self.logger.info(f"⏭️ 跳过已存在的文件: {output_path}")
                return True, "文件已存在，跳过", output_path
            
            # 生成3D模型
            success, message = self.client.generate_3d_model(png_path, output_path)
            
            if success:
                self.logger.info(f"✅ 处理成功: {png_path} -> {output_path}")
                return True, message, output_path
            else:
                self.logger.error(f"❌ 处理失败: {png_path}, 错误: {message}")
                return False, message, output_path
                
        except Exception as e:
            error_msg = f"处理图片时发生错误: {str(e)}"
            self.logger.error(f"❌ {error_msg}")
            return False, error_msg, ""
    
    def process_batch_sequential(self, png_files: List[str]) -> Dict[str, Any]:
        """
        顺序处理批量图片
        
        Args:
            png_files: PNG文件列表
            
        Returns:
            处理结果统计
        """
        self.logger.info(f"🔄 开始顺序处理 {len(png_files)} 个文件")
        
        results = []
        start_time = time.time()
        
        for i, png_path in enumerate(png_files, 1):
            self.logger.info(f"📝 处理进度: {i}/{len(png_files)} - {os.path.basename(png_path)}")
            
            success, message, output_path = self.process_single_image(png_path)
            
            result = {
                'input': png_path,
                'output': output_path,
                'success': success,
                'message': message,
                'timestamp': time.time()
            }
            results.append(result)
            
            # 更新统计
            if success:
                if "跳过" in message:
                    self.stats['skipped'] += 1
                else:
                    self.stats['success'] += 1
            else:
                self.stats['failed'] += 1
            
            self.stats['total'] += 1
            
            # 显示进度
            progress = (i / len(png_files)) * 100
            self.logger.info(f"📊 进度: {progress:.1f}% ({i}/{len(png_files)})")
            
            # 添加延迟避免API限制
            if i < len(png_files):  # 不是最后一个文件
                time.sleep(config.RETRY_DELAY)
        
        end_time = time.time()
        duration = end_time - start_time
        
        self.logger.info(f"✅ 批量处理完成，耗时: {duration:.2f}秒")
        return {
            'results': results,
            'stats': self.stats.copy(),
            'duration': duration
        }
    
    def process_batch_parallel(self, png_files: List[str], max_workers: int = 3) -> Dict[str, Any]:
        """
        并行处理批量图片
        
        Args:
            png_files: PNG文件列表
            max_workers: 最大并发数
            
        Returns:
            处理结果统计
        """
        self.logger.info(f"🔄 开始并行处理 {len(png_files)} 个文件 (最大并发: {max_workers})")
        
        results = []
        start_time = time.time()
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # 提交所有任务
            future_to_png = {
                executor.submit(self.process_single_image, png_path): png_path 
                for png_path in png_files
            }
            
            # 处理完成的任务
            for i, future in enumerate(as_completed(future_to_png), 1):
                png_path = future_to_png[future]
                
                try:
                    success, message, output_path = future.result()
                    
                    result = {
                        'input': png_path,
                        'output': output_path,
                        'success': success,
                        'message': message,
                        'timestamp': time.time()
                    }
                    results.append(result)
                    
                    # 更新统计
                    if success:
                        if "跳过" in message:
                            self.stats['skipped'] += 1
                        else:
                            self.stats['success'] += 1
                    else:
                        self.stats['failed'] += 1
                    
                    self.stats['total'] += 1
                    
                    # 显示进度
                    progress = (i / len(png_files)) * 100
                    self.logger.info(f"📊 进度: {progress:.1f}% ({i}/{len(png_files)}) - {os.path.basename(png_path)}")
                    
                except Exception as e:
                    self.logger.error(f"❌ 任务执行错误: {png_path}, 错误: {str(e)}")
                    self.stats['failed'] += 1
                    self.stats['total'] += 1
        
        end_time = time.time()
        duration = end_time - start_time
        
        self.logger.info(f"✅ 并行处理完成，耗时: {duration:.2f}秒")
        return {
            'results': results,
            'stats': self.stats.copy(),
            'duration': duration
        }
    
    def process_all(self, parallel: bool = False, max_workers: int = 3) -> Dict[str, Any]:
        """
        处理所有PNG文件
        
        Args:
            parallel: 是否使用并行处理
            max_workers: 并行处理时的最大并发数
            
        Returns:
            处理结果统计
        """
        # 获取所有PNG文件
        png_files = self.get_png_files()
        
        if not png_files:
            self.logger.warning("⚠️ 没有找到PNG文件")
            return {'results': [], 'stats': self.stats, 'duration': 0}
        
        # 重置统计
        self.stats = {'total': 0, 'success': 0, 'failed': 0, 'skipped': 0}
        
        # 选择处理方式
        if parallel:
            return self.process_batch_parallel(png_files, max_workers)
        else:
            return self.process_batch_sequential(png_files)
    
    def print_summary(self, results: Dict[str, Any]):
        """
        打印处理结果摘要
        
        Args:
            results: 处理结果
        """
        stats = results['stats']
        duration = results['duration']
        
        print("\n" + "="*50)
        print("📊 批量处理结果摘要")
        print("="*50)
        print(f"总文件数: {stats['total']}")
        print(f"成功处理: {stats['success']}")
        print(f"跳过文件: {stats['skipped']}")
        print(f"失败文件: {stats['failed']}")
        print(f"总耗时: {duration:.2f}秒")
        
        if stats['total'] > 0:
            success_rate = (stats['success'] / stats['total']) * 100
            print(f"成功率: {success_rate:.1f}%")
        
        print("="*50)
