import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        domain: {
          fury: "#C0392B",
          calm: "#3F8F4F",
          mind: "#2E7FB8",
          body: "#B8862E",
          chaos: "#8E44AD",
          order: "#D4AF37",
          colorless: "#7A7A7A",
        },
        foil: "#f6c453",
        ink: "rgb(var(--ink) / <alpha-value>)",
        panel: "rgb(var(--panel) / <alpha-value>)",
        panel2: "rgb(var(--panel2) / <alpha-value>)",
        brand: {
          gold: "rgb(var(--accent) / <alpha-value>)",
          goldSoft: "rgb(var(--accent-soft) / <alpha-value>)",
          cyan: "rgb(var(--mint) / <alpha-value>)",
          red: "rgb(var(--danger) / <alpha-value>)",
        },
      },
      keyframes: {
        "page-in-right": {
          from: { opacity: "0", transform: "translateX(32px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "page-in-left": {
          from: { opacity: "0", transform: "translateX(-32px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "sheet-up": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        pop: {
          "0%": { transform: "scale(1)" },
          "40%": { transform: "scale(1.35)" },
          "100%": { transform: "scale(1)" },
        },
        "card-in": {
          from: { opacity: "0", transform: "translateY(8px) scale(0.97)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        "page-in-right": "page-in-right 280ms cubic-bezier(0.22, 1, 0.36, 1)",
        "page-in-left": "page-in-left 280ms cubic-bezier(0.22, 1, 0.36, 1)",
        "sheet-up": "sheet-up 260ms cubic-bezier(0.22, 1, 0.36, 1)",
        "fade-in": "fade-in 200ms ease-out",
        pop: "pop 260ms cubic-bezier(0.22, 1, 0.36, 1)",
        "card-in": "card-in 240ms cubic-bezier(0.22, 1, 0.36, 1) both",
        shimmer: "shimmer 3s linear infinite",
      },
      fontFamily: {
        sans: ["var(--font-public-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-oswald)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
