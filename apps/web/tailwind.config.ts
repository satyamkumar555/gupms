import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: {
    colors: { navy: { 950: "#06142b", 900: "#0B2A55", 800: "#123766", 700: "#1B4A85" }, crimson: { DEFAULT: "#B3122E", dark: "#8E0E24" }, surface: "#F3F5F9", ink: "#1B2433" },
    fontFamily: { sans: ["Inter", "system-ui", "Segoe UI", "Arial", "sans-serif"] },
  } },
  plugins: [],
} satisfies Config;
