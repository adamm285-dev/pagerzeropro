/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        crt: { bg: "#070905", panel: "#0c1008", bar: "#0a0e07", line: "#4a6a28" },
        phosphor: { DEFAULT: "#b8e06a", dim: "#7a9a4a", bright: "#9adf4a" },
        "amber-term": "#ffbf3c",
        "red-term": "#ff8888",
      },
      fontFamily: {
        sans: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      borderRadius: { none: "0px" },
    },
  },
  plugins: [],
};
