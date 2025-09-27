#!/usr/bin/env python3
"""
下载生成的3D模型
"""

import requests
import os

# 第一个任务的下载链接
model_url = "https://tripo-data.rg1.data.tripo3d.com/tcli_c31dc2e16812465b9be909721e5fb5cd/20250927/861e151f-98e9-4b64-8c56-a739db9b0880/tripo_pbr_model_861e151f-98e9-4b64-8c56-a739db9b0880.glb?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly90cmlwby1kYXRhLnJnMS5kYXRhLnRyaXBvM2QuY29tL3RjbGlfYzMxZGMyZTE2ODEyNDY1YjliZTkwOTcyMWU1ZmI1Y2QvMjAyNTA5MjcvODYxZTE1MWYtOThlOS00YjY0LThjNTYtYTczOWRiOWIwODgwL3RyaXBvX3Bicl9tb2RlbF84NjFlMTUxZi05OGU5LTRiNjQtOGM1Ni1hNzM5ZGI5YjA4ODAuZ2xiIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNzU5MDE3NjAwfX19XX0_&Signature=lKSg41j7ANPOan-j8wbCoQy4rJVViHvwMreIvSeqgO2tnQYFQPKseOUJ~OVZnCpnHccxI~ZCGjYOt7f0eSn3gWP-rx5pGcUvBjPYTTBaPwmkAe2iwqEjV6BAwmCSWeUX-98yYU6PDkxICXK9D2gfzWalZ0BaIV2ll1TkOk8czkxmhLRG1S8VZFXM5m8~TZbjG9Z3e~giXPUFss248AKA-DJ3qjvJjlWXnuN22TV4dhXC3L5bQY6Vk3VT7w3G-a1Djux8mGQXozYmaOvjI71YETLopcmdJaaB2WreG9DyKDiJv6d2cTI1v~C7uoqOr88DtjyER1Mvux~hA8shvnrJ~w__&Key-Pair-Id=K1676C64NMVM2J"

output_file = "善_3d_model.glb"

print(f"📥 正在下载3D模型...")
print(f"🔗 下载链接: {model_url[:100]}...")

try:
    response = requests.get(model_url, timeout=60)
    
    if response.status_code == 200:
        with open(output_file, 'wb') as f:
            f.write(response.content)
        
        file_size = os.path.getsize(output_file)
        print(f"✅ 下载成功！")
        print(f"📁 文件保存为: {output_file}")
        print(f"📊 文件大小: {file_size:,} 字节 ({file_size/1024/1024:.2f} MB)")
        
        # 检查文件是否有效
        if file_size > 0:
            print(f"🎉 3D模型文件已成功下载！")
        else:
            print(f"❌ 下载的文件为空")
    else:
        print(f"❌ 下载失败: HTTP {response.status_code}")
        print(f"响应: {response.text[:200]}...")
        
except Exception as e:
    print(f"❌ 下载错误: {e}")
