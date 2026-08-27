import { notFound } from "next/navigation";
import { TourProvider } from "@/components/demo/tour-provider";
import { isDemoMode } from "@/lib/demo/flag";

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  // Fail closed: a customer deployment that ships this route group must not
  // serve it.
  if (!isDemoMode()) notFound();
  return <TourProvider>{children}</TourProvider>;
}
