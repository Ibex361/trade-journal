"use client";

import { usePathname } from "next/navigation";
import AccountSwitcher from "@/components/AccountSwitcher";
import NavTabs from "@/components/NavTabs";
import SignOutButton from "@/components/SignOutButton";

export default function AppHeader() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <header className="print:hidden border-b border-surface-border bg-surface-1/60 backdrop-blur sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center justify-between gap-3 md:gap-6">
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          <span className="signal-bar h-6" />
          <span className="hidden sm:inline font-display font-medium text-lg tracking-tight">
            Trade journal
          </span>
        </div>
        <NavTabs />
        <div className="flex items-center gap-2 md:gap-3">
          <AccountSwitcher />
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
