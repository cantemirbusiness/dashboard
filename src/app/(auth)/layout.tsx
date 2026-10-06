import type { ReactNode } from "react";
import { Logo } from "@/components/app/shell";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2">
          <Logo />
          <span className="text-[15px] font-semibold tracking-tight">Progress</span>
        </div>
        {children}
      </div>
    </main>
  );
}
