import Link from "next/link";

// Locale segmenti disinda kalan / eslesmeyen yollar icin kok 404.
// Kok layout olmadigindan kendi <html> govdesini render eder.
export default function GlobalNotFound() {
  return (
    <html lang="tr">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          margin: 0,
          background: "#fbfbfd",
          color: "#1d1d1f",
        }}
      >
        <main style={{ textAlign: "center", padding: "2rem" }}>
          <h1 style={{ fontSize: "3rem", margin: 0 }}>404</h1>
          <p style={{ color: "#86868b" }}>Sayfa bulunamadı / Page not found</p>
          <Link href="/tr" style={{ color: "#0071e3" }}>
            Ana sayfa / Home
          </Link>
        </main>
      </body>
    </html>
  );
}
