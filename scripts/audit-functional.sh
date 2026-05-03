#!/bin/bash
# AUDIT FUNCTIONAL TEST — 8 kategoride end-to-end test.
# Output: PASS/FAIL satırları (kolayca grep'lenebilir)
# Usage: bash scripts/audit-functional.sh

set +e  # devam et, hata olunca durmaz

BASE="http://localhost:3000"
ADM="-b /tmp/admin.cookie"
MD1="-b /tmp/mudur1.cookie"
MD2="-b /tmp/mudur2.cookie"

PASS=0
FAIL=0
declare -a FAILURES

assert_code() {
  local label="$1"
  local expected="$2"
  local actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "  ✅ $label (HTTP $actual)"
    PASS=$((PASS+1))
  else
    echo "  ❌ $label (beklenen $expected, gerçek $actual)"
    FAILURES+=("$label: beklenen=$expected gerçek=$actual")
    FAIL=$((FAIL+1))
  fi
}

assert_contains() {
  local label="$1"
  local needle="$2"
  local haystack="$3"
  if echo "$haystack" | grep -qE "$needle"; then
    echo "  ✅ $label"
    PASS=$((PASS+1))
  else
    echo "  ❌ $label (içerik: $(echo $haystack | head -c 200))"
    FAILURES+=("$label: '$needle' bulunamadı")
    FAIL=$((FAIL+1))
  fi
}

echo ""
echo "===== 3.1 AUTH testleri ====="

# Admin doğru şifre
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/admin/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@okultedarigim.com","password":"Admin123456!@"}')
assert_code "Admin doğru şifre login" "200" "$code"

# Admin yanlış şifre
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/admin/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@okultedarigim.com","password":"yanlissifre"}')
assert_code "Admin yanlış şifre" "401" "$code"

# Müdür doğru şifre
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/mudur/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"audit-mudur1@test.local","password":"AuditMudur123!"}')
assert_code "Müdür doğru şifre login" "200" "$code"

# Müdür yanlış şifre
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/mudur/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"audit-mudur1@test.local","password":"yanlis"}')
assert_code "Müdür yanlış şifre" "401" "$code"

# Anonim → admin endpoint
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/admin/orders")
assert_code "Anonim → /api/admin/orders → 401" "401" "$code"

# Anonim → mudur endpoint
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/mudur/orders/export")
assert_code "Anonim → /api/mudur/orders/export → 401" "401" "$code"

# Veli yanlış okul şifresi
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/veli/verify-password" \
  -H "Content-Type: application/json" -d '{"password":"YANLISKOD123"}')
assert_code "Veli yanlış okul şifresi" "401" "$code"

# Veli doğru AUDIT şifre
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/veli/verify-password" \
  -H "Content-Type: application/json" -d '{"password":"AUDIT_ATATURK_PWD_001"}')
assert_code "Veli AUDIT okul şifresi doğru" "200" "$code"

# Veli pasif okulun şifresi
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/veli/verify-password" \
  -H "Content-Type: application/json" -d '{"password":"AUDIT_PASIF_PWD"}')
assert_code "Pasif okul şifresi reddedilmeli" "401" "$code"

echo ""
echo "===== 3.2 İZOLASYON testleri ====="

# Müdür token → admin endpoint
code=$(curl -s -o /dev/null -w "%{http_code}" $MD1 "$BASE/api/admin/orders")
assert_code "Müdür → /api/admin/orders" "401" "$code"

# Admin token → mudur endpoint
code=$(curl -s -o /dev/null -w "%{http_code}" $ADM "$BASE/api/mudur/orders/export")
assert_code "Admin → /api/mudur/orders/export" "401" "$code"

# Müdür A token → kendi okulunun verisi (mudur dashboard server-rendered)
code=$(curl -s -o /dev/null -w "%{http_code}" $MD1 "$BASE/mudur/siparisler")
assert_code "Müdür1 → /mudur/siparisler (kendi)" "200" "$code"

# Müdür A → mudur orders export (kendi okul, school-scoped query)
code=$(curl -s -o /dev/null -w "%{http_code}" $MD1 "$BASE/api/mudur/orders/export")
assert_code "Müdür1 → /api/mudur/orders/export (kendi okul)" "200" "$code"

