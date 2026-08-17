import type { Metadata } from "next";
import { Playfair_Display, Be_Vietnam_Pro, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin", "vietnamese"],
  variable: "--font-playfair",
  display: "swap",
});

const beVietnamPro = Be_Vietnam_Pro({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin", "vietnamese"],
  variable: "--font-be-vietnam-pro",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "vietnamese"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ChronoViet — Không Gian Tri Thức Lịch Sử & Xưởng Phim Tự Động",
  description:
    "Nền tảng sáng tạo video tài liệu lịch sử Việt Nam tự động hóa 100% bằng Multi-Agent AI kết hợp GraphRAG.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="vi"
      className={`dark ${playfair.variable} ${beVietnamPro.variable} ${jetbrainsMono.variable}`}
      style={{ colorScheme: "dark" }}
    >
      <body className="min-h-dvh bg-lacquer-deep text-text-primary font-body antialiased selection:bg-primary/20 selection:text-gold-300 overflow-x-hidden">
        {/* Skip Navigation for Accessibility */}
        <a
          href="#main-workspace"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:shadow-lg text-sm font-medium"
        >
          Chuyển đến vùng làm việc chính
        </a>

        {/* Global Toaster */}
        <Toaster
          theme="dark"
          position="top-right"
          richColors
          toastOptions={{
            className:
              "bg-lacquer-surface border-border-bronze-subtle text-text-primary shadow-2xl backdrop-blur-md",
          }}
        />

        {children}
      </body>
    </html>
  );
}
