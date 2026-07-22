import type { Metadata } from "next";
import { Manrope, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import AppHeader from "@/components/AppHeader";
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
          <AppHeader />
          <main className="max-w-6xl mx-auto px-4 md:px-6 py-8 print:max-w-none print:px-0 print:py-0">
            {children}
          </main>
          </WinRateModeProvider>
        </AccountProvider>
      </body>
    </html>
  );
}