# Anonim token → admin sayfası (redirect beklenir)
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/admin/siparisler")
assert_code "Anonim → /admin/siparisler (redirect)" "307" "$code"

echo ""
echo "===== 3.3 SİPARİŞ AKIŞI (status transitions) ====="

# Yeni temiz sipariş bul (NEW durumdaki bir AUDIT siparişi)
NEW_ID=$(mysql -u root --batch --skip-column-names -e \
  "USE okul_tedarik; SELECT id FROM orders WHERE orderNumber LIKE 'ORD-2026-AUDIT-%' AND status='NEW' AND cancelRequest IS NULL LIMIT 1;" 2>/dev/null \
  || /c/xampp/mysql/bin/mysql.exe -u root --batch --skip-column-names -e \
  "USE okul_tedarik; SELECT id FROM orders WHERE orderNumber LIKE 'ORD-2026-AUDIT-%' AND status='NEW' LIMIT 1;")
echo "  Test sipariş ID: $NEW_ID"

# NEW → PAID (geçerli)
code=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE/api/admin/orders/$NEW_ID" $ADM \
  -H "Content-Type: application/json" -d '{"status":"PAID"}')
assert_code "NEW → PAID" "200" "$code"

# PAID → CONFIRMED
code=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE/api/admin/orders/$NEW_ID" $ADM \
  -H "Content-Type: application/json" -d '{"status":"CONFIRMED"}')
assert_code "PAID → CONFIRMED" "200" "$code"

# CONFIRMED → INVOICED (invoice endpoint)
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/admin/orders/$NEW_ID/invoice" $ADM)
assert_code "CONFIRMED → INVOICED (invoice POST)" "200" "$code"

# INVOICED → SHIPPED (shipment endpoint, deliveryType=CARGO için)
DEL_TYPE=$(/c/xampp/mysql/bin/mysql.exe -u root --batch --skip-column-names -e \
  "USE okul_tedarik; SELECT s.deliveryType FROM orders o JOIN classes c ON c.id=o.classId JOIN schools s ON s.id=c.schoolId WHERE o.id='$NEW_ID';")
echo "  Order deliveryType: $DEL_TYPE"

if [ "$DEL_TYPE" = "CARGO" ]; then
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/admin/orders/$NEW_ID/shipment" $ADM)
  assert_code "INVOICED → SHIPPED (CARGO)" "200" "$code"
  # SHIPPED → DELIVERED
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/admin/deliveries/batch" $ADM \
    -H "Content-Type: application/json" -d "{\"orderIds\":[\"$NEW_ID\"],\"action\":\"DELIVERED\"}")
  assert_code "SHIPPED → DELIVERED" "200" "$code"
else
  # SCHOOL_DELIVERY: INVOICED → DELIVERED direkt
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/admin/deliveries/batch" $ADM \
    -H "Content-Type: application/json" -d "{\"orderIds\":[\"$NEW_ID\"],\"action\":\"DELIVERED\"}")
  assert_code "INVOICED → DELIVERED (SCHOOL_DELIVERY)" "200" "$code"
fi

# DELIVERED → COMPLETED
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/admin/deliveries/batch" $ADM \
  -H "Content-Type: application/json" -d "{\"orderIds\":[\"$NEW_ID\"],\"action\":\"COMPLETED\"}")
assert_code "DELIVERED → COMPLETED" "200" "$code"

# Geçersiz transition: COMPLETED → NEW
code=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE/api/admin/orders/$NEW_ID" $ADM \
  -H "Content-Type: application/json" -d '{"status":"NEW"}')
assert_code "Geçersiz: COMPLETED → NEW" "400" "$code"

# CANCELLED akışı: yeni order al
CANCEL_ID=$(/c/xampp/mysql/bin/mysql.exe -u root --batch --skip-column-names -e \
  "USE okul_tedarik; SELECT o.id FROM orders o WHERE o.orderNumber LIKE 'ORD-2026-AUDIT-%' AND o.status='CONFIRMED' AND NOT EXISTS (SELECT 1 FROM cancel_requests cr WHERE cr.orderId=o.id) LIMIT 1;")
