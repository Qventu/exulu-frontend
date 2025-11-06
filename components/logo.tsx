"use client";

import { ConfigContext } from "./config-context";
import { useContext } from "react";

interface LogoProps {
    width?: number;
    height?: number;
    className?: string;
    alt?: string;
}

const Logo = ({ width = 64, height = 32, className = "", alt = "Logo" }: LogoProps) => {
    const configContext = useContext(ConfigContext);
    return (
        <>
            <img
                src={configContext?.backend + "/logo_dark.png"}
                alt={alt}
                width={width}
                height={height}
                className={className + "hidden dark:block"}
            />
            <img
                src={configContext?.backend + "/logo_light.png"}
                alt={alt}
                width={width}
                height={height}
                className={className + "block dark:hidden"}
            />
        </>
    )
}

export default Logo;