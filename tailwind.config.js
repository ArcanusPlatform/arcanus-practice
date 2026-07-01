import tailwindcssAnimate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "rgb(var(--color-border-rgb) / <alpha-value>)",
        input: "rgb(var(--color-border-rgb) / <alpha-value>)",
        ring: "var(--color-ring)",
        background: "rgb(var(--color-bg-rgb) / <alpha-value>)",
        foreground: "rgb(var(--color-text-rgb) / <alpha-value>)",
        primary: {
          DEFAULT: "rgba(var(--brand-primary-rgb), <alpha-value>)",
          foreground: "var(--color-text-on-primary)",
        },
        secondary: {
          DEFAULT: "rgb(var(--color-surface-rgb) / <alpha-value>)",
          foreground: "rgb(var(--color-text-rgb) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "rgb(var(--color-danger-rgb) / <alpha-value>)",
          foreground: "var(--color-text-on-primary)",
        },
        muted: {
          DEFAULT: "rgb(var(--color-surface-rgb) / <alpha-value>)",
          foreground: "rgb(var(--color-text-muted-rgb) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgba(var(--brand-primary-rgb), <alpha-value>)",
          foreground: "var(--color-text-on-primary)",
        },
        popover: {
          DEFAULT: "rgb(var(--color-surface-rgb) / <alpha-value>)",
          foreground: "rgb(var(--color-text-rgb) / <alpha-value>)",
        },
        card: {
          DEFAULT: "rgb(var(--color-surface-rgb) / <alpha-value>)",
          foreground: "rgb(var(--color-text-rgb) / <alpha-value>)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [tailwindcssAnimate],
}
