"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { ChatPanel } from "@/components/ChatPanel"

// Contenedor del chat: hoja que sube desde abajo + burbuja flotante.
// - Al abrir la app (en / o /feed) la hoja aparece desplegada: el chat sigue
//   siendo la pantalla inicial (CLAUDE.md). Al cerrarla queda la burbuja.
// - Si se entra directo a una noticia (/noticia/..., p. ej. un link
//   compartido), no se abre sola.
// - Vive en el layout, así que abierto/cerrado se mantiene al navegar.
// El contenido es el chat real de Rol 2 (<ChatPanel />, ver docs/chat.md).
// Al tocar una noticia citada, la hoja se cierra para mostrar el lector; la
// conversación se conserva mientras la app esté abierta.

const SHOW_ON = ["/feed", "/noticia/"]

export function ChatDock() {
  const pathname = usePathname()
  const [open, setOpen] = useState(() => pathname === "/" || pathname === "/feed")
  const bubbleRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  // Solo mover el foco al botón de cerrar si la persona abrió el chat (no al arrancar la app)
  const openedByUser = useRef(false)

  const visible = SHOW_ON.some((p) => pathname.startsWith(p))

  useEffect(() => {
    if (!open) return
    if (openedByUser.current) closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close()
    document.addEventListener("keydown", onKey)
    // Evita que el feed de atrás haga scroll mientras la hoja está abierta
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  function openFromBubble() {
    openedByUser.current = true
    setOpen(true)
  }

  function close() {
    setOpen(false)
    requestAnimationFrame(() => bubbleRef.current?.focus())
  }

  if (!visible) return null

  return (
    <>
      {open && (
        <div className="chat-dock" role="dialog" aria-modal="true" aria-labelledby="chat-dock-title">
          <div className="chat-dock-backdrop" onClick={close} />
          <section className="chat-sheet">
            <header className="chat-sheet-head">
              <span className="chat-sheet-grip" aria-hidden="true" />
              <p id="chat-dock-title" className="chat-sheet-title">
                Chat de noticias
              </p>
              <button ref={closeRef} className="icon-btn" onClick={close} aria-label="Cerrar chat e ir a la portada">
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </header>
            <ChatPanel onClose={close} />
          </section>
        </div>
      )}

      {!open && (
        <button ref={bubbleRef} className="chat-bubble" onClick={openFromBubble} aria-label="Abrir chat de noticias">
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
            <path
              d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 19 17h-8.5L6 20.5V17H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinejoin="round"
            />
            <path d="M8.5 10.5h7M8.5 13.5h4.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </>
  )
}
