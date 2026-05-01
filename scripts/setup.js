#!/usr/bin/env node
/**
 * Okul Tedarik - Otomatik Setup Script
 * XAMPP MySQL ile calisir
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function execCommand(command, options = {}) {
  try {
    return execSync(command, {
      stdio: options.silent ? 'pipe' : 'inherit',
      encoding: 'utf-8',
      windowsHide: true,
      ...options
    });
  } catch (error) {
    if (options.ignoreError) return null;
    throw error;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkPort(port) {
  try {
    const result = execCommand(`netstat -an | findstr :${port}`, { silent: true });
    return result && result.includes('LISTENING');
  } catch {
    return false;
  }
}

async function startXAMPPMySQL() {
  log('\n[1/4] MySQL kontrol ediliyor...', 'blue');

  const isRunning = await checkPort(3306);

  if (isRunning) {
    log('MySQL zaten calisiyor', 'green');
    return true;
  }

  // Try to start XAMPP MySQL
  const xamppPaths = [
    'C:\\xampp\\mysql_start.bat',
    'C:\\xampp\\xampp_start.exe'
  ];

  for (const xamppPath of xamppPaths) {
    if (fs.existsSync(xamppPath)) {
      log('XAMPP MySQL baslatiliyor...', 'yellow');
      try {
        execCommand(`start /b "" "${xamppPath}"`, { silent: true, ignoreError: true });

        // Wait for MySQL to start
        for (let i = 0; i < 15; i++) {
          await sleep(2000);
          if (await checkPort(3306)) {
            log('MySQL baslatildi', 'green');
            return true;
          }
          process.stdout.write('.');
        }
      } catch (e) {
        // Continue to next path
      }
    }
  }

  log('\nMySQL baslatilamadi!', 'red');
  log('Lutfen XAMPP Control Panel\'den MySQL\'i manuel olarak baslatin.', 'yellow');
  return false;
}

async function createDatabase() {
  log('\n[2/4] Veritabani kontrol ediliyor...', 'blue');

  try {
    // Create database if not exists using mysql command
    const mysqlPath = 'C:\\xampp\\mysql\\bin\\mysql.exe';
    if (fs.existsSync(mysqlPath)) {
      execCommand(`"${mysqlPath}" -u root -e "CREATE DATABASE IF NOT EXISTS okul_tedarik CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"`, { silent: true, ignoreError: true });
    }
    log('Veritabani hazir', 'green');
    return true;
  } catch (error) {
    log('Veritabani olusturulamadi (zaten mevcut olabilir)', 'yellow');
    return true;
  }
}

async function pushSchema() {
  log('\n[3/4] Veritabani semasi senkronize ediliyor...', 'blue');
  try {
    execCommand('npx prisma db push --skip-generate');
    execCommand('npx prisma generate', { silent: true });
    log('Sema senkronize edildi', 'green');
    return true;
  } catch (error) {
    log(`Sema hatasi: ${error.message}`, 'red');
    return false;
  }
}

async function checkAndSeed() {
  log('\n[4/4] Test verileri kontrol ediliyor...', 'blue');

  try {
    // Simple check using prisma
    const result = execCommand('npx prisma db execute --stdin', {
      input: 'SELECT COUNT(*) as cnt FROM admins;',
      silent: true,
      ignoreError: true
    });

    // If query fails or returns 0, run seed
    if (!result || result.includes('0') || result.includes('error')) {
      log('Seed calistiriliyor...', 'yellow');
      execCommand('npx prisma db seed', { ignoreError: true });
    }

    log('Veriler hazir', 'green');
    return true;
  } catch {
    // Try seed anyway
    try {
      log('Seed calistiriliyor...', 'yellow');
      execCommand('npx prisma db seed', { ignoreError: true });
      log('Seed tamamlandi', 'green');
    } catch {
      log('Seed atlanamadi (veri mevcut)', 'yellow');
    }
    return true;
  }
}

async function main() {
  log('========================================', 'cyan');
  log('  OKUL TEDARIK - OTOMATIK KURULUM', 'cyan');
  log('========================================', 'cyan');

  const mysqlReady = await startXAMPPMySQL();
  if (!mysqlReady) {
    log('\nManuel adimlar:', 'yellow');
    log('1. XAMPP Control Panel\'i acin', 'reset');
    log('2. MySQL\'in yanindaki "Start" butonuna tiklayin', 'reset');
    log('3. Bu scripti tekrar calistirin: npm run setup', 'reset');
    process.exit(1);
  }

  await createDatabase();

  const schemaReady = await pushSchema();
  if (!schemaReady) {
    process.exit(1);
  }

  await checkAndSeed();

  log('\n========================================', 'cyan');
  log('  KURULUM TAMAMLANDI!', 'green');
  log('========================================', 'cyan');
  log('\nBaslatmak icin: npm run dev', 'yellow');
  log('\nGiris Bilgileri:', 'yellow');
  log('  Admin: admin@okultedarik.com / admin123', 'reset');
  log('  Mudur: mudur@ataturkilkokulu.k12.tr / mudur123', 'reset');
  log('\n');
}

main().catch(err => {
  log(`Hata: ${err.message}`, 'red');
  process.exit(1);
});
