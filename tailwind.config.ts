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
        ink: "#0a0d14",
        panel: "#141a24",
        panel2: "#1a212c",
        brand: {
          gold: "#d8ab52",
          goldSoft: "#c8aa6e",
          cyan: "#0ac8b9",
          red: "#ef4360",
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
