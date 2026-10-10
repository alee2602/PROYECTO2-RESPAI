import Link from "next/link"
import { NewsForm } from "@/components/NewsForm"

export default function NewNewsPage() {
  return (
    <main className="page">
      <div>
        <Link href="/" className="muted small">
          ← Volver
        </Link>
        <h1>Nueva noticia</h1>
        <p className="muted">
          &quot;Publicar&quot; la deja visible en la app. &quot;Guardar borrador&quot; la guarda sin mostrarla.
        </p>
      </div>
      <NewsForm />
    </main>
  )
}
