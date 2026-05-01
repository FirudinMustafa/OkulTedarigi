#!/bin/bash
# MySQL'i başlat (zaten çalışıyorsa atla) ve Next.js dev server'ı aç

MYSQLD="/c/Program Files/MySQL/MySQL Server 8.4/bin/mysqld.exe"
MYSQL="/c/Program Files/MySQL/MySQL Server 8.4/bin/mysql.exe"
DATADIR="C:/ProgramData/MySQL/data"

# MySQL zaten çalışıyor mu kontrol et
"$MYSQL" -u root -e "SELECT 1" > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "MySQL baslatiliyor..."
  "$MYSQLD" --datadir="$DATADIR" --console &
  sleep 3
  "$MYSQL" -u root -e "SELECT 1" > /dev/null 2>&1
  if [ $? -ne 0 ]; then
    echo "HATA: MySQL baslatilamadi!"
    exit 1
  fi
fi
echo "MySQL hazir."

# Veritabani var mi kontrol et
"$MYSQL" -u root -e "CREATE DATABASE IF NOT EXISTS okul_tedarik;" 2>/dev/null

# Next.js baslat
npm run dev
