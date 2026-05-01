@echo off
chcp 65001 >nul
title Veritabani Sifirlama
color 0E

echo.
echo  ╔═══════════════════════════════════════════════════════════╗
echo  ║         VERITABANI SIFIRLAMA VE ORNEK VERI YUKLEME        ║
echo  ╚═══════════════════════════════════════════════════════════╝
echo.
echo  UYARI: Tum veriler silinecek ve ornek veriler yuklenecek!
echo.
set /p confirm="Devam etmek istiyor musunuz? (E/H): "
if /i not "%confirm%"=="E" (
    echo  Iptal edildi.
    pause
    exit /b 0
)

echo.
echo  [..] Veritabani sifirlaniyor...
call npx prisma db push --force-reset --skip-generate >nul 2>&1
if errorlevel 1 (
    echo  [HATA] Veritabani sifirlama basarisiz!
    pause
    exit /b 1
)

echo  [..] Ornek veriler yukleniyor...
call npx prisma db seed
if errorlevel 1 (
    echo  [HATA] Seed basarisiz!
    pause
    exit /b 1
)

echo.
echo  ╔═══════════════════════════════════════════════════════════╗
echo  ║                    ISLEM TAMAMLANDI!                      ║
echo  ╠═══════════════════════════════════════════════════════════╣
echo  ║  Ornek Hesaplar:                                          ║
echo  ║  Admin:   admin@okultedarik.com / admin123                ║
echo  ║  Mudur:   mudur@ataturkilkokulu.k12.tr / mudur123         ║
echo  ╚═══════════════════════════════════════════════════════════╝
echo.
pause
