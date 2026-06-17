"use client";

import { ConfigContext } from "@/components/shell/config-context";
import { useContext } from "react";
import { useTheme } from "next-themes";

interface LogoProps {
    width?: number;
    height?: number;
    className?: string;
    alt?: string;
}

const Logo = ({ width = 64, height = 32, className = "", alt = "Logo" }: LogoProps) => {
    const configContext = useContext(ConfigContext);
    // resolvedTheme (not theme): with the "system" preference, `theme` is the
    // literal string "system" and never "dark", so the light logo was served
    // to system-dark users (shell audit H5). resolvedTheme is always the
    // effective "light" | "dark" (undefined on the server → light fallback,
    // matching the previous first-paint behavior).
    const { resolvedTheme } = useTheme()
    return (
        <>
            {resolvedTheme !== "dark" && (
                <img
                    src={configContext?.backend + "/logo_light.png"}
                    alt={alt}
                    width={width}
                    height={height}
                    className={className}
                />
            )}
            {resolvedTheme === "dark" && (
                <img
                    src={configContext?.backend + "/logo_dark.png"}
                    alt={alt}
                    width={width}
                    height={height}
                    className={className}
                />
            )}
        </>
    )
}

export default Logo;