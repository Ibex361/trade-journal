import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Neutral surfaces. 1/2 are translucent "glass" fills meant to sit on
        // top of the atmospheric gradient body background (see globals.css) —
        // every existing bg-surface-1 / bg-surface-2 panel becomes a glass
        // panel automatically, no component changes needed.
        surface: {
          0: "#090A11", // solid near-black — inputs, overlays, text-on-accent
          1: "rgba(255,255,255,0.045)", // primary glass panel fill
          2: "rgba(255,255,255,0.07)", // nested / hover glass fill
          border: "rgba(255,255,255,0.09)",
          // Near-opaque dark fill for full-screen/slide-over surfaces that are
          // the primary reading surface (forms), where the light 4.5-7% glass
          // fills let too much of the busy background bleed through the text.
          solid: "rgba(9,10,17,0.97)",
          // Darker, more-opaque frosted fill for chart tooltips/popovers —
          // still translucent (keeps the glass feel on hover/click) but dark
          // and opaque enough that text stays legible over dense bar fills.
          popover: "rgba(10,11,20,0.92)",
        },
        ink: {
          primary: "#EDEFF7",
          secondary: "#9BA0BE",
          muted: "#5C6180",
        },
        // Signature two-tone accent for Concept C: a teal-to-violet glow.
        glow: {
          DEFAULT: "#5CE6C8",
          violet: "#7C6FF0",
          dim: "#2F9885",
        },
        gain: "#5CE6C8", // same teal as glow — a win is the glow signal
        loss: "#FB7185",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"], // Space Grotesk
        body: ["var(--font-body)", "sans-serif"], // Inter
        mono: ["var(--font-mono)", "monospace"], // JetBrains Mono
      },
      borderRadius: {
        card: "18px", // was 14px — every existing panel picks this up as-is
        panel: "20px", // new, larger radius for Step 3's bigger glass sections
      },
      boxShadow: {
        glass: "0 20px 50px rgba(0,0,0,.35)",
        glow: "0 0 18px rgba(92,230,200,.5)",
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
