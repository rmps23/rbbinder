import type { Config } from "tailwindcss";

// A surface colour that is translucent by default (the glass look); an explicit opacity modifier (bg-panel/70) wins.
const glass = (v: string, a: number) =>
  (({ opacityValue }: { opacityValue?: string }) =>
    `rgb(var(${v}) / ${opacityValue === undefined ? a : opacityValue})`) as unknown as string;

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
        foil: "#F5B84B",
        ink: "rgb(var(--ink) / <alpha-value>)",
        panel: glass("--panel", 0.94),
        panel2: glass("--panel2", 0.92),
        accentbg: "rgb(var(--accent) / 0.12)",
        "on-accent": "rgb(var(--on-accent) / <alpha-value>)",
        cavity: glass("--cavity", 0.8),
        line: "rgb(var(--line) / <alpha-value>)",
        line2: "rgb(var(--line2) / <alpha-value>)",
        t1: "rgb(var(--t1) / <alpha-value>)",
        t2: "rgb(var(--t2) / <alpha-value>)",
        t3: "rgb(var(--t3) / <alpha-value>)",
        ok: "rgb(var(--mint) / <alpha-value>)",
        bad: "rgb(var(--danger) / <alpha-value>)",
        warn: "rgb(var(--warn) / <alpha-value>)",
        violet: "rgb(var(--violet) / <alpha-value>)",
        rose: "rgb(var(--rose) / <alpha-value>)",
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
        "page-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
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
        "page-up": "page-up 260ms cubic-bezier(0.22, 1, 0.36, 1) backwards",
        "fade-in": "fade-in 200ms ease-out",
        pop: "pop 260ms cubic-bezier(0.22, 1, 0.36, 1)",
        "card-in": "card-in 240ms cubic-bezier(0.22, 1, 0.36, 1) both",
        shimmer: "shimmer 3s linear infinite",
      },
      // Smoother, slightly longer transitions everywhere (Tailwind's default is a quick 150ms).
      transitionDuration: { DEFAULT: "240ms" },
      transitionTimingFunction: { DEFAULT: "cubic-bezier(0.22, 1, 0.36, 1)" },
      // Squarer corners: 2-8px.
      borderRadius: {
        none: "0px",
        sm: "1px",
        DEFAULT: "2px",
        md: "2px",
        lg: "3px",
        xl: "4px",
        "2xl": "4px",
        "3xl": "6px",
        full: "9999px",
      },
      fontFamily: {
        sans: ["var(--font-public-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        logo: ["var(--font-chakra-petch)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-oswald)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
