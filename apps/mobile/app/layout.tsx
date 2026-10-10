import type { Metadata, Viewport } from "next";
import { Inter, Poppins } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import { AuthGate } from "@/components/AuthGate";
import { ProfileProvider } from "@/lib/profile";
import { LocationGate } from "@/components/LocationGate";
import { ChatDock } from "@/components/ChatDock";
import "./globals.css";

// Inter para leer (cuerpo, metadatos); Poppins para titulares y marca.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
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
    <html lang="es" className={`${inter.variable} ${poppins.variable}`}>
      <body>
        <AuthProvider>
          <AuthGate>
            <ProfileProvider>
              <LocationGate>
                {children}
                <ChatDock />
              </LocationGate>
            </ProfileProvider>
          </AuthGate>
        </AuthProvider>
      </body>
    </html>
  );
}
