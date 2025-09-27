# -*- coding: utf-8 -*-
"""
PNG转3D模型配置文件
包含API配置、模型参数等设置
"""

import os
from typing import Dict, Any
from dotenv import load_dotenv

# 加载.env.local文件
load_dotenv('.env.local')

class Config:
    """配置类，管理所有配置参数"""
    
    def __init__(self):
        """初始化配置"""
        # Tripo3D API配置
        self.TRIPO3D_API_KEY = os.getenv('TRIPO3D_API_KEY', '')
        self.TRIPO3D_BASE_URL = 'https://api.tripo3d.ai/v1'
        
        # 输入输出路径配置
        self.INPUT_DIR = '../character2png/words_output'  # PNG图片输入目录
        self.OUTPUT_DIR = './models_output'  # 3D模型输出目录
        self.TEMP_DIR = './temp'  # 临时文件目录
        
        # 模型生成参数
        self.MODEL_SETTINGS = {
            'quality': 'high',  # 模型质量：low, medium, high
            'format': 'glb',    # 输出格式：glb, obj, ply
            'resolution': 1024, # 模型分辨率
            'detail_level': 8   # 细节级别 1-10
        }
        
        # 批量处理配置
        self.BATCH_SIZE = 5  # 每批处理的图片数量
        self.MAX_RETRIES = 3  # 最大重试次数
        self.RETRY_DELAY = 2  # 重试延迟（秒）
        
        # 日志配置
        self.LOG_LEVEL = 'INFO'
        self.LOG_FILE = './png2model.log'
        
        # 确保输出目录存在
        self._ensure_directories()
    
    def _ensure_directories(self):
        """确保必要的目录存在"""
        directories = [self.OUTPUT_DIR, self.TEMP_DIR]
        for directory in directories:
            if not os.path.exists(directory):
                os.makedirs(directory)
                print(f"✅ 创建目录: {directory}")
    
    def get_api_headers(self) -> Dict[str, str]:
        """获取API请求头"""
        return {
            'Authorization': f'Bearer {self.TRIPO3D_API_KEY}',
            'Content-Type': 'application/json',
            'User-Agent': 'CoScroll-PNG2Model/1.0'
        }
    
    def validate_config(self) -> bool:
        """验证配置是否有效"""
        if not self.TRIPO3D_API_KEY:
            print("❌ 错误: 未设置TRIPO3D_API_KEY环境变量")
            return False
        
        if not os.path.exists(self.INPUT_DIR):
            print(f"❌ 错误: 输入目录不存在: {self.INPUT_DIR}")
            return False
        
        print("✅ 配置验证通过")
        return True

# 创建全局配置实例
config = Config()
