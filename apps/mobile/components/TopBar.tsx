import Link from "next/link"

// Barra superior fija para pantallas secundarias (ubicación, lector): botón
// redondo de volver + título centrado. Respeta el notch con --safe-top.
export function TopBar({ title, backHref = "/feed" }: { title?: string; backHref?: string }) {
  return (
    <header className="topbar">
      <Link href={backHref} className="icon-btn" aria-label="Volver">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
      {title && <p className="topbar-title">{title}</p>}
      <span className="topbar-spacer" aria-hidden="true" />
    </header>
  )
}
