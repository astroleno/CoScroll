#!/usr/bin/env python3
"""
测试task端点的不同请求体格式
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

# 测试不同的请求体格式
request_schemas = [
    # 格式1: 直接参数
    {
        "type": "image_to_3d",
        "image_token": image_token,
        "prompt": "将这个汉字转为3D模型，每个笔画中间圆滚，端头尖锐"
    },
    # 格式2: 嵌套在data中
    {
        "data": {
            "type": "image_to_3d",
            "image_token": image_token,
            "prompt": "将这个汉字转为3D模型，每个笔画中间圆滚，端头尖锐"
        }
    },
    # 格式3: 使用input字段
    {
        "type": "image_to_3d",
        "input": {
            "image_token": image_token,
            "prompt": "将这个汉字转为3D模型，每个笔画中间圆滚，端头尖锐"
        }
    },
    # 格式4: 使用task字段
    {
        "task": {
            "type": "image_to_3d",
            "image_token": image_token,
            "prompt": "将这个汉字转为3D模型，每个笔画中间圆滚，端头尖锐"
        }
    },
    # 格式5: 更详细的参数
    {
        "type": "image_to_3d",
        "image_token": image_token,
        "prompt": "将这个汉字转为3D模型，每个笔画中间圆滚，端头尖锐",
        "format": "glb",
        "quality": "high"
    }
]

print("🧪 测试不同的请求体格式:")
for i, schema in enumerate(request_schemas, 1):
    try:
        print(f"\n📡 测试 {i}: {schema}")
        response = requests.post(url, headers=headers, json=schema, timeout=10)
        print(f"   状态码: {response.status_code}")
        print(f"   响应: {response.text[:300]}...")
        if response.status_code == 200:
            print("   ✅ 成功！")
            break
        elif response.status_code not in [400, 404]:
            print("   🔍 可能有进展...")
    except Exception as e:
        print(f"   ❌ 错误: {e}")
