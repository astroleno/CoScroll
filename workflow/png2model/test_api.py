#!/usr/bin/env python3
"""
简单的Tripo3D API连接测试脚本
"""

import os
import requests
from dotenv import load_dotenv

# 加载环境变量
load_dotenv('.env.local')
API_KEY = os.getenv('FAL_KEY')

print(f"🔑 API密钥: {API_KEY[:10]}..." if API_KEY else "❌ 未找到API密钥")

# 尝试不同的基础URL和端点
test_urls = [
    "https://api.tripo3d.ai/api/upload/sts",
    "https://api.tripo3d.ai/v1/upload/sts", 
    "https://api.tripo3d.ai/v2/openapi/upload/sts",
    "https://platform.tripo3d.ai/api/upload/sts",
    "https://tripo3d.ai/api/upload/sts",
]

headers = {
    'Authorization': f'Bearer {API_KEY}',
    'User-Agent': 'CoScroll-PNG2Model/1.0'
}

print("\n🧪 测试不同的API端点:")
for url in test_urls:
    try:
        print(f"\n📡 测试: {url}")
        response = requests.get(url, headers=headers, timeout=10)
        print(f"   状态码: {response.status_code}")
        if response.status_code != 404:
            print(f"   响应: {response.text[:200]}...")
        else:
            print("   ❌ 404 Not Found")
    except Exception as e:
        print(f"   ❌ 错误: {e}")

print("\n🔍 尝试OPTIONS请求检查CORS:")
for url in test_urls[:2]:  # 只测试前两个
    try:
        print(f"\n📡 OPTIONS: {url}")
        response = requests.options(url, headers=headers, timeout=10)
        print(f"   状态码: {response.status_code}")
        if response.headers:
            print(f"   允许的方法: {response.headers.get('Allow', 'N/A')}")
    except Exception as e:
        print(f"   ❌ 错误: {e}")
