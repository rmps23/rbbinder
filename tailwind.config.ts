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
      },
    },
  },
  plugins: [],
};

export default config;
