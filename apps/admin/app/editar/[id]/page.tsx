import { Suspense } from "react"
import Link from "next/link"
import { EditNews } from "@/components/EditNews"

// El [id] solo se conoce al abrir la página; con cacheComponents activado,
// leerlo (useParams) necesita un <Suspense> alrededor.
export default function EditNewsPage() {
  return (
    <main className="page">
      <div>
        <Link href="/" className="muted small">
          ← Volver
        </Link>
        <h1>Editar noticia</h1>
      </div>
      <Suspense fallback={<p className="muted">Cargando…</p>}>
        <EditNews />
      </Suspense>
    </main>
  )
}
