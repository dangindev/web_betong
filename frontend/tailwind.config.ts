import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Outfit", "Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"]
      },
      colors: {
        primary: "#465fff",
        brand: {
          25: "#f2f5ff",
          50: "#ecf3ff",
          100: "#dde9ff",
          200: "#c2d6ff",
          300: "#9cb9ff",
          400: "#7592ff",
          500: "#465fff",
          600: "#3641f5",
          700: "#2a31d8",
          800: "#252dae",
          900: "#262e89",
          950: "#161950"
        },
        gray: {
          25: "#fcfcfd",
          50: "#f9fafb",
          100: "#f2f4f7",
          200: "#e4e7ec",
          300: "#d0d5dd",
          400: "#98a2b3",
          500: "#667085",
          600: "#475467",
          700: "#344054",
          800: "#1d2939",
          900: "#101828",
          950: "#0c111d"
        },
        success: {
          50: "#ecfdf3",
          500: "#12b76a",
          700: "#027a48"
        },
        warning: {
          50: "#fffaeb",
          500: "#f79009",
          700: "#b54708"
        },
        error: {
          50: "#fef3f2",
          500: "#f04438",
          700: "#b42318"
        }
      },
      boxShadow: {
        "theme-sm": "0 1px 2px 0 rgba(16, 24, 40, 0.05)",
        "theme-md": "0 4px 8px -2px rgba(16, 24, 40, 0.1)",
        "theme-lg": "0 12px 16px -4px rgba(16, 24, 40, 0.08)",
        "theme-xl": "0 20px 24px -4px rgba(16, 24, 40, 0.08), 0 8px 8px -4px rgba(16, 24, 40, 0.03)"
      }
    }
  },
  plugins: []
};

export default config;