echo "  Cancel test ID: $CANCEL_ID"

code=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE/api/admin/orders/$CANCEL_ID" $ADM \
  -H "Content-Type: application/json" -d '{"status":"CANCELLED"}')
assert_code "CONFIRMED → CANCELLED" "200" "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE/api/admin/orders/$CANCEL_ID" $ADM \
  -H "Content-Type: application/json" -d '{"status":"REFUNDED"}')
assert_code "CANCELLED → REFUNDED" "200" "$code"

# REFUNDED'tan başka bir şey (terminal state)
code=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE/api/admin/orders/$CANCEL_ID" $ADM \
  -H "Content-Type: application/json" -d '{"status":"COMPLETED"}')
assert_code "Geçersiz: REFUNDED → COMPLETED" "400" "$code"

echo ""
echo "===== 3.4 TOPLU İŞLEMLER ====="

# 50 CONFIRMED sipariş ID'si al
CONFIRMED_IDS=$(/c/xampp/mysql/bin/mysql.exe -u root --batch --skip-column-names -e \
  "USE okul_tedarik; SELECT GROUP_CONCAT(CONCAT('\"',id,'\"') SEPARATOR ',') FROM (SELECT id FROM orders WHERE orderNumber LIKE 'ORD-2026-AUDIT-%' AND status='CONFIRMED' LIMIT 10) t;")
res=$(curl -s -X POST "$BASE/api/admin/orders/batch/invoices" $ADM \
  -H "Content-Type: application/json" -d "{\"orderIds\":[$CONFIRMED_IDS]}")
SUCCESS=$(echo "$res" | python -c "import sys,json; print(json.load(sys.stdin).get('summary',{}).get('success', 0))" 2>/dev/null)
assert_contains "Toplu fatura: success > 0 (10 sipariş)" "^[1-9]" "$SUCCESS"

# Karışık durum test: NEW siparişlerine "Toplu Fatura" → 0 başarılı
NEW_IDS=$(/c/xampp/mysql/bin/mysql.exe -u root --batch --skip-column-names -e \
  "USE okul_tedarik; SELECT GROUP_CONCAT(CONCAT('\"',id,'\"') SEPARATOR ',') FROM (SELECT id FROM orders WHERE orderNumber LIKE 'ORD-2026-AUDIT-%' AND status='NEW' LIMIT 5) t;")
res=$(curl -s -X POST "$BASE/api/admin/orders/batch/invoices" $ADM \
  -H "Content-Type: application/json" -d "{\"orderIds\":[$NEW_IDS]}")
SUCCESS=$(echo "$res" | python -c "import sys,json; print(json.load(sys.stdin).get('summary',{}).get('success', 0))" 2>/dev/null)
assert_code "NEW siparişlere toplu fatura → 0 başarılı" "0" "$SUCCESS"

# Müdür → admin batch endpoint denemesi
res_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/admin/orders/batch/invoices" $MD1 \
  -H "Content-Type: application/json" -d "{\"orderIds\":[]}")
assert_code "Müdür → admin batch endpoint" "401" "$res_code"

echo ""
echo "===== 3.5 SİPARİŞ OLUŞTURMA validation ====="

CLASS_ID=$(/c/xampp/mysql/bin/mysql.exe -u root --batch --skip-column-names -e \
  "USE okul_tedarik; SELECT c.id FROM classes c JOIN schools s ON s.id=c.schoolId WHERE s.name LIKE 'AUDIT_%' AND s.isActive=1 AND c.isActive=1 AND c.packageId IS NOT NULL LIMIT 1;")
echo "  Test class ID: $CLASS_ID"

# Geçersiz TC
res_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/veli/order" \
  -H "Content-Type: application/json" \
  -d "{\"classId\":\"$CLASS_ID\",\"parentName\":\"Test\",\"students\":[{\"firstName\":\"A\",\"lastName\":\"B\",\"section\":\"A\"}],\"phone\":\"05551112233\",\"email\":\"t@t.com\",\"address\":\"Test addr 12345\",\"isCorporateInvoice\":false,\"taxNumber\":\"00000000000\"}")
