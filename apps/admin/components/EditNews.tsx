"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { draftFromDoc } from "@/lib/newsDraft"
import { NewsForm, type ExistingNews } from "@/components/NewsForm"

// Carga la noticia de Firestore y abre el formulario en modo edición.
export function EditNews() {
  const { id } = useParams<{ id: string }>()
  const [news, setNews] = useState<ExistingNews | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDoc(doc(db, "news", id))
      .then((snap) => {
        const data = snap.data()
        if (!data) return setError("Esta noticia no existe (quizá alguien la borró).")
        setNews({ id, published: !!data.publishedAt, draft: draftFromDoc(data) })
      })
      .catch((e) => setError(`No se pudo leer la noticia (${e.code ?? String(e)}).`))
  }, [id])

  if (error)
    return (
      <p className="error" role="alert">
        {error}
      </p>
    )
  if (!news) return <p className="muted">Cargando…</p>
  return <NewsForm existing={news} />
}
