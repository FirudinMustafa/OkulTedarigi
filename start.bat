@echo off
chcp 65001 >nul
title Okul Tedarik Sistemi
color 0A
cd /d "%~dp0"

echo.
echo  ╔═══════════════════════════════════════════════════════════╗
echo  ║          OKUL TEDARIK SISTEMI - OTOMATIK KURULUM          ║
echo  ╚═══════════════════════════════════════════════════════════╝
echo.

:: ============================================
:: 1. NODE.JS KONTROLU
:: ============================================
where node >nul 2>&1
if errorlevel 1 (
    echo  [HATA] Node.js bulunamadi!
    echo         https://nodejs.org adresinden indirin.
    pause
    exit /b 1
)
echo  [OK] Node.js mevcut

:: ============================================
:: 2. XAMPP MYSQL YOLUNU BUL
:: ============================================
set "XAMPP_PATH="
if exist "C:\xampp\mysql\bin\mysql.exe" set "XAMPP_PATH=C:\xampp"
if exist "D:\xampp\mysql\bin\mysql.exe" set "XAMPP_PATH=D:\xampp"
if exist "C:\Program Files\xampp\mysql\bin\mysql.exe" set "XAMPP_PATH=C:\Program Files\xampp"

if "%XAMPP_PATH%"=="" (
    echo  [HATA] XAMPP bulunamadi!
    echo         C:\xampp veya D:\xampp klasorune XAMPP kurun.
    pause
    exit /b 1
)
echo  [OK] XAMPP bulundu: %XAMPP_PATH%

:: ============================================
:: 3. MYSQL KONTROLU VE BASLATMA
:: ============================================
netstat -an 2>nul | findstr ":3306.*LISTENING" >nul 2>&1
if errorlevel 1 (
    echo  [..] MySQL baslatiliyor...
    start "" /b "%XAMPP_PATH%\mysql_start.bat" >nul 2>&1

    :: MySQL'in baslamasini bekle (max 30 saniye)
    set /a count=0
    :wait_mysql
    timeout /t 2 /nobreak >nul
    netstat -an 2>nul | findstr ":3306.*LISTENING" >nul 2>&1
    if not errorlevel 1 goto mysql_ready
    set /a count+=1
    if %count% lss 15 goto wait_mysql

    echo  [HATA] MySQL baslatilamadi! XAMPP'i manuel acin.
    pause
    exit /b 1
)
:mysql_ready
echo  [OK] MySQL calisiyor

:: ============================================
:: 4. NODE_MODULES KONTROLU
:: ============================================
if not exist "node_modules\" (
    echo  [..] Paketler yukleniyor (ilk kurulum)...
    call npm install --silent
    if errorlevel 1 (
        echo  [HATA] npm install basarisiz!
        pause
        exit /b 1
    )
)
echo  [OK] Node paketleri hazir

:: ============================================
:: 5. VERITABANI KURULUMU
:: ============================================
echo  [..] Veritabani kontrol ediliyor...
"%XAMPP_PATH%\mysql\bin\mysql.exe" -u root -e "CREATE DATABASE IF NOT EXISTS okul_tedarik CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>nul
if errorlevel 1 (
    echo  [UYARI] Veritabani olusturulamadi, devam ediliyor...
)

:: Prisma senkronizasyonu
call npx prisma db push --skip-generate >nul 2>&1
call npx prisma generate >nul 2>&1

:: Veritabaninda admin var mi kontrol et, yoksa seed calistir
"%XAMPP_PATH%\mysql\bin\mysql.exe" -u root -N -e "SELECT COUNT(*) FROM okul_tedarik.admins;" 2>nul | findstr "^0$" >nul 2>&1
if not errorlevel 1 (
    echo  [..] Ilk kurulum - veriler yukleniyor...
    call npx prisma db seed >nul 2>&1
    if errorlevel 1 (
        echo  [UYARI] Seed yuklenemedi, devam ediliyor...
    ) else (
        echo  [OK] Ornek veriler yuklendi
    )
)
echo  [OK] Veritabani hazir

:: ============================================
:: 6. SUNUCU BASLATMA
:: ============================================
echo.
echo  ╔═══════════════════════════════════════════════════════════╗
echo  ║                      SISTEM HAZIR!                        ║
echo  ╠═══════════════════════════════════════════════════════════╣
echo  ║  Site:    http://localhost:3000                           ║
echo  ║                                                           ║
echo  ║  Admin:   admin@okultedarik.com / admin123                ║
echo  ║  Mudur:   mudur@ataturkilkokulu.k12.tr / mudur123         ║
echo  ╠═══════════════════════════════════════════════════════════╣
echo  ║  Durdurmak icin: CTRL+C                                   ║
echo  ╚═══════════════════════════════════════════════════════════╝
echo.

:: Tarayiciyi ac (3 saniye sonra)
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3000"

:: Sunucuyu baslat
call npm run dev
