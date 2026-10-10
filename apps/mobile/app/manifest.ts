import type { MetadataRoute } from "next"

// Manifest de la PWA: lo que lee el celular al "Añadir a pantalla de inicio".
// Next.js lo sirve en /manifest.webmanifest y agrega el <link> solo.
// Íconos generados con scripts/generate-icons.mjs.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "RespAI News",
    short_name: "RespAI News",
    description: "Noticias según tu ubicación elegida, con fuentes y estado de validación visibles.",
    lang: "es",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f5f2",
    theme_color: "#c8102e",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
