const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const C = {
  primary: '#4F46E5',
  primaryDark: '#3730A3',
  primaryLight: '#EEF2FF',
  accent: '#7C3AED',
  green: '#059669',
  greenBg: '#ECFDF5',
  red: '#DC2626',
  orange: '#D97706',
  blue: '#2563EB',
  blueBg: '#EFF6FF',
  yellowBg: '#FEF9C3',
  gray900: '#111827',
  gray700: '#374151',
  gray600: '#4B5563',
  gray500: '#6B7280',
  gray400: '#9CA3AF',
  gray200: '#E5E7EB',
  gray100: '#F3F4F6',
  gray50: '#F9FAFB',
  white: '#FFFFFF',
};

const FONT = 'C:/Windows/Fonts/calibri.ttf';
const FONT_B = 'C:/Windows/Fonts/calibrib.ttf';
const FONT_I = 'C:/Windows/Fonts/calibrii.ttf';
const LOGO = path.join(__dirname, '..', 'public', 'logo-optimized.png');

const pw = 595.28; // A4
const ph = 841.89;
const mx = 55; // margin x
const cw = pw - mx * 2; // content width

let doc;

function newPage() {
  doc.addPage({ size: 'A4', margins: { top: 55, bottom: 55, left: mx, right: mx } });
  doc.y = 55;
}

function footer() {
  const y = ph - 38;
  doc.save();
  doc.moveTo(mx, y - 4).lineTo(pw - mx, y - 4).strokeColor(C.gray200).lineWidth(0.5).stroke();
  doc.font(FONT).fontSize(7.5).fillColor(C.gray400);
  doc.text('Okul Tedarik Sistemi', mx, y, { width: cw / 2, align: 'left' });
  doc.text('okultedarik.com', mx + cw / 2, y, { width: cw / 2, align: 'right' });
  doc.restore();
}

function ensureSpace(needed) {
  if (doc.y + needed > ph - 65) {
    // Eğer sayfanın başındaysak tekrar sayfa açma
    if (doc.y > 70) { newPage(); footer(); }
  }
}

function heading(text, color) {
  ensureSpace(100);
  const y = doc.y;
  doc.save();
  doc.roundedRect(mx, y, cw, 36, 6).fill(color || C.primary);
  doc.font(FONT_B).fontSize(15).fillColor(C.white)
    .text(text, mx + 16, y + 10, { width: cw - 32 });
  doc.restore();
  doc.y = y + 46;
}

function sub(text) {
  ensureSpace(30);
  const y = doc.y;
  doc.rect(mx, y, 3, 16).fill(C.primary);
  doc.font(FONT_B).fontSize(12).fillColor(C.primaryDark)
    .text(text, mx + 12, y);
  doc.moveDown(0.5);
}

function p(text) {
  doc.font(FONT).fontSize(10.5).fillColor(C.gray700)
    .text(text, mx, doc.y, { width: cw, lineGap: 3.5 });
  doc.moveDown(0.35);
}

function bold(text) {
  doc.font(FONT_B).fontSize(10.5).fillColor(C.gray900)
    .text(text, mx, doc.y, { width: cw, lineGap: 3 });
  doc.moveDown(0.2);
}

function bullet(text, indent) {
  const x = mx + (indent || 0) * 16;
  const icon = indent ? '○' : '●';
  doc.font(FONT).fontSize(10.5).fillColor(C.gray700);
  doc.text(`${icon}  ${text}`, x, doc.y, { width: cw - (x - mx), lineGap: 2.5 });
  doc.moveDown(0.12);
}

function tipBox(title, text, bg) {
  ensureSpace(60);
  const y = doc.y;
  // Metin yüksekliğini ölç
  const textH = doc.font(FONT).fontSize(9.5).heightOfString(text, { width: cw - 36 });
  const boxH = Math.max(48, textH + 32);
  doc.save();
  doc.roundedRect(mx, y, cw, boxH, 6).fill(bg || C.primaryLight);
  doc.rect(mx, y, 4, boxH).fill(C.primary);
  doc.font(FONT_B).fontSize(10).fillColor(C.primary)
    .text(title, mx + 16, y + 10, { width: cw - 32 });
  doc.font(FONT).fontSize(9.5).fillColor(C.gray600)
    .text(text, mx + 16, y + 25, { width: cw - 36 });
  doc.restore();
  doc.y = y + boxH + 10;
}

