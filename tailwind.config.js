const { fontFamily } = require("tailwindcss/defaultTheme");

module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        shell: {
          DEFAULT: "hsl(var(--shell))",
          foreground: "hsl(var(--shell-foreground))",
          muted: "hsl(var(--shell-muted))",
          hover: "hsl(var(--shell-hover))",
        },
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
      },
      borderRadius: {
        "2xl": "calc(var(--radius) + 6px)",
        xl: "calc(var(--radius) + 2px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 8px)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", ...fontFamily.sans],
        display: ["var(--font-display)", "var(--font-sans)", ...fontFamily.sans],
      },
      boxShadow: {
        soft: "0 12px 40px -16px rgba(2, 6, 23, 0.18)",
        card: "0 1px 2px rgba(2, 6, 23, 0.04)",
        glow: "0 8px 24px -12px hsl(var(--primary) / 0.45)",
        ring: "0 0 0 1px hsl(var(--border))",
      },
      backgroundImage: {
        grid: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.08) 1px, transparent 0)",
        "hero-glow":
          "radial-gradient(60% 50% at 50% 0%, hsl(158 64% 45% / 0.25), transparent 70%), radial-gradient(40% 40% at 90% 20%, hsl(217 91% 60% / 0.18), transparent 70%)",
        "brand-gradient": "linear-gradient(135deg, hsl(158 64% 46%), hsl(170 70% 38%) 50%, hsl(200 80% 45%))",
        shimmer: "linear-gradient(90deg, transparent 0%, hsl(var(--foreground) / 0.06) 50%, transparent 100%)",
      },
      keyframes: {
        shimmer: {
          from: { backgroundPosition: "-200% 0" },
          to: { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        shimmer: "shimmer 1.8s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
