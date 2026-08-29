import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#12181B",
        panel: "#182023",
        board: "#F6F3EC",
        boardAlt: "#EFEBE1",
        boardLine: "#D5CEC0",
        ink: "#1C2529",
        muted: "#77837F",
        accent: "#6FBFB2",
        accentDeep: "#08302B",
        note: "#F9A8C8",
        noteAlt: "#F58FB8",
        noteInk: "#3A1123",
        warn: "#D98B3F",
        danger: "#8E3324",
      },
      fontFamily: {
        ui: ["Archivo", "Segoe UI", "system-ui", "sans-serif"],
        hand: ["Caveat", "Bradley Hand", "cursive"],
        mono: ["IBM Plex Mono", "ui-monospace", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
