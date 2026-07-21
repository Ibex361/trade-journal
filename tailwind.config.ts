import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          0: "#0B0D10",
          1: "#14171C",
          2: "#1B1F26",
          border: "#272C34",
        },
        ink: {
          primary: "#EDEEF0",
          secondary: "#9AA2AF",
          muted: "#5C636F",
        },
        brass: {
          DEFAULT: "#D4A73C",
          dim: "#8A6F2A",
        },
        gain: "#2BB673",
        loss: "#E5484D",
      },
      fontFamily: {
        display: ["var(--font-manrope)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-jbmono)", "monospace"],
      },
      borderRadius: {
        card: "14px",
      },
    },
  },
  plugins: [],
};
export default config;
