import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level skeleton mirroring the login column inside the AuthShell frame
 * — perceived speed per philosophy §6; the auth precheck is force-dynamic so
 * this shows during server work.
 *
 * Mirrors the REAL layout for the configured auth mode (responsive.md DoD:
 * "skeletons mirror the layout"): AUTH_MODE=otp renders a single email field,
 * password mode renders two labeled fields. Read server-side from the same
 * env var the layout feeds into ConfigContext; when unset, password mode is
 * the correct default (matching login.tsx's mode resolution).
 */
export default function Loading() {
  const isOtp = process.env.AUTH_MODE === "otp";

  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-4 w-56 max-w-full" />
      </div>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-11 w-full md:h-10" />
        </div>
        {!isOtp ? (
          <div className="grid gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-11 w-full md:h-10" />
          </div>
        ) : null}
        <Skeleton className="h-11 w-full md:h-10" />
      </div>
    </div>
  );
}
