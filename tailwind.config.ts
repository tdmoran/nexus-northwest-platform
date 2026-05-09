import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand palette pulled from nexusnorthwest.org + the platform logo.
        // `brand-*` = navy spine. `accent-*` = teal mark on the logo.
        brand: {
          50: "#f5f7fb",
          100: "#e3e9f3",
          200: "#bdcadc",
          300: "#8da4c2",
          500: "#3a5a8a",
          600: "#27406a",
          700: "#162d52",
          800: "#0c243f",
          900: "#081728"
        },
        accent: {
          50: "#eef9f7",
          100: "#d3f0eb",
          300: "#7ec9bf",
          400: "#4cb6aa",
          500: "#2ea39a",
          600: "#1f817a",
          700: "#19655f"
        }
      },
      fontFamily: {
        sans: ["var(--font-poppins)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-poppins)", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      backgroundImage: {
        "hero-gradient":
          "radial-gradient(80% 80% at 50% 0%, rgba(46,163,154,0.20), transparent 70%), linear-gradient(180deg, #081728 0%, #0c243f 60%, #162d52 100%)",
        "soft-gradient": "linear-gradient(180deg, #f5f7fb 0%, #eef9f7 100%)"
      },
      boxShadow: {
        glow: "0 0 40px -10px rgba(46,163,154,0.45)",
        card: "0 20px 60px -20px rgba(8,23,40,0.25)"
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        "fade-up": "fade-up 0.6s ease-out both"
      }
    }
  },
  plugins: []
};

export default config;
