import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import { AuthGate } from "@/components/AuthGate";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RespAI News",
  description: "Noticias personalizadas por ubicación simulada, con fuentes y estado de validación visibles.",
  applicationName: "RespAI News",
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  // iOS no lee el manifest para todo: esto hace que al "Añadir a pantalla de
  // inicio" se abra sin la barra de Safari y con este nombre.
  appleWebApp: {
    capable: true,
    title: "RespAI News",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  // Next solo emite "mobile-web-app-capable"; iOS anteriores a 17 necesitan
  // la versión con prefijo (la misma que usó pruebas/ios-login).
  other: { "apple-mobile-web-app-capable": "yes" },
};

// viewport-fit=cover: la app ocupa toda la pantalla (incluido el área del
// notch y de la barra inferior); los márgenes los ponemos nosotros con
// env(safe-area-inset-*) en globals.css.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0f12" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <AuthProvider>
          <AuthGate>{children}</AuthGate>
        </AuthProvider>
      </body>
    </html>
  );
}
