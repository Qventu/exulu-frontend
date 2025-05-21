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
    }[]
    sources: ContextSource[]
    agents: Agent[]
  }
  
  export interface ContextSource {
    id: string
    name: string
    description: string
    updaters: Updater[]
  }
  
  export interface Updater {
    id: string
    type: string
    configuration: Configuration
  }
  
  export interface Configuration {
    query: string
  }
  