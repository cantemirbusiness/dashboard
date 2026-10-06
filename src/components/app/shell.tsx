"use client";

import {
  Activity as ActivityIcon,
  BarChart3,
  Flag,
  FolderKanban,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  MoreHorizontal,
  Plus,
  Settings,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { signOut } from "@/lib/actions/auth";
import { cn } from "@/components/ui/cn";
import { Modal } from "@/components/ui/modal";
import { ToastProvider } from "@/components/ui/toast";
import { AppDataProvider, type AppData } from "./app-data";
import { QuickAddProvider, useQuickAdd } from "./quick-add";
import { ThemeToggle } from "./theme-toggle";

const NAV = [
  { href: "/", label: "Overview", Icon: LayoutDashboard },
  { href: "/evolution", label: "Evolution", Icon: TrendingUp },
  { href: "/skills", label: "Skills", Icon: Sparkles },
  { href: "/goals", label: "Goals", Icon: Flag },
  { href: "/projects", label: "Projects", Icon: FolderKanban },
  { href: "/activity", label: "Activity", Icon: ActivityIcon },
  { href: "/insights", label: "Insights", Icon: Lightbulb },
];

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`));

export function AppShell({ data, email, banner, children }: { data: AppData; email: string | null; banner?: ReactNode; children: ReactNode }) {
  return (
    <ToastProvider>
      <AppDataProvider value={data}>
        <QuickAddProvider>
          <ShellLayout email={email} banner={banner}>
            {children}
          </ShellLayout>
        </QuickAddProvider>
      </AppDataProvider>
    </ToastProvider>
  );
}

function ShellLayout({ email, banner, children }: { email: string | null; banner?: ReactNode; children: ReactNode }) {
  const path = usePathname();
  const openQuickAdd = useQuickAdd();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div className="min-h-dvh lg:pl-60">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-panel-2 focus:px-3 focus:py-2">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-sidebar lg:flex">
        <div className="flex h-14 items-center gap-2 px-5">
          <Logo />
          <span className="text-[15px] font-semibold tracking-tight">Progress</span>
        </div>
        <div className="px-3 pb-3">
          <button
            type="button"
            onClick={() => openQuickAdd()}
            className="flex h-9 w-full items-center gap-2 rounded-md border border-line-strong bg-panel-2 px-3 text-sm text-fg hover:bg-hover"
          >
            <Plus size={16} aria-hidden />
            Log activity
            <kbd className="ml-auto rounded border border-line px-1.5 text-[11px] text-faint">N</kbd>
          </button>
        </div>
        <nav aria-label="Main" className="flex-1 overflow-y-auto px-3">
          <ul className="flex flex-col gap-0.5">
            {NAV.map(({ href, label, Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={isActive(path, href) ? "page" : undefined}
                  className={cn(
                    "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13.5px] transition-colors",
                    isActive(path, href) ? "bg-hover font-medium text-fg" : "text-muted hover:bg-hover/60 hover:text-fg",
                  )}
                >
                  <Icon size={16} aria-hidden className={isActive(path, href) ? "text-accent" : undefined} />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex flex-col gap-2 border-t border-line p-3">
          <Link
            href="/settings"
            aria-current={isActive(path, "/settings") ? "page" : undefined}
            className={cn(
              "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13.5px]",
              isActive(path, "/settings") ? "bg-hover text-fg" : "text-muted hover:bg-hover/60 hover:text-fg",
            )}
          >
            <Settings size={16} aria-hidden />
            Settings
          </Link>
          <div className="flex items-center justify-between gap-2 px-1">
            <ThemeToggle compact />
            <form action={signOut}>
              <button type="submit" className="rounded-md p-1.5 text-faint hover:bg-hover hover:text-fg" title={`Sign out ${email ?? ""}`} aria-label="Sign out">
                <LogOut size={15} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-line bg-bg/90 px-4 backdrop-blur pt-[env(safe-area-inset-top)] lg:hidden">
        <Link href="/" className="flex items-center gap-2">
          <Logo />
          <span className="text-[15px] font-semibold tracking-tight">Progress</span>
        </Link>
        <span className="text-[13px] text-muted">{NAV.find((n) => isActive(path, n.href))?.label ?? (path.startsWith("/settings") ? "Settings" : "")}</span>
      </header>

      {banner}

      <main id="main" className="mx-auto w-full max-w-[1180px] px-4 pb-28 pt-5 sm:px-6 sm:pt-8 lg:px-10 lg:pb-16">
        {children}
      </main>

      {/* Mobile bottom navigation */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-sidebar/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <ul className="grid h-16 grid-cols-5">
          {[NAV[0], NAV[2]].map(({ href, label, Icon }) => (
            <MobileTab key={href} href={href} label={label} Icon={Icon} active={isActive(path, href)} />
          ))}
          <li className="flex items-center justify-center">
            <button
              type="button"
              onClick={() => openQuickAdd()}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-fg shadow-[var(--shadow)] active:scale-95"
              aria-label="Log activity"
            >
              <Plus size={24} />
            </button>
          </li>
          <MobileTab href={NAV[3].href} label={NAV[3].label} Icon={NAV[3].Icon} active={isActive(path, NAV[3].href)} />
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className={cn(
                "flex h-full w-full flex-col items-center justify-center gap-0.5 text-[11px]",
                ["/evolution", "/projects", "/activity", "/insights", "/settings"].some((h) => isActive(path, h)) ? "text-fg" : "text-faint",
              )}
            >
              <MoreHorizontal size={20} aria-hidden />
              More
            </button>
          </li>
        </ul>
      </nav>

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="Navigate">
        <ul className="grid grid-cols-2 gap-2">
          {[NAV[1], NAV[4], NAV[5], NAV[6], { href: "/settings", label: "Settings", Icon: Settings }].map(({ href, label, Icon }) => (
            <li key={href}>
              <Link
                href={href}
                onClick={() => setMoreOpen(false)}
                className={cn(
                  "flex h-14 items-center gap-3 rounded-lg border px-3 text-sm",
                  isActive(path, href) ? "border-accent bg-accent-soft" : "border-line hover:bg-hover",
                )}
              >
                <Icon size={18} aria-hidden className="text-muted" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
          <ThemeToggle />
          <form action={signOut}>
            <button type="submit" className="flex items-center gap-1.5 text-[13px] text-muted hover:text-fg">
              <LogOut size={14} /> Sign out
            </button>
          </form>
        </div>
        {email ? <p className="mt-3 text-[12px] text-faint">Signed in as {email}</p> : null}
      </Modal>
    </div>
  );
}

function MobileTab({ href, label, Icon, active }: { href: string; label: string; Icon: typeof BarChart3; active: boolean }) {
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn("flex h-full flex-col items-center justify-center gap-0.5 text-[11px]", active ? "text-fg" : "text-faint")}
      >
        <Icon size={20} aria-hidden className={active ? "text-accent" : undefined} />
        {label}
      </Link>
    </li>
  );
}

export function Logo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden className="text-accent">
      <path d="M4 18 L10 11 L14 14 L20 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="20" cy="6" r="2.2" fill="currentColor" />
    </svg>
  );
}
