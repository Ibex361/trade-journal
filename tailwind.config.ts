import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // "Ledger at night" — flat, opaque, warm-graphite surfaces separated by
        // hairlines (elevation = a lighter step, not blur). Hex on purpose so
        // Tailwind opacity modifiers (bg-surface-0/70) work.
        surface: {
          0: "#0C0C0B", // canvas, inputs, text-on-accent
          1: "#141413", // panel
          2: "#1D1D1B", // raised / hover / nested
          border: "#2B2B28",
          solid: "#101010", // slide-overs and drawers
          popover: "#1A1A18", // chart tooltips / popovers
        },
        ink: {
          primary: "#F2EFE7",
          secondary: "#C2BDB0",
          muted: "#9A9584",
        },
        // The one accent: amber. Reserved for action, selection and focus —
        // gain/loss keep their own green/red so a button never reads as a P&L.
        glow: {
          DEFAULT: "#F2B544",
          violet: "#E5A02E", // legacy gradient end; flat-equivalent
          dim: "#B8861F",
        },
        gain: "#5BD59C",
        loss: "#F0675D",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"], // Instrument Serif
        body: ["var(--font-body)", "system-ui", "sans-serif"], // Hanken Grotesk
        mono: ["var(--font-mono)", "ui-monospace", "monospace"], // Spline Sans Mono
      },
      borderRadius: {
        card: "12px",
        panel: "14px",
      },
      boxShadow: {
        glass: "0 1px 0 rgba(255,255,255,0.035) inset, 0 12px 28px -16px rgba(0,0,0,0.7)",
        raised: "0 1px 0 rgba(255,255,255,0.35) inset, 0 4px 10px -4px rgba(0,0,0,0.6)",
      },
      transitionDuration: {
        fast: "150ms",
        base: "250ms",
        slow: "400ms",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(.16,1,.3,1)",
      },
      keyframes: {
        // Entrance for hero panels / heavier sections — a small rise plus
        // fade, so a page's headline content settles into place on load
        // instead of just popping in.
        "fade-rise": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        // Plain fade — for backdrops and anything where a rise would be
        // distracting (overlays, secondary chip rows).
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        // Centered dialog / lightbox entrance.
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        // Slide-over panel entrance (TradeFormPanel).
        "slide-in-right": {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        // Nav drawer entrance (AppHeader's More menu) — opposite edge from
        // slide-in-right since a navigation drawer conventionally opens
        // from the same side as its trigger (top-left hamburger).
        "slide-in-left": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
        // Bottom sheet entrance (retired from MobileTabBar's More menu,
        // kept in case another bottom-sheet surface wants it later).
        "slide-up": {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-rise": "fade-rise 0.5s cubic-bezier(.16,1,.3,1) both",
        "fade-in": "fade-in 0.25s ease-out both",
        "scale-in": "scale-in 0.25s cubic-bezier(.16,1,.3,1) both",
        "slide-in-right": "slide-in-right 0.35s cubic-bezier(.16,1,.3,1) both",
        "slide-in-left": "slide-in-left 0.35s cubic-bezier(.16,1,.3,1) both",
        "slide-up": "slide-up 0.3s cubic-bezier(.16,1,.3,1) both",
      },
    },
  },
  plugins: [],
};
export default config;
