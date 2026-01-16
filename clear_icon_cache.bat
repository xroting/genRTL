@echo off
echo ========================================
echo 清理 Windows 图标缓存
echo ========================================
echo.

echo 正在关闭 genRTL...
taskkill /F /IM genRTL.exe 2>nul
timeout /t 2 /nobreak >nul

echo 正在关闭 Windows 资源管理器...
taskkill /F /IM explorer.exe

echo 正在删除图标缓存文件...
cd /d %userprofile%\AppData\Local

attrib -h IconCache.db 2>nul
del IconCache.db /f /q 2>nul

attrib -h iconcache_*.db 2>nul
del iconcache_*.db /f /q 2>nul

cd Microsoft\Windows\Explorer
attrib -h iconcache_*.db 2>nul
del iconcache_*.db /f /q 2>nul
del thumbcache_*.db /f /q 2>nul

echo.
echo 图标缓存已清理！
echo 正在重启 Windows 资源管理器...
timeout /t 2 /nobreak >nul

start explorer.exe

echo.
echo ========================================
echo 完成！现在可以重新启动 genRTL 查看新图标
echo ========================================
echo.
pause

