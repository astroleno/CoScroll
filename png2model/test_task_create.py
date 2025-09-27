#!/usr/bin/env python3
"""
测试task/create端点的不同HTTP方法
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

test_data = {
    "image_token": "test_token",
    "prompt": "test prompt"
}

# 测试不同的HTTP方法
methods = ['GET', 'POST', 'PUT', 'PATCH']

print("🧪 测试task/create端点的不同HTTP方法:")
for method in methods:
    try:
        print(f"\n📡 {method}: {url}")
        if method == 'GET':
            response = requests.get(url, headers=headers, timeout=10)
        elif method == 'POST':
            response = requests.post(url, headers=headers, json=test_data, timeout=10)
        elif method == 'PUT':
            response = requests.put(url, headers=headers, json=test_data, timeout=10)
        elif method == 'PATCH':
            response = requests.patch(url, headers=headers, json=test_data, timeout=10)
        
        print(f"   状态码: {response.status_code}")
        if response.status_code not in [404, 405]:
            print(f"   响应: {response.text[:300]}...")
        else:
            print(f"   错误: {response.text[:100]}...")
    except Exception as e:
        print(f"   ❌ 错误: {e}")

# 也检查OPTIONS方法看允许的方法
try:
    print(f"\n📡 OPTIONS: {url}")
    response = requests.options(url, headers=headers, timeout=10)
    print(f"   状态码: {response.status_code}")
    print(f"   允许的方法: {response.headers.get('Allow', 'N/A')}")
    print(f"   响应头: {dict(response.headers)}")
except Exception as e:
    print(f"   ❌ 错误: {e}")
