@echo off
echo ========================================
echo PNG转3D模型模块安装脚本
echo ========================================

echo.
echo 📦 正在安装Python依赖包...
pip install -r requirements.txt

if %errorlevel% neq 0 (
    echo ❌ 依赖包安装失败！
    pause
    exit /b 1
)

echo.
echo ✅ 依赖包安装完成！

echo.
echo 🔧 正在创建必要的目录...
if not exist "models_output" mkdir models_output
if not exist "temp" mkdir temp

echo.
echo 📝 配置说明:
echo 1. 请设置环境变量 TRIPO3D_API_KEY
echo 2. 确保 ../character2png/words_output 目录存在PNG文件
echo 3. 运行 python main.py check 检查配置

echo.
echo 🚀 安装完成！可以使用以下命令:
echo   python main.py single image.png    # 处理单个图片
echo   python main.py batch               # 批量处理
echo   python main.py check               # 检查配置
echo   python example_usage.py            # 运行示例

echo.
pause
