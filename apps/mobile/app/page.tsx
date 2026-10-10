import { redirect } from "next/navigation"

// La pantalla inicial es el chat: al abrir la app, ChatDock (en el layout) lo
// muestra desplegado sobre la portada. Cerrado, queda como burbuja flotante.
export default function Home() {
  redirect("/feed")
}
