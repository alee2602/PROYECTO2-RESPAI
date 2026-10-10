// Genera los íconos PNG de la PWA a partir de un SVG (sin texto, solo formas,
// para que se vea igual en cualquier máquina). Correr una vez y commitear los
// PNG resultantes:  node scripts/generate-icons.mjs  (desde apps/mobile)
// Usa `sharp`, que ya viene instalado como dependencia de Next.js.
import sharp from "sharp"
import { mkdirSync, writeFileSync } from "node:fs"

// Periódico blanco con un titular rojo y un sello de "verificado", sobre fondo
// rojo. `pad` encoge el dibujo para los íconos "maskable" (Android recorta
// hasta un 20% de los bordes).
function svg({ rounded, pad }) {
  const s = 512
  const inner = s - pad * 2
  const k = inner / 512
  const t = (v) => pad + v * k
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" rx="${rounded ? 112 : 0}" fill="#c8102e"/>
  <rect x="${t(112)}" y="${t(104)}" width="${288 * k}" height="${320 * k}" rx="${28 * k}" fill="#ffffff"/>
  <rect x="${t(148)}" y="${t(144)}" width="${216 * k}" height="${40 * k}" rx="${10 * k}" fill="#c8102e"/>
  <rect x="${t(148)}" y="${t(208)}" width="${216 * k}" height="${18 * k}" rx="${9 * k}" fill="#16181d" opacity="0.8"/>
  <rect x="${t(148)}" y="${t(244)}" width="${160 * k}" height="${18 * k}" rx="${9 * k}" fill="#16181d" opacity="0.8"/>
  <rect x="${t(148)}" y="${t(280)}" width="${120 * k}" height="${18 * k}" rx="${9 * k}" fill="#16181d" opacity="0.8"/>
  <circle cx="${t(340)}" cy="${t(372)}" r="${64 * k}" fill="#1f7a4d" stroke="#ffffff" stroke-width="${12 * k}"/>
  <path d="M ${t(312)} ${t(372)} L ${t(333)} ${t(394)} L ${t(370)} ${t(352)}" fill="none" stroke="#ffffff" stroke-width="${16 * k}" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`
}

const outDir = new URL("../public/icons/", import.meta.url)
mkdirSync(outDir, { recursive: true })

const any = svg({ rounded: true, pad: 0 })
const full = svg({ rounded: false, pad: 0 }) // iOS redondea solo las esquinas
const maskable = svg({ rounded: false, pad: 64 })

writeFileSync(new URL("icon.svg", outDir), any)
const jobs = [
  [any, 192, "icon-192.png"],
  [any, 512, "icon-512.png"],
  [maskable, 512, "icon-maskable-512.png"],
  [full, 180, "apple-touch-icon.png"],
]
for (const [src, size, name] of jobs) {
  await sharp(Buffer.from(src)).resize(size, size).png().toFile(new URL(name, outDir).pathname.replace(/^\/([A-Za-z]:)/, "$1"))
  console.log("ok", name)
}
