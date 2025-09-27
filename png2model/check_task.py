#!/usr/bin/env python3
"""
检查任务状态和下载结果
"""

import os
import requests
from dotenv import load_dotenv

# 加载环境变量
load_dotenv('.env.local')
API_KEY = os.getenv('TRIPO3D_API_KEY')

# 之前创建的任务ID
task_ids = [
    "861e151f-98e9-4b64-8c56-a739db9b0880",  # 第一个任务
    "af7cb09a-9539-4a9a-9aa2-8a0a073504f2"   # 第二个任务
]

headers = {
    'Authorization': f'Bearer {API_KEY}',
    'Content-Type': 'application/json'
}

print("🔍 检查任务状态:")
for task_id in task_ids:
    try:
        print(f"\n📡 检查任务: {task_id}")
        
        # 尝试不同的状态查询端点
        status_urls = [
            f"https://api.tripo3d.ai/v2/openapi/task/{task_id}",
            f"https://api.tripo3d.ai/v2/openapi/tasks/{task_id}",
            f"https://api.tripo3d.ai/v2/openapi/status/{task_id}",
            f"https://api.tripo3d.ai/v1/task/{task_id}",
            f"https://api.tripo3d.ai/v1/status/{task_id}"
        ]
        
        for url in status_urls:
            try:
                print(f"   📡 GET: {url}")
                response = requests.get(url, headers=headers, timeout=10)
                print(f"      状态码: {response.status_code}")
                
                if response.status_code == 200:
                    result = response.json()
                    print(f"      ✅ 成功: {result}")
                    
                    # 检查是否有下载链接
                    if 'model_url' in result or 'download_url' in result or 'result' in result:
                        print(f"      🎉 找到下载链接！")
                        break
                elif response.status_code not in [404, 405]:
                    print(f"      🔍 响应: {response.text[:200]}...")
                else:
                    print(f"      ❌ 404/405")
                    
            except Exception as e:
                print(f"      ❌ 错误: {e}")
                
    except Exception as e:
        print(f"❌ 任务检查失败: {e}")

print("\n🧪 测试不同的状态查询方法:")
# 尝试POST方法查询状态
for task_id in task_ids:
    try:
        print(f"\n📡 POST查询任务: {task_id}")
        post_url = "https://api.tripo3d.ai/v2/openapi/task/status"
        data = {"task_id": task_id}
        
        response = requests.post(post_url, headers=headers, json=data, timeout=10)
        print(f"   状态码: {response.status_code}")
        if response.status_code == 200:
            print(f"   ✅ 成功: {response.json()}")
        else:
            print(f"   🔍 响应: {response.text[:200]}...")
            
    except Exception as e:
        print(f"   ❌ 错误: {e}")
