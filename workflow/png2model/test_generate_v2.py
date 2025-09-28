#!/usr/bin/env python3
"""
测试v2/openapi路径下的生成端点
"""

import os
import requests
from dotenv import load_dotenv

# 加载环境变量
load_dotenv('.env.local')
API_KEY = os.getenv('FAL_KEY')

# 使用真实的image_token
image_token = "d485fb9f-372e-4fb2-9692-5f1795a23d2f"

headers = {
    'Authorization': f'Bearer {API_KEY}',
    'Content-Type': 'application/json'
}

test_data = {
    "image_token": image_token,
    "prompt": "将这个汉字转为3D模型，每个笔画中间圆滚，端头尖锐"
}

# 测试v2/openapi路径下的不同生成端点
generate_urls = [
    "https://api.tripo3d.ai/v2/openapi/generate",
    "https://api.tripo3d.ai/v2/openapi/generation", 
    "https://api.tripo3d.ai/v2/openapi/task",
    "https://api.tripo3d.ai/v2/openapi/tasks",
    "https://api.tripo3d.ai/v2/openapi/jobs",
    "https://api.tripo3d.ai/v2/openapi/submit",
    "https://api.tripo3d.ai/v2/openapi/create",
]

print("🧪 测试v2/openapi路径下的生成端点:")
for url in generate_urls:
    try:
        print(f"\n📡 POST: {url}")
        response = requests.post(url, headers=headers, json=test_data, timeout=10)
        print(f"   状态码: {response.status_code}")
        if response.status_code not in [404, 405]:
            print(f"   响应: {response.text[:300]}...")
            if response.status_code == 200:
                print("   ✅ 成功！")
                break
        else:
            print(f"   错误: {response.text[:100]}...")
    except Exception as e:
        print(f"   ❌ 错误: {e}")

# 也测试一些可能的GET端点
print("\n🧪 测试GET方法:")
get_urls = [
    "https://api.tripo3d.ai/v2/openapi/generate",
    "https://api.tripo3d.ai/v2/openapi/task/submit",
]

for url in get_urls:
    try:
        print(f"\n📡 GET: {url}")
        response = requests.get(url, headers=headers, params=test_data, timeout=10)
        print(f"   状态码: {response.status_code}")
        if response.status_code not in [404, 405]:
            print(f"   响应: {response.text[:300]}...")
            if response.status_code == 200:
                print("   ✅ 成功！")
                break
        else:
            print(f"   错误: {response.text[:100]}...")
    except Exception as e:
        print(f"   ❌ 错误: {e}")
