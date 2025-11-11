/** @type {import('tailwindcss').Config} */
const colors = require('tailwindcss/colors');

module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      // 1. FORMALIZE THE COLOR PALETTE
      colors: {
        // Use slate for backgrounds, borders, and muted text
        slate: colors.slate,
        // Use indigo as the primary accent color
        primary: colors.indigo,
        // Use green for success states
        success: colors.emerald,
        // Use red for danger/delete states
        danger: colors.rose,
        // Use for pending states
        warning: colors.amber,
      },
      // 2. KEEP THE INTER FONT
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      // 3. DEFINE A SUBTLE "popIn" animation (optional but nice)
      keyframes: {
        popIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        }
      },
      animation: {
        popIn: 'popIn 0.25s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
      }
    },
  },
  plugins: [],
}