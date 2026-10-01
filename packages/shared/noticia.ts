// Contrato compartido entre portal, feed y chat.
// Cualquier cambio aquí se avisa al equipo antes de hacerse (ver sección 11, CLAUDE.md raíz).

export type Noticia = {
  id: string
  titulo: string
  resumen: string
  cuerpo: string

  // Procedencia
  fuentes: { nombre: string; url?: string; tipo: 'original' | 'resumen' | 'ia' }[]
  autorId: string // quién la publicó en el portal

  // Validación — el estado lo decide una persona desde el portal, nunca el modelo ni el código.
  estadoValidacion: 'confirmada' | 'en_desarrollo' | 'no_verificada'
  notaValidacion?: string // por qué tiene ese estado, qué falta, contradicciones

  // Alcance geográfico (para relevancia)
  alcance: 'local' | 'nacional' | 'internacional'
  pais?: string
  region?: string
  temas: string[]

  // Imagen
  imagen?: {
    url: string
    origen: 'foto_real' | 'libre_con_atribucion' | 'generada_ia'
    atribucion?: string
  }

  // Fechas
  creadaEn: string
  publicadaEn?: string
  actualizadaEn?: string
}

// No hay campo explícito de "importancia": la prominencia se calcula en el feed
// por usuario y contexto (Etapa 3), no se guarda en la noticia.
