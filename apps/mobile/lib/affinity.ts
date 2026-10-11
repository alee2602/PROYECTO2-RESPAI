// ---------------------------------------------------------------------------
// Afinidad por tema a partir de las señales de comportamiento (Rol 4).
//
// Módulo puro (sin Firebase, sin red) para poder probarlo con `node --test`,
// mismo criterio que lib/ranking.ts. La lectura de Firestore vive en
// lib/userAffinity.ts. Sin modelo: son sumas y una saturación.
//
// Señales de entrada: docs/senales.md (las escribe Rol 1 en lib/signals.ts).
// Pesos y motivo de cada número: docs/ranking.md.
// ---------------------------------------------------------------------------

// Lo mínimo que se necesita de cada señal guardada en users/{uid}/signals.
export type SignalInput = {
  type: string // "open" | "read_time" | "share"; cualquier otro se ignora
  newsId: string
  topics: string[]
  durationMs?: number
}

// Interés por tema, entre 0 y 1 (nunca llega a 1). Clave: tema normalizado.
export type TopicAffinity = Map<string, number>

export const AFFINITY = {
  openOnly: 0.2, // abrió pero no hay read_time: probablemente un toque y salir
  fullReadMs: 60_000, // 1 minuto de lectura visible cuenta como lectura completa (= 1)
  share: 1, // compartir es la señal más fuerte de interés
  // Saturación: interés = suma / (suma + halfSaturation). Con 2 lecturas
  // completas de un tema, el interés llega a 0,5. Una sola lectura no alcanza
  // para reordenar mucho el feed.
  halfSaturation: 2,
} as const

// Los temas se escriben a mano en el portal: "Economía" y "economia " deben
// contar como el mismo tema.
export function normalizeTopic(topic: string): string {
  return topic.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase()
}

export function computeTopicAffinity(signals: SignalInput[]): TopicAffinity {
  // 1) Interés por noticia. Una misma apertura puede dejar varios read_time
  // (docs/senales.md): se suman por newsId.
  const perNews = new Map<string, { topics: string[]; opened: boolean; readMs: number; shared: boolean }>()
  for (const s of signals) {
    if (!s.newsId) continue
    const entry = perNews.get(s.newsId) ?? { topics: [], opened: false, readMs: 0, shared: false }
    if (entry.topics.length === 0 && Array.isArray(s.topics)) entry.topics = s.topics
    if (s.type === "open") entry.opened = true
    else if (s.type === "read_time" && typeof s.durationMs === "number" && s.durationMs > 0) entry.readMs += s.durationMs
    else if (s.type === "share") entry.shared = true
    perNews.set(s.newsId, entry)
  }

  // 2) Suma por tema.
  const raw = new Map<string, number>()
  for (const e of perNews.values()) {
    const read = Math.min(e.readMs / AFFINITY.fullReadMs, 1)
    const engagement = Math.max(read, e.opened ? AFFINITY.openOnly : 0) + (e.shared ? AFFINITY.share : 0)
    if (engagement <= 0) continue
    for (const t of new Set(e.topics.map(normalizeTopic))) {
      if (t) raw.set(t, (raw.get(t) ?? 0) + engagement)
    }
  }

  // 3) Saturación a [0, 1).
  const affinity: TopicAffinity = new Map()
  for (const [t, sum] of raw) affinity.set(t, sum / (sum + AFFINITY.halfSaturation))
  return affinity
}

// Interés de una noticia = el de su tema más afín (máximo, no suma: una
// noticia con muchos temas no debe ganar solo por tener más etiquetas).
export function newsAffinity(topics: string[], affinity: TopicAffinity): { value: number; topic: string | null } {
  let best = { value: 0, topic: null as string | null }
  for (const t of topics) {
    const v = affinity.get(normalizeTopic(t)) ?? 0
    if (v > best.value) best = { value: v, topic: t }
  }
  return best
}
