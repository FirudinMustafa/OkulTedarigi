@echo off
chcp 65001 >nul
echo.
echo  Sunucu durduruluyor...
taskkill /f /im node.exe >nul 2>&1
echo  [OK] Sunucu durduruldu.
echo.
