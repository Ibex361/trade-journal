import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import AppHeader from "@/components/AppHeader";
import { AccountProvider } from "@/lib/AccountContext";
import { WinRateModeProvider } from "@/lib/WinRateModeContext";

// Concept C's type pairing: Space Grotesk (display) + Inter (body) + JetBrains
// Mono (numbers). Inter/JetBrains Mono are unchanged from before.
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" });
const inter = Inter({ subsets: ["latin"], variable: "--font-body" });
const jbmono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Trade journal",
  description: "A personal trading journal",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Trade Journal",
  },
};

export const viewport: Viewport = {
  themeColor: "#090a11",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable} ${jbmono.variable}`}>
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
