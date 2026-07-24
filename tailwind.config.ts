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
        // This is the real going-forward name — Step 3 should reach for this
        // (and `glow-violet`) directly when it rebuilds shared components.
        glow: {
          DEFAULT: "#5CE6C8",
          violet: "#7C6FF0",
        },
        // Deprecated alias for the old single-tone gold accent. Kept only so
        // the ~60 existing `brass-*` / `bg-brass` / `accent-brass` classes
        // scattered across components stay styled (now in teal) until Step 3
        // renames each of them onto `glow`. Remove this block once that's done.
        brass: {
          DEFAULT: "#5CE6C8",
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
    },
  },
  plugins: [],
};
export default config;
