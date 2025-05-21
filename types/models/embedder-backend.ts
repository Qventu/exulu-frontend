
// Represents an embedder backend
// which is created and run in
// the agents service. Embedders
// registered in Exulu must have
// a connected backend that
// does the actual work.

export interface EmbedderBackend {
      id: string
      name: string
      slug: string
      supported: string
      description: string
    }