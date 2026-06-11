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
    const { theme } = useTheme()
    return (
        <>
            {theme !== "dark" && (
                <img
                    src={configContext?.backend + "/logo_light.png"}
                    alt={alt}
                    width={width}
                    height={height}
                    className={className}
                />
            )}
            {theme === "dark" && (
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