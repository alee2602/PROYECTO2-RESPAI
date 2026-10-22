// Rutas relativas con extensión: se resuelven también en `node --test`.
import { normalizeText } from "./retrieval.ts"

// ---------------------------------------------------------------------------
// Filtro previo de pedidos fuera de tema (Rol 5, RC-14). SIN MODELO, $0.
//
// Primera barrera: atrapa ANTES de leer noticias y de llamar al modelo los
// pedidos que claramente no son sobre noticias ("escríbeme un poema...",
// "ignora tus instrucciones..."). La segunda barrera es la regla 9 del prompt
// (lib/prompt.ts), para lo que este filtro deje pasar.
//
// Principio: ANTE LA DUDA, DEJAR PASAR. Bloquear una pregunta legítima es
// peor que gastar ~USD 0,0004 en una que no lo era. Por eso:
// - No bloquea por tema ("¿qué pasó con el clima en Petén?" puede ser noticia).
// - Un verbo de producción solo bloquea si va en imperativo o infinitivo y
//   ANTES de un formato ajeno ("escríbeme un poema"). "¿Qué escribió el
//   presidente en su carta?" pasa: "escribió" no está y "carta" no es formato.
//
// Privacidad: solo devuelve sí/no. No se registra qué palabra coincidió.
// Intención y criterios: docs/rol5-pendientes.md, punto 2. Casos: docs/chat-pruebas.md.
// ---------------------------------------------------------------------------

// Verbos de producción en imperativo (con o sin "me") e infinitivo. Sin tildes.
const PRODUCE_VERBS = new Set(
  `escribe escribeme escribir redacta redactame redactar inventa inventame inventar
  genera generame generar traduce traduceme traducir compon componme componer
  hazme creame crear programame programar dibuja dibujame dibujar`.split(/\s+/).filter(Boolean)
)

// Formatos que no son una respuesta sobre noticias.
const FOREIGN_FORMATS = new Set(
  `poema poemas poesia cancion canciones cuento cuentos verso versos rima rimas rap chiste chistes
  codigo script ensayo ensayos receta recetas acrostico haiku soneto novela`.split(/\s+/).filter(Boolean)
)

// Frases típicas de inyección o de pedidos ajenos, ya normalizadas.
const BLOCKED_PATTERNS: RegExp[] = [
  /\b(ignora|ignorar|olvida|olvidate de|salta|saltate) (todas )?(tus|las|todas las) (instrucciones|reglas|restricciones)\b/,
  /\b(actua|actuar|comportate) como\b/,
  /\b(ahora eres|eres ahora|finge que eres|finge ser|haz de cuenta que eres)\b/,
  /\b(prompt del sistema|system prompt|modo desarrollador|jailbreak)\b/,
  /\b(mi|mis) (tarea|tareas|deberes)\b/,
]

export function isOffTopic(question: string): boolean {
  const norm = normalizeText(question)
  if (BLOCKED_PATTERNS.some((re) => re.test(norm))) return true

  const ws = norm.split(" ")
  const verbAt = ws.findIndex((w) => PRODUCE_VERBS.has(w))
  if (verbAt === -1) return false
  return ws.slice(verbAt + 1).some((w) => FOREIGN_FORMATS.has(w))
}
