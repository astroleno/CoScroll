#!/usr/bin/env python3
"""
测试task/create的不同参数格式
"""

import os
import requests
from dotenv import load_dotenv

# 加载环境变量
load_dotenv('.env.local')
API_KEY = os.getenv('FAL_KEY')

url = "https://api.tripo3d.ai/v2/openapi/task/create"
headers = {
    'Authorization': f'Bearer {API_KEY}',
    'Content-Type': 'application/json'
}

# 使用真实的image_token（从之前的上传中获得）
image_token = "0fbb5504-8183-4a99-85ff-97268bee9117"

# 测试不同的参数格式
param_sets = [
    # 基本参数
    {
        "image_token": image_token,
        "prompt": "将这个汉字转为3D模型，每个笔画中间圆滚，端头尖锐"
    },
    # 添加type参数
    {
        "image_token": image_token,
        "prompt": "将这个汉字转为3D模型，每个笔画中间圆滚，端头尖锐",
        "type": "image_to_3d"
    },
    # 添加format参数
    {
        "image_token": image_token,
        "prompt": "将这个汉字转为3D模型，每个笔画中间圆滚，端头尖锐",
        "format": "glb"
    },
    # 完整参数
    {
        "image_token": image_token,
        "prompt": "将这个汉字转为3D模型，每个笔画中间圆滚，端头尖锐",
        "type": "image_to_3d",
        "format": "glb",
        "quality": "high"
    },
    # 尝试不同的字段名
    {
        "image": image_token,
        "text": "将这个汉字转为3D模型，每个笔画中间圆滚，端头尖锐"
    }
]

print("🧪 测试不同的参数格式:")
for i, params in enumerate(param_sets, 1):
    try:
        print(f"\n📡 测试 {i}: {params}")
        response = requests.get(url, headers=headers, params=params, timeout=10)
        print(f"   状态码: {response.status_code}")
        print(f"   响应: {response.text[:300]}...")
        if response.status_code == 200:
            print("   ✅ 成功！")
            break
    except Exception as e:
        print(f"   ❌ 错误: {e}")
