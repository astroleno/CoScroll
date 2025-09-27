#!/usr/bin/env python3
"""
测试Tripo3D生成端点
"""

import os
import requests
from dotenv import load_dotenv

# 加载环境变量
load_dotenv('.env.local')
API_KEY = os.getenv('FAL_KEY')

# 测试不同的生成端点
generate_urls = [
    "https://api.tripo3d.ai/v2/openapi/generate",
    "https://api.tripo3d.ai/v2/openapi/generation", 
    "https://api.tripo3d.ai/v2/openapi/task/create",
    "https://api.tripo3d.ai/v2/openapi/tasks",
    "https://api.tripo3d.ai/v1/generate",
    "https://api.tripo3d.ai/v1/generation",
]

headers = {
    'Authorization': f'Bearer {API_KEY}',
    'Content-Type': 'application/json'
}

test_data = {
    "image_token": "test_token",
    "prompt": "test prompt"
}

print("🧪 测试不同的生成端点:")
for url in generate_urls:
    try:
        print(f"\n📡 POST: {url}")
        response = requests.post(url, headers=headers, json=test_data, timeout=10)
        print(f"   状态码: {response.status_code}")
        if response.status_code != 404:
            print(f"   响应: {response.text[:200]}...")
        else:
            print("   ❌ 404 Not Found")
    except Exception as e:
        print(f"   ❌ 错误: {e}")