function statCard(x, y, w, label, value, sub2, color) {
  doc.save();
  doc.roundedRect(x, y, w, 60, 8).fill(C.white);
  doc.roundedRect(x, y, w, 60, 8).strokeColor(C.gray200).lineWidth(0.5).stroke();
  doc.rect(x, y, w, 5).fill(color);
  doc.font(FONT_B).fontSize(22).fillColor(color)
    .text(value, x, y + 15, { width: w, align: 'center' });
  doc.font(FONT).fontSize(8.5).fillColor(C.gray500)
    .text(label, x, y + 40, { width: w, align: 'center' });
  if (sub2) {
    doc.font(FONT_I).fontSize(7).fillColor(C.gray400)
      .text(sub2, x, y + 50, { width: w, align: 'center' });
  }
  doc.restore();
}

function stepFlow(steps) {
  ensureSpace(steps.length * 46 + 10);
  steps.forEach((s, i) => {
    const y = doc.y;
    const isLast = i === steps.length - 1;
    // Numara dairesi
    doc.save();
    doc.circle(mx + 16, y + 14, 13).fill(s.color || C.primary);
    doc.font(FONT_B).fontSize(11).fillColor(C.white)
      .text(String(i + 1), mx + 4, y + 8, { width: 24, align: 'center' });
    doc.restore();
    // Başlık
    doc.font(FONT_B).fontSize(11).fillColor(C.gray900)
      .text(s.title, mx + 38, y + 4, { width: cw - 44 });
    doc.font(FONT).fontSize(9.5).fillColor(C.gray600)
      .text(s.desc, mx + 38, y + 19, { width: cw - 44 });
    // Bağlantı çizgisi
    if (!isLast) {
      doc.save();
      doc.moveTo(mx + 16, y + 28).lineTo(mx + 16, y + 42)
        .strokeColor(C.gray200).lineWidth(1.5).stroke();
      doc.restore();
    }
    doc.y = y + (isLast ? 36 : 44);
  });
}

function miniTable(headers, rows, opts = {}) {
  const colW = opts.widths || headers.map(() => cw / headers.length);
  ensureSpace(26 + rows.length * 22);

  // Header
  let y = doc.y;
  doc.save();
  doc.roundedRect(mx, y, cw, 24, 4).fill(opts.headerColor || C.primary);
  let xOff = mx;
  headers.forEach((h, i) => {
    doc.font(FONT_B).fontSize(9).fillColor(C.white)
      .text(h, xOff + 6, y + 6, { width: colW[i] - 12, align: 'center' });
    xOff += colW[i];
  });
  doc.restore();
  doc.y = y + 24;

  // Rows
  rows.forEach((row, ri) => {
    y = doc.y;
    const bg = ri % 2 === 0 ? C.white : C.gray50;
    doc.rect(mx, y, cw, 22).fill(bg);
    xOff = mx;
    row.forEach((cell, ci) => {
      doc.font(ci === 0 && opts.boldFirst ? FONT_B : FONT).fontSize(9).fillColor(C.gray700)
        .text(cell, xOff + 6, y + 5, { width: colW[ci] - 12, align: opts.aligns?.[ci] || 'left' });
      xOff += colW[ci];
    });
    doc.y = y + 22;
  });
  // Alt çizgi
  doc.moveTo(mx, doc.y).lineTo(mx + cw, doc.y).strokeColor(C.gray200).lineWidth(0.5).stroke();
  doc.moveDown(0.4);
}

