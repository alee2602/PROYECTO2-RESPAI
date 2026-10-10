// PLACEHOLDER del contenido del chat. Se muestra dentro de la hoja de
// components/ChatDock.tsx (que se abre al iniciar la app y queda como burbuja).
// El chat real lo construye Rol 2 (pantalla + apps/mobile/app/api/chat/):
// reemplazar <ChatPlaceholder /> en ChatDock.tsx por su componente.
// Este componente NO llama a ningún modelo ni a ningún endpoint.

const EXAMPLES = [
  "¿Qué pasó hoy en mi región?",
  "Resúmeme las noticias nacionales más recientes",
  "Explícame la noticia de la ola de calor en España",
  "¿Qué se sabe del brote en escuelas de Xela?",
]

export function ChatPlaceholder({ onGoToFeed }: { onGoToFeed: () => void }) {
  return (
    <>
      <div className="chat-ph">
        <div className="chat-ph-intro">
          <h2>Pregúntale a las noticias.</h2>
          <p className="muted">
            Responderá solo con noticias publicadas, citará sus fuentes y te dirá qué está confirmado y qué no. Si no
            puede confirmar algo, lo dirá.
          </p>
        </div>

        <div className="chat-ph-examples" aria-label="Ejemplos de preguntas">
          <p className="chat-ph-label">Podrás preguntar cosas como</p>
          <ul>
            {EXAMPLES.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>

        <div className="chat-ph-soon">
          <span className="chat-ph-dot" aria-hidden="true" />
          <p>
            <strong>Disponible pronto.</strong> Mientras tanto,{" "}
            <button type="button" className="text-link" onClick={onGoToFeed}>
              revisa tu portada
            </button>
            .
          </p>
        </div>
      </div>

      <form className="chat-composer" aria-disabled="true" onSubmit={(e) => e.preventDefault()}>
        <input type="text" placeholder="El chat estará disponible pronto" disabled aria-label="Escribe tu pregunta" />
        <button type="submit" className="chat-send" disabled aria-label="Enviar">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </form>
    </>
  )
}
