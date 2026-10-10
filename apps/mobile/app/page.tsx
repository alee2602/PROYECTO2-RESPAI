import { redirect } from "next/navigation"

// Por ahora la pantalla inicial es el feed. Cuando exista el chat (Rol 2), esta
// ruta pasa a ser el chat (pantalla inicial según CLAUDE.md).
export default function Home() {
  redirect("/feed")
}
