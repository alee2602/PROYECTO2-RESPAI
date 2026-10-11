import { collection, getDocs, limit, orderBy, query } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { computeTopicAffinity, type SignalInput, type TopicAffinity } from "@/lib/affinity"

// Lee las señales del propio usuario (users/{uid}/signals, las reglas solo
// dejan leer al dueño) y calcula su afinidad por tema. Sin modelo.
//
// Costo en Firestore (plan Spark, 50.000 lecturas/día): cada señal leída es
// una lectura. Por eso:
// - solo las últimas SIGNALS_LIMIT señales (también hace que la afinidad
//   siga a los intereses recientes, no a los de hace semanas);
// - caché en memoria por CACHE_MS: volver al feed varias veces seguidas no
//   vuelve a leer. Una lectura nueva tarda como mucho eso en notarse.
const SIGNALS_LIMIT = 100
const CACHE_MS = 5 * 60_000

let cache: { uid: string; at: number; value: TopicAffinity } | null = null

export async function fetchTopicAffinity(uid: string): Promise<TopicAffinity> {
  if (cache && cache.uid === uid && Date.now() - cache.at < CACHE_MS) return cache.value

  const snap = await getDocs(
    query(collection(db, "users", uid, "signals"), orderBy("createdAt", "desc"), limit(SIGNALS_LIMIT))
  )
  const signals: SignalInput[] = snap.docs.map((d) => {
    const s = d.data()
    return {
      type: typeof s.type === "string" ? s.type : "",
      newsId: typeof s.newsId === "string" ? s.newsId : "",
      topics: Array.isArray(s.topics) ? s.topics.filter((t: unknown): t is string => typeof t === "string") : [],
      ...(typeof s.durationMs === "number" ? { durationMs: s.durationMs } : {}),
    }
  })

  const value = computeTopicAffinity(signals)
  cache = { uid, at: Date.now(), value }
  return value
}
