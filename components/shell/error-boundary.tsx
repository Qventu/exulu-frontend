"use client";

/**
 * NavigationErrorBoundary — the shell's last line of defense.
 *
 * Survives the main-nav.tsx deletion (navigation.md §7 "What happens to
 * main-nav.tsx": "NavigationErrorBoundary survives, i18n'd"). Wraps the
 * whole AppShell composition: if anything in the shell tree throws during
 * render, the user gets a calm, translated explanation and a refresh action
 * instead of a white screen.
 *
 * React error boundaries must be class components, but hooks (useTranslations)
 * only work in function components — so the export is a thin function wrapper
 * that resolves the copy and feeds it to the inner class as props.
 */

import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { EmptyState } from "@/components/primitives/empty-state";

interface FallbackCopy {
  title: string;
  description: string;
  refresh: string;
}

interface BoundaryProps {
  copy: FallbackCopy;
  children: React.ReactNode;
}

interface BoundaryState {
  hasError: boolean;
}

class Boundary extends React.Component<BoundaryProps, BoundaryState> {
  constructor(props: BoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Navigation error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const { copy } = this.props;
      return (
        <div className="flex min-h-dvh w-full items-center justify-center bg-background p-8">
          <EmptyState
            variant="error"
            icon={TriangleAlert}
            title={copy.title}
            description={copy.description}
            action={{
              label: copy.refresh,
              onClick: () => window.location.reload(),
            }}
            className="max-w-md"
          />
        </div>
      );
    }

    return this.props.children;
  }
}

export function NavigationErrorBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations();

  return (
    <Boundary
      copy={{
        title: t("navigation.error.title"),
        description: t("navigation.error.description"),
        refresh: t("navigation.error.refresh"),
      }}
    >
      {children}
    </Boundary>
  );
}
