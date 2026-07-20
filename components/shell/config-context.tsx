"use client"
import { BackendConfigType, FeedbackConfig } from "@/lib/api/config";
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
    public_auth?: {
        otp_available: boolean;
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
