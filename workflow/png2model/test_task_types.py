#!/usr/bin/env python3
"""
测试不同的任务类型
"""

import os
import requests
from dotenv import load_dotenv

# 加载环境变量
load_dotenv('.env.local')
API_KEY = os.getenv('FAL_KEY')

# 使用真实的image_token
image_token = "66462469-00ef-43c9-b799-37cf84772e46"

url = "https://api.tripo3d.ai/v2/openapi/task"
headers = {
    'Authorization': f'Bearer {API_KEY}',
    'Content-Type': 'application/json'
}

# 测试不同的任务类型
task_types = [
    "image_to_3d",
    "image-to-3d", 
    "img2model",
    "image2model",
    "generate",
    "generation",
    "tripo_image_to_3d",
    "image_generation",
    "3d_generation",
    "multiview_to_3d"
]

print("🧪 测试不同的任务类型:")
for task_type in task_types:
    try:
        # 使用格式2（嵌套在data中），因为它给出了不同的错误
        request_data = {
            "data": {
                "type": task_type,
                "image_token": image_token,
                "prompt": "将这个汉字转为3D模型，每个笔画中间圆滚，端头尖锐"
            }
        }
        
        print(f"\n📡 测试任务类型: {task_type}")
        response = requests.post(url, headers=headers, json=request_data, timeout=10)
        print(f"   状态码: {response.status_code}")
        print(f"   响应: {response.text[:200]}...")
        
        if response.status_code == 200:
            print("   ✅ 成功！")
            break
        elif "not supported" not in response.text:
            print("   🔍 可能有进展...")
            
    except Exception as e:
        print(f"   ❌ 错误: {e}")
