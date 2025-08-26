import type { ExuluFieldTypes } from "../enums/field-types"
import type { Agent } from "./agent"

export interface Context {
    id: string
    name: string
    description: string
    embedder: string
    active: boolean
    slug: string
    fields: {
      name: string
      type: ExuluFieldTypes
      label: string
    }[]
    agents: Agent[]
  }
  