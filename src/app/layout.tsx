import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#1e40af",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: {
    default: "OkulTedarigim - Okul Kitap Siparis Sistemi",
    template: "%s | OkulTedarigim",
  },
  description: "Okulunuza ozel kitap ve egitim materyali siparis platformu. Guvenli odeme, hizli teslimat, okul bazli siparis takibi.",
  keywords: ["okul", "kitap", "siparis", "egitim", "materyal", "okul tedarik", "kitap seti", "okultedarigim"],
  authors: [{ name: "OkulTedarigim" }],
  manifest: "/manifest.json",
  openGraph: {
    type: "website",
    locale: "tr_TR",
    siteName: "OkulTedarigim",
    title: "OkulTedarigim - Okul Kitap Siparis Sistemi",
    description: "Okulunuza ozel kitap ve egitim materyali siparis platformu. Guvenli odeme, hizli teslimat.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
