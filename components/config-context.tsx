"use client"
import { BackendConfigType, FeedbackConfig } from "@/util/api";
import { createContext } from "react";

export type ConfigContextType = {
    backend: string;
    google_client_id: string;
    auth_mode: string;
    feedback?: FeedbackConfig;
    transcription?: {
        enabled: boolean;
    };
    tts?: {
        enabled: boolean;
    };
} & BackendConfigType;

export const ConfigContext = createContext<ConfigContextType | null>(null);

export function ConfigContextProvider({ children, config }: {
  children: React.ReactNode;
  config: ConfigContextType;
}) {

  if (!config) {
    throw new Error("Config not found");
  }

  return (
    <ConfigContext.Provider value={config}>
      {children}
    </ConfigContext.Provider>
  );
}
