"use client";

/**
 * The state a demo-only route renders instead of an empty shell.
 *
 * The demo user is a super-admin, so every entry in the sidebar is reachable —
 * deliberately, because hiding two thirds of the navigation would understate
 * what IMP does. But only the routes in lib/demo/supported-routes.ts have
 * fixtures behind them. The rest issue GraphQL operations the resolver table
 * does not map, and unmapped operations resolve to `{data:{}}` by design, so
 * those pages used to render as a heading over nothing. A prospect clicking
 * around met a product that looked half-finished.
 *
 * Naming the reason fixes that. The screen is not broken and not forbidden —
 * it is simply outside the demo, and it says so.
 *
 * Copy is hardcoded German rather than routed through next-intl, following
 * lib/demo/tour.ts. The demo forces `locale = "de"` in the (application)
 * layout, so there is no second language to serve, and demo-only strings in
 * the product's shared catalogs would be carried by every real deployment.
 */

import { Compass } from "lucide-react";

import { EmptyState } from "@/components/primitives/empty-state";
import { hrefFor, startPosition } from "@/lib/demo/tour";

export function DemoUnavailable() {
  return (
    <div className="flex min-h-[60dvh] w-full flex-col items-center justify-center gap-4 p-4">
      <EmptyState
        icon={Compass}
        title="Dieser Bereich ist nicht Teil der Demo"
        description="Die Funktion gehört zum Produkt, wird in dieser geführten Demo aber nicht mit Beispieldaten gezeigt. In Ihrer eigenen Umgebung steht sie vollständig zur Verfügung."
        action={{ label: "Zurück zur Tour", href: hrefFor(startPosition()) }}
      />
    </div>
  );
}
