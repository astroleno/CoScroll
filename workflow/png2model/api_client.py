# -*- coding: utf-8 -*-
"""
Tripo3D API客户端
负责与Tripo3D API进行交互，处理PNG到3D模型的转换
"""

import requests
import json
import time
import base64
from typing import Dict, Any, Optional, Tuple
from pathlib import Path
import logging

from config import config

class Tripo3DClient:
    """Tripo3D API客户端类"""
    
    def __init__(self):
        """初始化API客户端"""
        self.base_url = config.TRIPO3D_BASE_URL
        self.headers = config.get_api_headers()
        self.session = requests.Session()
        self.session.headers.update(self.headers)
        
        # 设置日志
        self.logger = logging.getLogger(__name__)
        
    def encode_image_to_base64(self, image_path: str) -> str:
        """
        将图片文件编码为base64字符串
        
        Args:
            image_path: 图片文件路径
            
        Returns:
            base64编码的图片字符串
        """
        try:
            with open(image_path, 'rb') as image_file:
                image_data = image_file.read()
                base64_string = base64.b64encode(image_data).decode('utf-8')
                self.logger.info(f"✅ 图片编码成功: {image_path}")
                return base64_string
        except Exception as e:
            self.logger.error(f"❌ 图片编码失败: {image_path}, 错误: {str(e)}")
            raise
    
    def create_generation_request(self, image_base64: str, settings: Dict[str, Any]) -> Dict[str, Any]:
        """
        创建3D模型生成请求
        
        Args:
            image_base64: base64编码的图片
            settings: 模型生成设置
            
        Returns:
            请求数据字典
        """
        request_data = {
            "image_url": f"data:image/png;base64,{image_base64}",
            "prompt": "将这个汉字转为3d模型，每个笔画中间圆滚，端头尖锐"
        }
        
        self.logger.info(f"📝 创建生成请求: 提示词=将汉字转为3D模型")
        return request_data
    
    def upload_image(self, image_path: str) -> Tuple[bool, str, Optional[str]]:
        """
        上传图片到Tripo3D
        
        Args:
            image_path: 图片路径
            
        Returns:
            (是否成功, 消息, 图片URL)
        """
        try:
            # 上传图片 - 使用multipart/form-data
            headers = {
                'Authorization': f'Bearer {config.TRIPO3D_API_KEY}'
            }
            
            with open(image_path, 'rb') as f:
                files = {'file': f}
                response = requests.post(
                    "https://api.tripo3d.ai/v2/openapi/upload/sts",
                    headers=headers,
                    files=files,
                    timeout=30
                )
            
            if response.status_code == 200:
                result = response.json()
                image_token = result.get('data', {}).get('image_token')
                if image_token:
                    self.logger.info(f"✅ 图片上传成功: {image_token}")
                    return True, "图片上传成功", image_token
                else:
                    error_msg = f"响应格式错误: {result}"
                    self.logger.error(f"❌ {error_msg}")
                    return False, error_msg, None
            else:
                error_msg = f"图片上传失败: {response.status_code} - {response.text}"
                self.logger.error(f"❌ {error_msg}")
                return False, error_msg, None
                
        except Exception as e:
            error_msg = f"图片上传错误: {str(e)}"
            self.logger.error(f"❌ {error_msg}")
            return False, error_msg, None
    
    def submit_generation_job(self, image_token: str, prompt: str) -> Tuple[bool, str, Optional[str]]:
        """
        提交3D模型生成任务
        
        Args:
            image_token: 图片token
            prompt: 提示词
            
        Returns:
            (是否成功, 消息, 任务ID)
        """
        try:
            # 生成3D模型
            request_data = {
                "type": "image_to_model",  # 正确的任务类型
                "file": {
                    "type": "png",  # 文件类型
                    "file_token": image_token  # 使用file_token而不是image_token
                }
            }
            
            response = self.session.post(
                "https://api.tripo3d.ai/v2/openapi/task",
                json=request_data,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                # Tripo3D返回的格式: {"code": 0, "data": {"task_id": "..."}}
                if result.get('code') == 0 and 'data' in result:
                    task_id = result['data'].get('task_id')
                    if task_id:
                        self.logger.info(f"✅ 任务提交成功, 任务ID: {task_id}")
                        return True, "任务提交成功", task_id
                
                # 尝试其他格式
                if 'task_id' in result:
                    task_id = result.get('task_id')
                    self.logger.info(f"✅ 任务提交成功, 任务ID: {task_id}")
                    return True, "任务提交成功", task_id
                elif 'generation_id' in result:
                    generation_id = result.get('generation_id')
                    self.logger.info(f"✅ 任务提交成功, 生成ID: {generation_id}")
                    return True, "任务提交成功", generation_id
                else:
                    error_msg = f"响应格式错误: {result}"
                    self.logger.error(f"❌ {error_msg}")
                    return False, error_msg, None
            else:
                error_msg = f"API请求失败: {response.status_code} - {response.text}"
                self.logger.error(f"❌ {error_msg}")
                return False, error_msg, None
                
        except requests.exceptions.Timeout:
            error_msg = "请求超时，请检查网络连接"
            self.logger.error(f"❌ {error_msg}")
            return False, error_msg, None
        except requests.exceptions.RequestException as e:
            error_msg = f"网络请求错误: {str(e)}"
            self.logger.error(f"❌ {error_msg}")
            return False, error_msg, None
        except Exception as e:
            error_msg = f"未知错误: {str(e)}"
            self.logger.error(f"❌ {error_msg}")
            return False, error_msg, None
    
    def check_job_status(self, task_id: str) -> Tuple[bool, str, Optional[str]]:
        """
        检查任务状态
        
        Args:
            task_id: 任务ID
            
        Returns:
            (是否完成, 状态消息, 下载链接)
        """
        try:
            response = self.session.get(
                f"https://api.tripo3d.ai/v2/openapi/task/{task_id}",
                timeout=10
            )
            
            if response.status_code == 200:
                result = response.json()
                status = result.get('status', 'unknown')
                
                if status == 'completed':
                    model_url = result.get('result', {}).get('model_url')
                    self.logger.info(f"✅ 任务完成: {task_id}")
                    return True, "任务完成", model_url
                elif status == 'failed':
                    error_msg = result.get('error', '任务失败')
                    self.logger.error(f"❌ 任务失败: {task_id}, 错误: {error_msg}")
                    return True, f"任务失败: {error_msg}", None
                else:
                    self.logger.info(f"⏳ 任务进行中: {task_id}, 状态: {status}")
                    return False, f"任务进行中: {status}", None
            else:
                error_msg = f"状态查询失败: {response.status_code}"
                self.logger.error(f"❌ {error_msg}")
                return False, error_msg, None
                
        except Exception as e:
            error_msg = f"状态查询错误: {str(e)}"
            self.logger.error(f"❌ {error_msg}")
            return False, error_msg, None
    
    def download_model(self, download_url: str, output_path: str) -> Tuple[bool, str]:
        """
        下载生成的3D模型
        
        Args:
            download_url: 下载链接
            output_path: 输出文件路径
            
        Returns:
            (是否成功, 消息)
        """
        try:
            response = self.session.get(download_url, timeout=60)
            
            if response.status_code == 200:
                # 确保输出目录存在
                Path(output_path).parent.mkdir(parents=True, exist_ok=True)
                
                # 保存文件
                with open(output_path, 'wb') as f:
                    f.write(response.content)
                
                self.logger.info(f"✅ 模型下载成功: {output_path}")
                return True, f"模型下载成功: {output_path}"
            else:
                error_msg = f"下载失败: {response.status_code}"
                self.logger.error(f"❌ {error_msg}")
                return False, error_msg
                
        except Exception as e:
            error_msg = f"下载错误: {str(e)}"
            self.logger.error(f"❌ {error_msg}")
            return False, error_msg
    
    def generate_3d_model(self, image_path: str, output_path: str) -> Tuple[bool, str]:
        """
        完整的3D模型生成流程
        
        Args:
            image_path: 输入图片路径
            output_path: 输出模型路径
            
        Returns:
            (是否成功, 消息)
        """
        try:
            self.logger.info(f"🚀 开始生成3D模型: {image_path}")
            
            # 1. 上传图片
            success, message, image_token = self.upload_image(image_path)
            if not success:
                return False, message
            
            # 2. 生成3D模型
            prompt = "将这个汉字转为3d模型，每个笔画中间圆滚，端头尖锐"
            success, message, task_id = self.submit_generation_job(image_token, prompt)
            if not success:
                return False, message
            
            # 3. 等待任务完成
            max_wait_time = 300  # 最大等待5分钟
            wait_interval = 10   # 每10秒检查一次
            elapsed_time = 0
            
            while elapsed_time < max_wait_time:
                time.sleep(wait_interval)
                elapsed_time += wait_interval
                
                completed, status_msg, model_url = self.check_job_status(task_id)
                
                if completed:
                    if model_url:
                        # 下载模型
                        return self.download_model(model_url, output_path)
                    else:
                        return False, status_msg
                
                self.logger.info(f"⏳ 等待中... ({elapsed_time}s/{max_wait_time}s)")
            
            return False, "任务超时，请稍后手动检查"
            
        except Exception as e:
            error_msg = f"生成3D模型失败: {str(e)}"
            self.logger.error(f"❌ {error_msg}")
            return False, error_msg
