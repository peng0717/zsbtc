@echo off
chcp 65001 >nul
title 掌上设备通 - 启动中...

echo ================================
echo   掌上设备通 - 启动脚本
echo ================================
echo.
echo 正在启动后端服务器 (端口 3001)...
start "掌上设备通-后端" cmd /k "cd /d %~dp0 && echo [后端] 启动中... && npm start"
echo 后端已在新窗口启动
echo.
echo 正在启动前端服务 (端口 3000)...
start "掌上设备通-前端" cmd /k "cd /d %~dp0 && echo [前端] 启动中... && npm run dev"
echo 前端已在新窗口启动
echo.
echo ================================
echo   启动完成！
echo.
echo   后端: http://localhost:3001
echo   前端: http://localhost:3000
echo   手机: http://192.168.0.100:3000
echo.
echo   请勿关闭弹出的两个命令行窗口
echo ================================
echo.
pause
（内容由AI生成，仅供参考）