assert_code "Geçersiz TC (sıfır) reddedilmeli" "400" "$res_code"

# Geçersiz telefon
res_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/veli/order" \
  -H "Content-Type: application/json" \
  -d "{\"classId\":\"$CLASS_ID\",\"parentName\":\"Test\",\"students\":[{\"firstName\":\"A\",\"lastName\":\"B\",\"section\":\"A\"}],\"phone\":\"123\",\"email\":\"t@t.com\",\"address\":\"Test addr 12345\",\"isCorporateInvoice\":false,\"taxNumber\":\"10000000146\"}")
assert_code "Geçersiz telefon reddedilmeli" "400" "$res_code"

# 6 öğrenci (max 5'i geçer)
res_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/veli/order" \
  -H "Content-Type: application/json" \
  -d "{\"classId\":\"$CLASS_ID\",\"parentName\":\"Test\",\"students\":[{\"firstName\":\"A\",\"lastName\":\"B\"},{\"firstName\":\"C\",\"lastName\":\"D\"},{\"firstName\":\"E\",\"lastName\":\"F\"},{\"firstName\":\"G\",\"lastName\":\"H\"},{\"firstName\":\"I\",\"lastName\":\"J\"},{\"firstName\":\"K\",\"lastName\":\"L\"}],\"phone\":\"05551112299\",\"email\":\"t@t.com\",\"address\":\"Test addr 12345\",\"isCorporateInvoice\":false,\"taxNumber\":\"10000000146\"}")
assert_code "6 öğrenci (max 5)" "400" "$res_code"

# Olmayan classId
res_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/veli/order" \
  -H "Content-Type: application/json" \
  -d "{\"classId\":\"olmayan_id_xxx\",\"parentName\":\"Test\",\"students\":[{\"firstName\":\"A\",\"lastName\":\"B\"}],\"phone\":\"05551112250\",\"email\":\"t@t.com\",\"address\":\"Test addr 12345\",\"isCorporateInvoice\":false,\"taxNumber\":\"10000000146\"}")
assert_code "Olmayan classId" "404" "$res_code"

# Pasif okul/sınıf için sipariş
PASIF_CLASS=$(/c/xampp/mysql/bin/mysql.exe -u root --batch --skip-column-names -e \
  "USE okul_tedarik; SELECT c.id FROM classes c JOIN schools s ON s.id=c.schoolId WHERE s.name LIKE 'AUDIT_%' AND (s.isActive=0 OR c.isActive=0) AND c.packageId IS NOT NULL LIMIT 1;")
if [ -n "$PASIF_CLASS" ]; then
  res_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/veli/order" \
    -H "Content-Type: application/json" \
    -d "{\"classId\":\"$PASIF_CLASS\",\"parentName\":\"Test\",\"students\":[{\"firstName\":\"A\",\"lastName\":\"B\"}],\"phone\":\"05551112260\",\"email\":\"t@t.com\",\"address\":\"Test addr 12345\",\"isCorporateInvoice\":false,\"taxNumber\":\"10000000146\"}")
  assert_code "Pasif sınıf/okul siparişi" "403" "$res_code"
fi

# Çok büyük JSON body (1MB+)
BIG=$(python -c "print('A' * 2000000)")  # 2MB string
res_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/veli/order" \
  -H "Content-Type: application/json" \
  -d "{\"classId\":\"$CLASS_ID\",\"orderNote\":\"$BIG\"}" 2>&1 | head -c 50)
assert_contains "Büyük body — server reject veya hata" "^(400|413|500)" "$res_code"

echo ""
echo "===== 3.6 EXCEL/PDF ÇIKTILAR ====="

