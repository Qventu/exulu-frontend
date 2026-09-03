"use client";

import { useContext } from "react";

import { ConfigContext } from "@/components/shell/config-context";
import { DEMO_BRAND } from "@/lib/demo/brand";
import { isDemoMode } from "@/lib/demo/flag";
import { cn } from "@/lib/utils";

interface LogoProps {
    width?: number;
    height?: number;
    className?: string;
    alt?: string;
}

/**
 * Switches light/dark with CSS, not JavaScript.
 *
 * This used to branch on next-themes' `resolvedTheme`, which is undefined on
 * the server: SSR therefore always emitted the LIGHT logo, and any dark-mode
 * client immediately replaced it with the dark one. React reports that as a
 * hydration mismatch ("some attributes of the server rendered HTML didn't
 * match"), and it fired for every dark-mode user on every page with a logo.
 *
 * Rendering both and letting the `dark:` variant hide one is SSR-safe, because
 * next-themes puts the class on <html> before paint and no branch is taken in
 * JS at all. The browser only fetches the visible one.
 */
const Logo = ({ width = 64, height = 32, className = "", alt = "Logo" }: LogoProps) => {
    const configContext = useContext(ConfigContext);
    const base = configContext?.backend ?? "";

    // A logo that fails to load is worse than no logo: the browser renders the
    // alt text as a grey block, which reads as a broken page rather than an
    // unbranded one. Hide failed images to degrade gracefully.
    const hideOnError = (event: React.SyntheticEvent<HTMLImageElement>) => {
        event.currentTarget.style.display = "none";
    };

    // The demo mode renders the OPEN wordmark from public/demo/brand/ (light and
    // dark variants). Both images render; CSS hides one based on the current
    // theme to avoid hydration mismatches from JavaScript branching on
    // resolvedTheme. If a path is missing or breaks, onError hides the image.
    if (isDemoMode()) {
        return (
            <>
                <img
                    src={DEMO_BRAND.logoLight}
                    alt={alt}
                    width={width}
                    height={height}
                    className={cn(className, "dark:hidden")}
                    onError={hideOnError}
                />
                <img
                    src={DEMO_BRAND.logoDark}
                    alt={alt}
                    width={width}
                    height={height}
                    className={cn(className, "hidden dark:block")}
                    onError={hideOnError}
                />
            </>
        );
    }

    const lightSrc = `${base}/logo_light.png`;
    const darkSrc = `${base}/logo_dark.png`;

    return (
        <>
            <img
                src={lightSrc}
                alt={alt}
                width={width}
                height={height}
                className={cn(className, "dark:hidden")}
                onError={hideOnError}
            />
            <img
                src={darkSrc}
                alt={alt}
                width={width}
                height={height}
                className={cn(className, "hidden dark:block")}
                onError={hideOnError}
            />
        </>
    );
};

export default Logo;
