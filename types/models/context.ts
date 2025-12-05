import type { ExuluFieldTypes } from "../enums/field-types"
import { allFileTypes } from "./agent"

export interface Context {
  id: string
  name: string
  description: string
  embedder?: {
    name: string,
    id: string,
    queue: string,
    config?: {
      name: string,
      description: string,
      default: string
    }[]
  }
  active: boolean
  slug: string
  configuration: {
    calculateVectors: string
    defaultRightsMode: "private" | "users" | "roles" | "public"/*  | "projects" */
  }
  processors: {
    field: string
    description: string
    queue: string
    trigger: string
    timeoutInSeconds: number
    generateEmbeddings: boolean
  }[]
  sources: {
    id
    name
    description
    config: {
      schedule?: string
      queue?: string
      retries?: number
      params?: {
        name: string,
        description: string,
        default: string
      }[]
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
        trigger: "manual" | "onUpdate" | "onInsert" | "always"
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