for ep in \
  "/api/admin/orders/export" \
  "/api/admin/students/export" \
  "/api/admin/payments/export" \
  "/api/admin/reports/export?period=all" \
  "/api/admin/reports/okul-teslim/export"; do
  size=$(curl -s -o /tmp/excel-test.xlsx $ADM "$BASE$ep" -w "%{size_download}")
  ct=$(file /tmp/excel-test.xlsx 2>/dev/null | grep -c "Microsoft Excel\|Composite Document\|Zip archive")
  if [ "$size" -gt 1000 ] && [ "$ct" -ge 1 ]; then
    echo "  ✅ $ep ($size byte, valid xlsx)"
    PASS=$((PASS+1))
  else
    echo "  ❌ $ep ($size byte, type fail)"
    FAIL=$((FAIL+1))
  fi
done

# Müdür exports
for ep in "/api/mudur/orders/export" "/api/mudur/students/export" "/api/mudur/reports/export"; do
  size=$(curl -s -o /tmp/excel-test.xlsx $MD1 "$BASE$ep" -w "%{size_download}")
  if [ "$size" -gt 1000 ]; then
    echo "  ✅ $ep ($size byte)"
    PASS=$((PASS+1))
  else
    echo "  ❌ $ep ($size byte — FAIL)"
    FAIL=$((FAIL+1))
  fi
done

echo ""
echo "===== 3.7 İNDİRİM KODU ====="

# Süresi dolmuş kod
res=$(curl -s -X POST "$BASE/api/veli/discount" \
  -H "Content-Type: application/json" -d '{"code":"AUDIT_EXPIRED","totalAmount":2000}')
err=$(echo "$res" | python -c "import sys,json; d=json.load(sys.stdin); print(d.get('error') or 'NONE')" 2>/dev/null)
assert_contains "Süresi dolmuş kod reddedilmeli" "süresi|dolmus|dolmuş" "$err"

# Min tutar (SABIT500: minAmount 1000)
res=$(curl -s -X POST "$BASE/api/veli/discount" \
  -H "Content-Type: application/json" -d '{"code":"AUDIT_SABIT500","totalAmount":500}')
err=$(echo "$res" | python -c "import sys,json; d=json.load(sys.stdin); print(d.get('error') or 'OK')" 2>/dev/null)
assert_contains "Min tutar koşulu (500<1000)" "minimum|alt sınır" "$err"

# Geçerli tutar ile aynı kod
res=$(curl -s -X POST "$BASE/api/veli/discount" \
  -H "Content-Type: application/json" -d '{"code":"AUDIT_SABIT500","totalAmount":2000}')
ok=$(echo "$res" | python -c "import sys,json; d=json.load(sys.stdin); print(d.get('discount',{}).get('discountAmount', 0))" 2>/dev/null)
assert_contains "Min tutar üstü kabul (2000>=1000)" "^[1-9]" "$ok"

echo ""
echo "===== 3.8 İPTAL TALEBİ AKIŞI ====="

# Audit seed'de PENDING bir cancel request var
PENDING_CR=$(/c/xampp/mysql/bin/mysql.exe -u root --batch --skip-column-names -e \
  "USE okul_tedarik; SELECT cr.id FROM cancel_requests cr JOIN orders o ON o.id=cr.orderId WHERE cr.status='PENDING' AND o.orderNumber LIKE 'ORD-2026-AUDIT-%' LIMIT 1;")
echo "  PENDING cancel-request ID: $PENDING_CR"

if [ -n "$PENDING_CR" ]; then
  # Admin onaylar
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/admin/cancel-requests/$PENDING_CR/process" $ADM \
    -H "Content-Type: application/json" -d '{"status":"APPROVED","adminNote":"Audit test onay"}')
  assert_code "Admin → cancel-request APPROVED" "200" "$code"

  # Aynı cancel-request tekrar process'e
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/admin/cancel-requests/$PENDING_CR/process" $ADM \
    -H "Content-Type: application/json" -d '{"status":"REJECTED"}')
  assert_code "Çift process — race condition koruması" "400" "$code"
fi

echo ""
echo "===== TEST ÖZET ====="
echo "  ✅ PASS: $PASS"
echo "  ❌ FAIL: $FAIL"
if [ ${#FAILURES[@]} -gt 0 ]; then
  echo ""
  echo "  Başarısız testler:"
  for f in "${FAILURES[@]}"; do echo "    - $f"; done
fi
