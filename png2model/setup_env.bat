@echo off
echo ========================================
echo 设置Tripo3D API环境变量
echo ========================================

echo.
echo 请按照以下步骤设置API密钥:
echo 1. 访问 https://platform.tripo3d.ai/
echo 2. 注册并登录账户
echo 3. 在开发者设置中获取API密钥
echo.

set /p API_KEY="请输入您的Tripo3D API密钥: "

if "%API_KEY%"=="" (
    echo ❌ 未输入API密钥，退出设置
    pause
    exit /b 1
)

echo.
echo 正在设置环境变量...

REM 设置环境变量
set FAL_KEY=%API_KEY%

REM 创建.env.local文件
echo FAL_KEY=%API_KEY% > .env.local
echo TRIPO3D_BASE_URL=https://api.tripo3d.ai/v1 >> .env.local
echo MODEL_QUALITY=high >> .env.local
echo MODEL_FORMAT=glb >> .env.local
echo MODEL_RESOLUTION=1024 >> .env.local
echo MODEL_DETAIL_LEVEL=8 >> .env.local
echo BATCH_SIZE=5 >> .env.local
echo MAX_RETRIES=3 >> .env.local
echo RETRY_DELAY=2 >> .env.local
echo LOG_LEVEL=INFO >> .env.local
echo LOG_FILE=./png2model.log >> .env.local

echo ✅ 环境变量设置完成！
echo.
echo 📁 已创建 .env.local 文件
echo 🔑 API密钥已设置到环境变量
echo.
echo 现在可以运行以下命令测试:
echo   python main.py check
echo   python example_usage.py
echo.
pause
