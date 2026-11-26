"use client"
import { BackendConfigType, FeedbackConfig } from "@/lib/api/config";
import { createContext } from "react";

export type ConfigContextType = {
    backend: string;
    google_client_id: string;
    /** Microsoft (Entra ID) sign-in is configured on the server. */
    microsoft_enabled?: boolean;
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