// ==================================================================
//  ANA ÜRETİM
// ==================================================================
function generate() {
  doc = new PDFDocument({
    size: 'A4',
    margins: { top: 55, bottom: 55, left: mx, right: mx },
    info: {
      Title: 'Okul Tedarik Sistemi - Ürün Tanıtım Dokümanı',
      Author: 'Okul Tedarik Sistemi',
    },
    autoFirstPage: false,
    bufferPages: true,
  });

  const out = path.join(__dirname, '..', 'Okul_Tedarik_Sistemi_Tanitim.pdf');
  doc.pipe(fs.createWriteStream(out));

  // ================================================================
  //  KAPAK
  // ================================================================
  doc.addPage({ size: 'A4', margins: { top: 0, bottom: 0, left: 0, right: 0 } });

  // Üst renkli alan
  doc.rect(0, 0, pw, ph * 0.52).fill(C.primary);
  doc.save(); doc.opacity(0.07);
  doc.circle(pw * 0.82, ph * 0.12, 160).fill(C.white);
  doc.circle(pw * 0.12, ph * 0.42, 100).fill(C.white);
  doc.restore();

  // Logo
  if (fs.existsSync(LOGO)) doc.image(LOGO, pw / 2 - 50, 75, { width: 100 });

  doc.font(FONT_B).fontSize(36).fillColor(C.white)
    .text('Okul Tedarik Sistemi', 0, 210, { width: pw, align: 'center' });
  doc.font(FONT).fontSize(15).fillColor('#C7D2FE')
    .text('Okul Kırtasiye Sipariş ve Yönetim Platformu', 0, 260, { width: pw, align: 'center' });

  // Versyon pill
  doc.save();
  doc.roundedRect(pw / 2 - 80, 300, 160, 28, 14).fill('#FFFFFF18');
  doc.font(FONT).fontSize(10).fillColor(C.white)
    .text('v1.0  •  Web Tabanlı  •  Bulut Hazır', pw / 2 - 80, 308, { width: 160, align: 'center' });
  doc.restore();

  // Alt beyaz alan
  const descY = ph * 0.52 + 45;
  doc.font(FONT).fontSize(12).fillColor(C.gray600)
    .text(
      'Velilerin okul kırtasiye malzemelerini kolayca sipariş etmesini, okul müdürlerinin siparişleri takip etmesini ve yöneticilerin tüm süreci uçtan uca yönetmesini sağlayan kapsamlı bir dijital platformdur.',
      70, descY, { width: pw - 140, align: 'center', lineGap: 5 }
    );

  // 3 öne çıkan özellik
  const featY = descY + 95;
  const featW = 140;
  const featGap = (cw - featW * 3) / 2;

  const feats = [
    { title: 'Kolay Sipariş', desc: 'Veliler birkaç adımda sipariş verir', color: C.primary },
    { title: 'Anlık Takip', desc: 'Ödeme, fatura, kargo bir arada', color: C.accent },
    { title: 'Tam Kontrol', desc: 'Raporlama, komisyon, teslimat', color: C.green },
  ];

  feats.forEach((f, i) => {
    const fx = mx + i * (featW + featGap);
    doc.save();
    doc.roundedRect(fx, featY, featW, 62, 8).fill(C.gray50);
    doc.rect(fx, featY, featW, 4).fill(f.color);
    doc.font(FONT_B).fontSize(11).fillColor(f.color)
      .text(f.title, fx, featY + 14, { width: featW, align: 'center' });
    doc.font(FONT).fontSize(8.5).fillColor(C.gray500)
      .text(f.desc, fx + 8, featY + 32, { width: featW - 16, align: 'center' });
    doc.restore();
  });

  doc.font(FONT_I).fontSize(8).fillColor(C.gray400)
    .text(new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }),
      0, ph - 50, { width: pw, align: 'center' });

  // ================================================================
  //  SİSTEM NE YAPAR?
  // ================================================================
  newPage(); footer();
  heading('Sistem Ne Yapar?');

  p('Okul Tedarik Sistemi, okulların kırtasiye ihtiyacını dijitalleştiren bir platformdur. Geleneksel yöntemde veliler tek tek kırtasiyecilere gider, listeleri toplar ve alışverişi yapar. Bu sistem ile tüm bu süreç tek bir noktadan yönetilir:');
  doc.moveDown(0.3);

  bullet('Her okula özel kırtasiye paketleri oluşturulur');
  bullet('Veliler okul şifresi ile giriş yaparak sipariş verir');
  bullet('Ödeme online (kredi kartı) veya kapıda yapılır');
  bullet('Fatura otomatik kesilir, kargo otomatik oluşturulur');
  bullet('Sipariş takibi gerçek zamanlı yapılır');
  bullet('Okul müdürleri kendi okullarının durumunu takip eder');
  bullet('Yöneticiler tüm süreci tek panelden kontrol eder');

  doc.moveDown(0.5);
  tipBox('Kimler Kullanır?',
    'Sistem üç farklı kullanıcı grubuna hitap eder: (1) Veliler — sipariş verir ve takip eder, (2) Okul Müdürleri — okulun sipariş ve komisyon durumunu izler, (3) Yöneticiler — tüm okulları, siparişleri ve finansı yönetir.',
    C.blueBg);

  doc.moveDown(0.3);

  // İstatistik kartları
  const cardW2 = (cw - 30) / 4;
  const cy = doc.y;
  statCard(mx, cy, cardW2, 'Kullanıcı Rolü', '3', 'Veli, Müdür, Admin', C.primary);
  statCard(mx + cardW2 + 10, cy, cardW2, 'Entegrasyon', '6', 'Ödeme, Fatura, Kargo...', C.accent);
  statCard(mx + (cardW2 + 10) * 2, cy, cardW2, 'Bildirim Kanalı', '2', 'Email + SMS', C.green);
  statCard(mx + (cardW2 + 10) * 3, cy, cardW2, 'Yapay Zekâ', '1', 'Chatbot Asistanı', C.blue);
  doc.y = cy + 72;

  // ================================================================
  //  VELİ NASIL SİPARİŞ VERİR?
  // ================================================================
  doc.moveDown(0.5);
  heading('Veli Nasıl Sipariş Verir?', C.accent);

  p('Bir velinin sipariş vermesi sadece birkaç dakika sürer. Hiçbir üyelik veya kayıt gerekmez. Okul tarafından paylaşılan şifre yeterlidir.');
  doc.moveDown(0.3);

  stepFlow([
    { title: 'Okul Şifresi ile Giriş', desc: 'Veli, okulun paylaştığı şifreyi girer. Sistem okulu ve sınıfları otomatik getirir.', color: C.primary },
    { title: 'Sınıf ve Paket Seçimi', desc: 'Çocuğunun sınıfını seçer. O sınıfa atanmış kırtasiye paketi ve içeriği görüntülenir.', color: C.blue },
    { title: 'Bilgileri Doldurma', desc: 'Öğrenci adı, veli bilgileri, teslimat adresi ve ödeme yöntemi girilir.', color: C.accent },
    { title: 'Ödeme', desc: 'Kredi kartı ile güvenli 3D Secure ödeme yapılır. Kapıda ödeme seçeneği de mevcuttur.', color: C.green },
    { title: 'Onay ve Takip', desc: 'Sipariş oluşturulur, email ve SMS ile onay gönderilir. Takip sayfasından süreç izlenir.', color: '#059669' },
  ]);

  doc.moveDown(0.3);
  tipBox('İndirim Kodu',
    'Veliler sipariş sırasında indirim kodu kullanabilir. İndirim yüzde veya sabit tutar olarak uygulanır. Geçerlilik tarihi ve kullanım limiti yönetici tarafından belirlenir.',
    C.yellowBg);

  // ================================================================
  //  SİPARİŞ NE AŞAMALARDAN GEÇER?
  // ================================================================
  doc.moveDown(0.8);
  heading('Sipariş Ne Aşamalardan Geçer?');

  p('Bir sipariş, oluşturulduğu andan teslimatına kadar aşağıdaki aşamalardan geçer. Her aşamada veliye otomatik bildirim gönderilir.');
  doc.moveDown(0.3);

  miniTable(
    ['Aşama', 'Ne Olur?', 'Kim Yapar?'],
    [
      ['Yeni Sipariş', 'Veli formu doldurur, sipariş oluşur', 'Veli'],
      ['Ödeme Bekleniyor', 'Kredi kartı ile ödeme sayfası açılır', 'Sistem'],
      ['Ödeme Alındı', 'Ödeme başarılı, onay bildirimi gönderilir', 'Sistem'],
      ['Onaylandı', 'Yönetici siparişi kontrol eder ve onaylar', 'Yönetici'],
      ['Fatura Kesildi', 'E-fatura otomatik olarak oluşturulur', 'Yönetici'],
      ['Hazırlanıyor', 'Kırtasiye paketi hazırlanır', 'Yönetici'],
      ['Kargoya Verildi', 'Aras Kargo ile gönderilir, takip no paylaşılır', 'Yönetici'],
      ['Teslim Edildi', 'Paket veliye veya okula teslim edilir', 'Yönetici'],
      ['Tamamlandı', 'Sipariş süreci başarıyla sona erer', 'Sistem'],
    ],
    { widths: [105, 250, 130], boldFirst: true, aligns: ['left', 'left', 'center'] }
  );

  doc.moveDown(0.2);
  tipBox('İptal ve İade',
    'Veli, sipariş kargoya verilmeden önce iptal talebinde bulunabilir. Yönetici talebi onaylarsa ödeme otomatik olarak iade edilir ve veliye bildirim gönderilir.',
    '#FEE2E2');

  // ================================================================
  //  TESLİMAT NASIL ÇALIŞIR?
  // ================================================================
  doc.moveDown(0.3);
  heading('Teslimat Nasıl Çalışır?', C.green);

  p('Sistem iki farklı teslimat yöntemi sunar. Teslimat yöntemi okul bazında belirlenir:');
  doc.moveDown(0.3);

  sub('Kargo ile Teslimat');
  p('Paketler Aras Kargo aracılığıyla doğrudan velinin adresine gönderilir. Kargo takip numarası otomatik olarak oluşturulur ve veliye SMS/email ile iletilir. Veli, sipariş takip sayfasından kargo durumunu anlık olarak görebilir.');

  doc.moveDown(0.3);
  sub('Okula Toplu Teslim');
  p('Paketler toplu olarak okula getirilir. Yönetici, "Teslim Tutanağı" oluşturarak hangi siparişlerin kime teslim edildiğini belgeler. Sistem otomatik olarak PDF tutanak üretir. Bu tutanakta teslim alan kişi, tarih, sipariş detayları ve imza alanları yer alır.');

  // ================================================================
  //  YÖNETİCİ (ADMİN) NE YAPAR?
  // ================================================================
  doc.moveDown(0.8);
  heading('Yönetici Paneli Ne Sunar?');

  p('Yönetici paneli, tüm sistemi tek bir noktadan kontrol etme imkânı sunar. Aşağıda yöneticinin yapabileceği tüm işlemler özetlenmektedir:');
  doc.moveDown(0.3);

  sub('Okul ve Sınıf Yönetimi');
  bullet('Yeni okul ekler, mevcut okulları düzenler');
  bullet('Her okula sınıflar tanımlar ve kırtasiye paketi atar');
  bullet('Okul şifrelerini oluşturur ve yeniler');
  bullet('Teslimat tipini belirler (kargo veya okula teslim)');

  doc.moveDown(0.4);
  sub('Paket Yönetimi');
  bullet('Kırtasiye paketleri oluşturur (örn: "1. Sınıf Paketi")');
  bullet('Paket içine ürünler ekler (defter, kalem, silgi vb.)');
  bullet('Her ürünün adedi ve fiyatı belirlenir');
  bullet('Paket toplam fiyatı otomatik hesaplanır');

  doc.moveDown(0.4);
  sub('Sipariş Yönetimi');
  bullet('Tüm siparişleri listeler, arar ve filtreler');
  bullet('Sipariş durumunu günceller (onayla, fatura kes, kargola)');
  bullet('Toplu işlem yapabilir: aynı anda birden fazla siparişe fatura keser veya kargo oluşturur');
  bullet('Sipariş detaylarını görüntüler ve Excel olarak indirir');

  doc.moveDown(0.4);
  sub('Finans ve Hakediş');
  bullet('Okul bazlı komisyon takibi yapar');
  bullet('Ödenmesi gereken komisyonları listeler');
  bullet('Komisyon ödemelerini kaydeder');
  bullet('Dönemsel raporlar ve grafikler sunar');

  doc.moveDown(0.4);
  sub('İptal Talepleri');
  bullet('Velilerden gelen iptal taleplerini listeler');
  bullet('Talebi onaylar veya reddeder');
  bullet('Onaylanan taleplerde iade işlemini başlatır');

  doc.moveDown(0.4);
  sub('İndirim Kodları');
  bullet('Yüzde veya sabit tutarlı indirim kodları oluşturur');
  bullet('Geçerlilik tarihi ve kullanım limiti belirler');
  bullet('Kullanım istatistiklerini takip eder');

  // ================================================================
  //  MÜDÜR PANELİ
  // ================================================================
  doc.moveDown(0.8);
  heading('Okul Müdürü Paneli', C.accent);

  p('Her okul müdürü, kendine özel bir panel ile okulunun durumunu takip eder. Müdür paneli salt okunur niteliktedir; müdür veri girişi yapmaz, sadece izler ve raporlar.');
  doc.moveDown(0.3);

  sub('Genel Bakış (Dashboard)');
  p('Müdür giriş yaptığında okuluna özel özet bilgileri görür:');
  bullet('Toplam sipariş sayısı ve tamamlanma oranı');
  bullet('Toplam ciro ve komisyon geliri');
  bullet('Bekleyen siparişler ve son hareketler');
  bullet('Komisyon detayı: toplam, ödenen, bekleyen');

  doc.moveDown(0.4);
  sub('Sipariş Takibi');
  p('Müdür, okulundaki tüm siparişleri durum renklerine göre takip eder. Hangi sınıftan kaç sipariş geldiğini, hangi siparişlerin tamamlandığını görür. Sipariş listesini Excel olarak indirebilir.');

  doc.moveDown(0.4);
  sub('Sınıf Bilgileri');
  p('Okula tanımlı sınıfları, her sınıfa atanmış kırtasiye paketini ve sipariş istatistiklerini görüntüler.');

  doc.moveDown(0.4);
  sub('Raporlar');
  p('Yıl bazlı filtreleme ile detaylı rapor alabilir:');
  bullet('Sınıf bazlı sipariş sayısı ve ciro');
  bullet('Sipariş durumu dağılımı (grafik)');
  bullet('Teslimat tipi dağılımı');
  bullet('Tüm verileri formatlı Excel dosyası olarak indirebilir');

  // ================================================================
  //  BİLDİRİMLER ve CHATBOT
  // ================================================================
  doc.moveDown(0.5);
  heading('Bildirimler ve Yapay Zekâ Asistanı', C.green);

  sub('Otomatik Bildirimler');
  p('Sistem, sipariş sürecinin her aşamasında velilere otomatik bildirim gönderir. İki kanal kullanılır:');
  doc.moveDown(0.2);

  miniTable(
    ['Aşama', 'Email', 'SMS'],
    [
      ['Sipariş oluşturuldu', 'Sipariş detayları + takip linki', 'Sipariş no ve takip linki'],
      ['Ödeme alındı', 'Ödeme onay detayları', 'Ödeme onayı'],
      ['Kargoya verildi', 'Takip numarası + kargo linki', 'Takip numarası'],
      ['Teslim edildi', 'Teslimat onayı', 'Teslim bilgisi'],
      ['İptal edildi', 'İade bilgileri', 'İptal bildirimi'],
    ],
    { widths: [115, 195, 175], boldFirst: true }
  );

  doc.moveDown(0.3);
  sub('Teddy — Yapay Zekâ Chatbot');
  p('Sistemde Google Gemini destekli "Teddy" adlı bir chatbot asistanı bulunmaktadır. Veliler sipariş süreci hakkında sorularını bu asistana sorabilir. Teddy; sık sorulan soruları anında yanıtlar, sipariş verme ve takip etme konusunda yönlendirir. Admin ve müdür panellerinde gizlidir, yalnızca veli sayfalarında aktif olarak çalışır.');

  // ================================================================
  //  ENTEGRASYONLAR
  // ================================================================
  doc.moveDown(0.8);
  heading('Dış Sistem Entegrasyonları');

  p('Sistem, ödeme, fatura, kargo ve bildirim süreçlerini dış servislerle entegre çalışarak otomatikleştirir. Geliştirme ve test ortamında tüm entegrasyonlar simülasyon (mock) modunda çalıştırılabilir.');
  doc.moveDown(0.3);

  miniTable(
    ['Entegrasyon', 'Servis', 'Ne Yapar?', 'Mock Desteği'],
    [
      ['Ödeme', 'Iyzico', 'Kredi kartı ile 3D Secure ödeme ve iade', 'Evet'],
      ['E-Fatura', 'KolayBi', 'Bireysel ve kurumsal e-fatura kesimi', 'Evet'],
      ['Kargo', 'Aras Kargo', 'Gönderi oluşturma ve takip', 'Evet'],
      ['Email', 'Resend', '5 farklı bildirim şablonu', 'Evet'],
      ['SMS', 'Twilio', '5 farklı bildirim şablonu', 'Evet'],
      ['Yapay Zekâ', 'Google Gemini', 'Chatbot doğal dil anlama', 'Hayır'],
    ],
    { widths: [90, 85, 225, 85], boldFirst: true, aligns: ['left', 'center', 'left', 'center'] }
  );

  doc.moveDown(0.4);
  tipBox('Mock (Simülasyon) Modu',
    'Tüm dış entegrasyonlar .env dosyasındaki ayarlarla mock moduna alınabilir. Bu sayede geliştirme sırasında gerçek servisler çağrılmaz, test verileri ile çalışılır. Üretime geçişte sadece ilgili API anahtarları girilir ve mock kapatılır.',
    C.greenBg);

  // ================================================================
  //  GÜVENLİK
  // ================================================================
  doc.moveDown(0.3);
  heading('Güvenlik ve Veri Koruma', '#DC2626');

  p('Sistem, kullanıcı verilerini ve ödeme bilgilerini korumak için çok katmanlı güvenlik önlemleri uygular:');
  doc.moveDown(0.3);

  bullet('Şifreler tek yönlü hashlenerek saklanır (bcryptjs), düz metin olarak tutulmaz');
  bullet('Oturum bilgileri güvenli JWT token\'ları ile yönetilir (HTTP-only cookie)');
  bullet('Ödeme bilgileri Iyzico altyapısında işlenir, sistemde kredi kartı verisi saklanmaz');
  bullet('3D Secure ile ek doğrulama katmanı');
  bullet('Hız sınırlama (rate limiting) ile kaba kuvvet saldırıları engellenir');
  bullet('Tüm yönetici işlemleri sistem loglarına kaydedilir (denetim izi)');
  bullet('Admin ve müdür panelleri middleware ile korunur, yetkisiz erişim engellenir');

  // ================================================================
  //  ÖZET TABLO
  // ================================================================
  doc.moveDown(0.8);
  heading('Sistem Özet Tablosu');

  p('Aşağıda sistemin tüm bileşenleri ve kapsamı özetlenmektedir:');
  doc.moveDown(0.3);

  miniTable(
    ['Özellik', 'Detay'],
    [
      ['Platform', 'Web tabanlı (masaüstü ve mobil uyumlu)'],
      ['Kullanıcı Rolleri', 'Yönetici, Okul Müdürü, Veli'],
      ['Ödeme Yöntemleri', 'Kredi kartı (3D Secure) ve kapıda ödeme'],
      ['Fatura', 'Otomatik e-fatura (bireysel + kurumsal)'],
      ['Kargo', 'Aras Kargo entegrasyonu + otomatik takip'],
      ['Teslimat', 'Kargo ile adrese veya toplu okula teslim'],
      ['Bildirimler', 'Email (Resend) + SMS (Twilio) — 5 şablon'],
      ['Chatbot', 'Google Gemini AI destekli asistan'],
      ['İndirim', 'Yüzde veya sabit tutarlı kupon sistemi'],
      ['Raporlama', 'Dashboard grafikleri + Excel export'],
      ['Komisyon', 'Okul bazlı hakediş takibi ve ödeme'],
      ['Teslim Tutanağı', 'Otomatik PDF belge üretimi'],
      ['Güvenlik', 'JWT, şifre hashleme, rate limiting, denetim logu'],
      ['Dil', 'Türkçe (tüm arayüz ve bildirimler)'],
    ],
    { widths: [140, 345], boldFirst: true }
  );

  // ================================================================
  //  ARKA KAPAK
  // ================================================================
  doc.addPage({ size: 'A4', margins: { top: 0, bottom: 0, left: 0, right: 0 } });

  doc.rect(0, ph * 0.55, pw, ph * 0.45).fill(C.primary);
  doc.save(); doc.opacity(0.06);
  doc.circle(pw * 0.15, ph * 0.7, 130).fill(C.white);
  doc.circle(pw * 0.85, ph * 0.85, 90).fill(C.white);
  doc.restore();

  if (fs.existsSync(LOGO)) doc.image(LOGO, pw / 2 - 40, ph * 0.22, { width: 80 });

  doc.font(FONT_B).fontSize(24).fillColor(C.gray900)
    .text('Okul Tedarik Sistemi', 0, ph * 0.34, { width: pw, align: 'center' });
  doc.font(FONT).fontSize(11).fillColor(C.gray500)
    .text('Okul Kırtasiye Sipariş ve Yönetim Platformu', 0, ph * 0.38, { width: pw, align: 'center' });

  // Alt alan
  doc.font(FONT_B).fontSize(15).fillColor(C.white)
    .text('İletişim', 0, ph * 0.62, { width: pw, align: 'center' });
  doc.moveDown(0.6);

  ['Web: okultedarik.com', 'Email: destek@okultedarik.com'].forEach(t => {
    doc.font(FONT).fontSize(11).fillColor('#C7D2FE')
      .text(t, 0, doc.y, { width: pw, align: 'center' });
    doc.moveDown(0.25);
  });

  doc.moveDown(1.5);
  doc.font(FONT).fontSize(10).fillColor('#A5B4FC')
    .text('Tüm sipariş, ödeme ve teslimat süreçlerinizi', 0, doc.y, { width: pw, align: 'center' });
  doc.font(FONT_B).fontSize(10).fillColor(C.white)
    .text('tek bir platformdan yönetin.', 0, doc.y, { width: pw, align: 'center' });

  doc.font(FONT_I).fontSize(7.5).fillColor('#818CF8')
    .text(new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }),
      0, ph - 40, { width: pw, align: 'center' });

  // ================================================================
  //  SAYFA NUMARALARI
  // ================================================================
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    if (i === 0 || i === range.count - 1) continue; // kapak ve arka kapak hariç
    doc.save();
    doc.font(FONT).fontSize(7.5).fillColor(C.gray400)
      .text(`${i}`, pw / 2 - 10, ph - 38, { width: 20, align: 'center' });
    doc.restore();
  }

  doc.end();
  console.log('PDF olusturuldu: ' + out);
}

generate();
