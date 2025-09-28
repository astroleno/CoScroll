@echo off
echo 正在安装字体转PNG工具依赖...
echo.

REM 检查Python是否安装
python --version >nul 2>&1
if errorlevel 1 (
    echo 错误：未找到Python，请先安装Python 3.x
    echo 下载地址：https://www.python.org/downloads/
    pause
    exit /b 1
)

echo 检测到Python环境
python --version

echo.
echo 正在安装Pillow库...
pip install -r requirements.txt

if errorlevel 1 (
    echo.
    echo 安装失败！请检查网络连接或Python环境
    pause
    exit /b 1
)

echo.
echo ✅ 依赖安装完成！
echo.
echo 使用方法：
echo 1. 将字体文件放在此目录下
echo 2. 运行：python font_to_png.py 字体文件.ttf "文字内容"
echo 3. 或运行：python run_example.py 查看演示
echo.
pause
