import { isDemoMode } from "@/lib/demo/flag";

/**
 * Which currency and locale spend is displayed in.
 *
 * LiteLLM reports spend in USD and the product shows it that way. The demo
 * is a German sales surface, and a dollar sign on the cost screens read as
 * foreign to the buyers it was shown to; its FIXTURE values are declared
 * example figures on screen, so the display currency is a presentation
 * choice, not a conversion. `demo` is a parameter for the tests only.
 */
export function spendCurrency(demo: boolean = isDemoMode()): { currency: "USD" | "EUR"; locale: string } {
  return demo ? { currency: "EUR", locale: "de-DE" } : { currency: "USD", locale: "en-US" };
}
