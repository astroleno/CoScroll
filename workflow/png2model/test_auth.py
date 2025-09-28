#!/usr/bin/env python3
"""
测试Tripo3D API认证
"""

import os
import requests
from dotenv import load_dotenv

# 加载环境变量
load_dotenv('.env.local')
API_KEY = os.getenv('TRIPO3D_API_KEY')

print(f"🔑 API密钥: {API_KEY[:10]}..." if API_KEY else "❌ 未找到API密钥")

# 测试不同的认证头组合
auth_headers = [
    # 基本认证
    {
        'Authorization': f'Bearer {API_KEY}',
        'Content-Type': 'application/json'
    },
    # 添加User-Agent
    {
        'Authorization': f'Bearer {API_KEY}',
        'Content-Type': 'application/json',
        'User-Agent': 'CoScroll-PNG2Model/1.0'
    },
    # 添加X-API-Key
    {
        'Authorization': f'Bearer {API_KEY}',
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
    },
    # 添加X-Client-ID
    {
        'Authorization': f'Bearer {API_KEY}',
        'Content-Type': 'application/json',
        'X-Client-ID': 'coscroll'
    }
]

# 使用真实的image_token
image_token = "62198b73-856a-49dd-bc2c-8b70bf9ca0e7"

url = "https://api.tripo3d.ai/v2/openapi/task"
test_data = {
    "type": "image_to_model",
    "file": {
        "type": "png",
        "file_token": image_token
    }
}

print("\n🧪 测试不同的认证头组合:")
for i, headers in enumerate(auth_headers, 1):
    try:
        print(f"\n📡 测试 {i}: {list(headers.keys())}")
        response = requests.post(url, headers=headers, json=test_data, timeout=10)
        print(f"   状态码: {response.status_code}")
        print(f"   响应: {response.text[:200]}...")
        
        if response.status_code == 200:
            print("   ✅ 成功！")
            break
        elif response.status_code == 403:
            print("   🔍 认证成功，但积分不足")
        elif response.status_code not in [400, 404]:
            print("   🔍 可能有进展...")
            
    except Exception as e:
        print(f"   ❌ 错误: {e}")
