/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class", // ✅ enables dark: variants
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
        display: ["var(--font-display)", "serif"],
      },
      colors: {
        brand: {
          50: "#f0f4ff",
          100: "#e0e9ff",
          200: "#c7d6fd",
          300: "#a5b8fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
          950: "#1e1b4b",
        },
        surface: {
          0: "#ffffff",
          50: "#fafafa",
          100: "#f4f4f5",
          200: "#e4e4e7",
          300: "#d4d4d8",
          800: "#27272a",
          900: "#18181b",
          950: "#09090b",
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-mesh":
          "radial-gradient(at 40% 20%, hsla(240,100%,74%,0.15) 0px, transparent 50%), radial-gradient(at 80% 0%, hsla(260,100%,76%,0.1) 0px, transparent 50%), radial-gradient(at 0% 50%, hsla(220,100%,76%,0.1) 0px, transparent 50%)",
      },
      animation: {
        "fade-up": "fadeUp 0.5s ease-out forwards",
        "fade-in": "fadeIn 0.4s ease-out forwards",
        "slide-in": "slideIn 0.4s ease-out forwards",
        shimmer: "shimmer 2s infinite",
        pulse2: "pulse2 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideIn: {
          "0%": { opacity: "0", transform: "translateX(-16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-1000px 0" },
          "100%": { backgroundPosition: "1000px 0" },
        },
        pulse2: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },
      boxShadow: {
        "brand-sm": "0 1px 3px 0 rgba(99,102,241,0.15)",
        brand: "0 4px 14px 0 rgba(99,102,241,0.25)",
        "brand-lg": "0 8px 30px rgba(99,102,241,0.3)",
        glass: "0 8px 32px 0 rgba(31, 38, 135, 0.07)",
        "glass-lg": "0 16px 48px 0 rgba(31, 38, 135, 0.12)",
      },
    },
  },
  plugins: [],
};