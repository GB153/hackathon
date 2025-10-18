import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        brand: ["GeneralSans", "ui-sans-serif", "system-ui"],
        display: ["Alpino", "ui-sans-serif", "system-ui"],
      },
    },
  },
  plugins: [require("daisyui")],
} satisfies Config;
