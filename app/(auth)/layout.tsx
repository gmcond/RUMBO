import Link from "next/link";

import { CompassWake } from "@/components/brand/compass-wake";
import { Wordmark } from "@/components/brand/wordmark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center gap-8 overflow-hidden px-4 py-12">
      <CompassWake className="text-foreground/[0.06] dark:text-foreground/[0.1] pointer-events-none absolute -top-16 -right-20 w-64" />
      <Link href="/" aria-label="RUMBO — inicio" className="rounded-md">
        <Wordmark className="text-2xl" />
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
