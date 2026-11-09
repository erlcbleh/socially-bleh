import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}", "../shared/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        panel: {
          bg: "#000000",
          raised: "var(--surface)",
          border: "var(--line)",
          hover: "#1A1A1A",
        },
        severity: {
          high: "#FF4438",
          medium: "#FFFFFF",
          low: "#8A8A8A",
        },
      },
      borderRadius: {
        squircle: "14px",
      },
      borderWidth: {
        DEFAULT: "1.5px",
      },
      fontFamily: {
        sans: ["Satoshi", ...defaultTheme.fontFamily.sans],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      letterSpacing: {
        label: "0.14em",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-once": {
          "0%": { backgroundColor: "rgba(255,255,255,0.16)" },
          "100%": { backgroundColor: "transparent" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.15s ease-out",
        "pulse-once": "pulse-once 1.2s ease-out",
      },
    },
  },
} satisfies Config;
