"use client"

import Link from "next/link"
import { useAdmin, useAuth } from "@/lib/auth"

// Barra superior del portal (solo se ve detrás de <AdminGate>).
export function AdminHeader() {
  const user = useAdmin()
  const { logOut } = useAuth()
  return (
    <header className="admin-header">
      <Link href="/" className="wordmark">
        Resp<span>AI</span> Portal
      </Link>
      <div className="admin-header-user">
        <span className="muted small">{user.email}</span>
        <button className="btn btn-sm" onClick={logOut}>
          Cerrar sesión
        </button>
      </div>
    </header>
  )
}
