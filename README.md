# Okul Tedarik Sistemi

Okullar icin okul malzemesi tedarik ve siparis yonetim sistemi.

## Teknolojiler

### Frontend
- **Next.js 16** - React framework (App Router)
- **React 19** - UI library
- **TailwindCSS 4** - Utility-first CSS
- **Radix UI** - Accessible UI components
- **Lucide React** - Icon library
- **Recharts** - Charts and graphs
- **React Hook Form** - Form management
- **Zod** - Schema validation

### Backend
- **Next.js API Routes** - Backend API
- **Prisma ORM** - Database toolkit
- **MySQL** - Relational database
- **JWT (jose)** - Authentication tokens
- **bcryptjs** - Password hashing

### Utilities
- **date-fns** - Date formatting
- **jsPDF** - PDF generation
- **xlsx** - Excel export
- **class-variance-authority** - Component variants

### AI & Entegrasyonlar
- **Google Gemini** - AI chatbot
- **Iyzico** - Odeme sistemi
- **KolayBi** - E-fatura
- **Aras Kargo** - Kargo takibi

## Ozellikler

- **Admin Paneli**: Okul, sinif, paket, siparis ve hakedis yonetimi
- **Mudur Paneli**: Okul mudurleri icin siparis takibi ve raporlama
- **Veli Arayuzu**: Veliler icin siparis olusturma ve takip
- **AI Chatbot**: Gemini destekli yardim asistani
- **Entegrasyonlar**: Odeme (Iyzico), Fatura (KolayBi), Kargo (Aras)

## Gereksinimler

- Node.js 18+
- MySQL 8.0+
- npm veya yarn

## Kurulum

### 1. Repoyu klonlayin

```bash
git clone https://github.com/FirudinMustafa/OkulTedarik.git
cd OkulTedarik
```

### 2. Bagimliliklari yukleyin

```bash
npm install
```

### 3. Environment degiskenlerini ayarlayin

```bash
cp .env.example .env
```

`.env` dosyasini duzenleyin:

```env
# Veritabani (MySQL baglantisi)
DATABASE_URL="mysql://kullanici:sifre@localhost:3306/okul_tedarik"

# JWT Secret (en az 32 karakter, rastgele bir deger)
JWT_SECRET="guclu-rastgele-secret-key-buraya-yazin"

# Uygulama URL'i
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 4. Veritabanini olusturun

MySQL'de veritabani olusturun:

```sql
CREATE DATABASE okul_tedarik CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Prisma migration'larini calistirin:

```bash
npx prisma migrate deploy
```

### 5. (Opsiyonel) Ornek veri yukleyin

```bash
npm run db:seed
```

### 6. Uygulamayi calistirin

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm run build
npm start
```

Uygulama http://localhost:3000 adresinde calisacak.

## Varsayilan Giris Bilgileri

Seed calistirdiktan sonra varsayilan giris bilgileri icin `GIRIS_BILGILERI.md` dosyasina bakin.

> **Not:** Production ortaminda seed verisini kullanmayin. Kendi admin hesabinizi olusturun ve guclu sifreler kullanin.

## Proje Yapisi

```
src/
├── app/
│   ├── admin/          # Admin paneli sayfalari
│   ├── mudur/          # Mudur paneli sayfalari
│   ├── api/            # API route'lari
│   └── ...             # Veli sayfalari
├── components/         # React componentleri
├── lib/                # Yardimci fonksiyonlar
└── data/               # Statik veriler
prisma/
├── schema.prisma       # Veritabani semasi
├── migrations/         # Migration dosyalari
└── seed.ts             # Ornek veri scripti
```

## Komutlar

| Komut | Aciklama |
|-------|----------|
| `npm run dev` | Development sunucusu |
| `npm run build` | Production build |
| `npm start` | Production sunucusu |
| `npm run db:push` | Schema'yi DB'ye push et |
| `npm run db:migrate` | Migration olustur |
| `npm run db:seed` | Ornek veri yukle |
| `npm run db:studio` | Prisma Studio ac |

## Entegrasyonlar

Proje varsayilan olarak mock modda calisir. Gercek entegrasyonlar icin `.env` dosyasinda:

```env
USE_MOCK_PAYMENT="false"
USE_MOCK_INVOICE="false"
USE_MOCK_CARGO="false"
USE_MOCK_EMAIL="false"
USE_MOCK_SMS="false"
```

Ve ilgili API anahtarlarini doldurun.

## Lisans

MIT
