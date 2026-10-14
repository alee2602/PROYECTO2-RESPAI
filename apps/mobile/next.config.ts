import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // cacheComponents / partialPrefetching venían activadas por defecto al
  // crear el proyecto. Se desactivan: esta app es dinámica y personalizada
  // (ubicación simulada + Firestore en tiempo real), y ese cache agresivo
  // causaba que /feed mostrara una versión precargada ANTES de guardar la
  // nueva ubicación, hasta refrescar manualmente — ver docs/ciclos.md, 2026-10-10.
  reactCompiler: true,
  transpilePackages: ["@respai/shared"],
  // firebase-admin/auth carga jwks-rsa -> jose (ESM puro). Turbopack intenta
  // empaquetarlo e invocarlo con require(), lo que rompe el endpoint del
  // chat en serverless con ERR_REQUIRE_ESM. serverExternalPackages deja que
  // Node cargue firebase-admin directo desde node_modules en vez de
  // empaquetarlo.
  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;
