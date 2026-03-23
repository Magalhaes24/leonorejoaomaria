/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Palette uses CSS variables for easy light/dark theming.
        ink: {
          50: "rgb(var(--ink-50) / <alpha-value>)",
          100: "rgb(var(--ink-100) / <alpha-value>)",
          200: "rgb(var(--ink-200) / <alpha-value>)",
          300: "rgb(var(--ink-300) / <alpha-value>)",
          400: "rgb(var(--ink-400) / <alpha-value>)",
          500: "rgb(var(--ink-500) / <alpha-value>)",
          600: "rgb(var(--ink-600) / <alpha-value>)",
          700: "rgb(var(--ink-700) / <alpha-value>)",
          800: "rgb(var(--ink-800) / <alpha-value>)",
          900: "rgb(var(--ink-900) / <alpha-value>)",
        },
        pearl: {
          50: "rgb(var(--pearl-50) / <alpha-value>)",
          100: "rgb(var(--pearl-100) / <alpha-value>)",
          200: "rgb(var(--pearl-200) / <alpha-value>)",
          300: "rgb(var(--pearl-300) / <alpha-value>)",
          400: "rgb(var(--pearl-400) / <alpha-value>)",
          500: "rgb(var(--pearl-500) / <alpha-value>)",
          600: "rgb(var(--pearl-600) / <alpha-value>)",
          700: "rgb(var(--pearl-700) / <alpha-value>)",
          800: "rgb(var(--pearl-800) / <alpha-value>)",
          900: "rgb(var(--pearl-900) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["Manrope", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 20px 60px -30px rgb(var(--ink-900) / 0.35)",
        glow: "0 0 0 1px rgb(var(--pearl-50) / 0.08), 0 16px 40px -28px rgb(var(--pearl-500) / 0.4)",
      },
      backgroundImage: {
        "hero-glow":
          "radial-gradient(1200px 500px at 10% 20%, rgb(var(--pearl-500) / 0.18), transparent 60%), radial-gradient(900px 450px at 90% 0%, rgb(var(--ink-50) / 0.2), transparent 70%)",
        grain:
          "linear-gradient(0deg, rgb(var(--pearl-50) / 0.02), rgb(var(--pearl-50) / 0.02)), url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"200\" height=\"200\" viewBox=\"0 0 200 200\"><filter id=\"n\"><feTurbulence type=\"fractalNoise\" baseFrequency=\"0.8\" numOctaves=\"2\" stitchTiles=\"stitch\"/></filter><rect width=\"200\" height=\"200\" fill=\"%23101820\" filter=\"url(%23n)\" opacity=\"0.15\"/></svg>')",
      },
    },
  },
  plugins: [],
};
