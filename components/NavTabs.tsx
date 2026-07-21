"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const tabs = [
  { href: "/", label: "Dashboard" },
  { href: "/trades", label: "Trades" },
  { href: "/analytics", label: "Analytics" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" },
];

export default function NavTabs() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const activeTab = tabs.find((t) => t.href === pathname);

  return (
    <>
      {/* Desktop: full pill nav */}
      <nav className="hidden md:flex items-center gap-1 bg-surface-2 rounded-full p-1 border border-surface-border">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
                active
                  ? "bg-brass text-surface-0 font-medium"
                  : "text-ink-secondary hover:text-ink-primary"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {/* Mobile: current page + dropdown menu */}
      <div className="md:hidden relative flex-1">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 bg-surface-2 border border-surface-border rounded-full px-4 py-1.5 text-sm"
        >
          <span className="font-medium">{activeTab?.label ?? "Menu"}</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`text-ink-muted transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {open && (
          <div className="absolute left-0 mt-2 w-48 bg-surface-2 border border-surface-border rounded-card overflow-hidden shadow-lg z-30">
            {tabs.map((tab) => {
              const active = pathname === tab.href;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  onClick={() => setOpen(false)}
                  className={`block px-4 py-2.5 text-sm transition-colors ${
                    active
                      ? "text-brass font-medium bg-surface-1"
                      : "text-ink-primary hover:bg-surface-1"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
