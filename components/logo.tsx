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

    // In demo mode `backend` names a host nothing is serving, so both sources
    // 404 and the only thing keeping the page tidy was the onError below —
    // which fires after first paint, leaving alt text as a grey block for as
    // long as the shell takes to hydrate. Local paths avoid the round trip.
    const demo = isDemoMode();
    const lightSrc = demo ? DEMO_BRAND.logoLight : `${base}/logo_light.png`;
    const darkSrc = demo ? DEMO_BRAND.logoDark : `${base}/logo_dark.png`;

    // A logo that fails to load is worse than no logo: the browser renders the
    // alt text as a grey block, which reads as a broken page rather than an
    // unbranded one. Deployments without logo assets — the guided demo among
    // them — should simply show nothing.
    const hideOnError = (event: React.SyntheticEvent<HTMLImageElement>) => {
        event.currentTarget.style.display = "none";
    };

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
