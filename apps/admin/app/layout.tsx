import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import { AdminGate } from "@/components/AdminGate";
import { AdminHeader } from "@/components/AdminHeader";
import "./globals.css";

// Mismas fuentes que la PWA: Inter para leer, Poppins para titulares y marca.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "RespAI Portal",
  description: "Portal de redacción: crear, validar y publicar noticias con procedencia y criterio humano.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${inter.variable} ${poppins.variable}`}>
      <body>
        <AuthProvider>
          <AdminGate>
            <AdminHeader />
            {children}
          </AdminGate>
        </AuthProvider>
      </body>
    </html>
  );
}
