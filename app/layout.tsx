import type { Metadata } from "next";
import { Manrope, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import AccountSwitcher from "@/components/AccountSwitcher";
import NavTabs from "@/components/NavTabs";
import { AccountProvider } from "@/lib/AccountContext";
import { WinRateModeProvider } from "@/lib/WinRateModeContext";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jbmono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jbmono" });

export const metadata: Metadata = {
  title: "Trade journal",
  description: "A personal trading journal",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${manrope.variable} ${inter.variable} ${jbmono.variable}`}>
      <body className="font-body min-h-screen">
        <AccountProvider>
          <WinRateModeProvider>
          <header className="print:hidden border-b border-surface-border bg-surface-1/60 backdrop-blur sticky top-0 z-10">
            <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center justify-between gap-3 md:gap-6">
              <div className="flex items-center gap-2 md:gap-3 shrink-0">
                <span className="signal-bar h-6" />
                <span className="hidden sm:inline font-display font-medium text-lg tracking-tight">
                  Trade journal
                </span>
              </div>
              <NavTabs />
              <AccountSwitcher />
            </div>
          </header>
          <main className="max-w-6xl mx-auto px-4 md:px-6 py-8 print:max-w-none print:px-0 print:py-0">
            {children}
          </main>
          </WinRateModeProvider>
        </AccountProvider>
      </body>
    </html>
  );
}
