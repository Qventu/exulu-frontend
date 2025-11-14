import type { ExuluFieldTypes } from "../enums/field-types"
import { allFileTypes } from "./agent"

export interface Context {
  id: string
  name: string
  description: string
  embedder: string
  active: boolean
  slug: string
  configuration: {
    calculateVectors: string
    defaultRightsMode: "private" | "users" | "roles" | "public" | "projects"
  }
  sources: {
    id
    name
    description
    config: {
      schedule?: string
      queue?: string
      retries?: number
      backoff?: {
        type: 'exponential' | 'linear'
        delay: number
      }
    }
  }[]
  fields: {
    name: string
    calculated?: boolean
    type: ExuluFieldTypes
    label: string
    allowedFileTypes?: allFileTypes[]
    processor?: {
      description: string,
      config: {
        trigger: "manual" | "onUpdate" | "onCreate" | "always"
        queue: {
          name: string
          ratelimit: number
          concurrency: number
        }
      }
      execute: "function"
    }
  }[]
}
