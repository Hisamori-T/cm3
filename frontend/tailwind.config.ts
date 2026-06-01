import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Roboto Mono", "ui-monospace", "monospace"],
        serif: ["Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", "serif"],
      },
      borderRadius: {
        sm: "3px",
        DEFAULT: "6px",
        md: "6px",
        lg: "8px",
        pill: "999px",
      },
      colors: {
        // brand = primary (handoff SSOT 名)
        brand: {
          DEFAULT: "#1B2A52",
          hover: "#2A3A6B",
          50: "#EEF1F8",
          100: "#DCE2F0",
        },
        // primary を brand のエイリアスとして残す（後方互換）
        primary: {
          DEFAULT: "#1B2A52",
          hover: "#2A3A6B",
          50: "#EEF1F8",
          100: "#DCE2F0",
        },
        accent: {
          DEFAULT: "#0E7C7B",
          hover: "#0B6968",
          50: "#E5F2F2",
        },
        stamp: "#C00000",
        bg: "#FAFAF9",
        surface: {
          DEFAULT: "#FFFFFF",
          2: "#F4F4F2",
          3: "#ECECE9",
        },
        border: {
          DEFAULT: "#E5E7EB",
          strong: "#D1D5DB",
        },
        muted: {
          DEFAULT: "#6B7280",
          subtle: "#9CA3AF",
        },
        status: {
          quote: "#9CA3AF",
          order: "#3B82F6",
          start: "#06B6D4",
          progress: "#F59E0B",
          done: "#10B981",
          billed: "#8B5CF6",
          paid: "#059669",
        },
        // 注文書ステータス
        order: {
          draft:        "#6B7280",
          sent:         "#3B82F6",
          signed:       "#F59E0B",
          acknowledged: "#10B981",
          cancelled:    "#C00000",
        },
        danger: "#C00000",
        warn: "#F59E0B",
        success: "#10B981",
      },
      fontSize: {
        xs:   ["11px", "1.5"],
        sm:   ["13px", "1.5"],
        base: ["14px", "1.55"],
        lg:   ["16px", "1.55"],
        xl:   ["18px", "1.4"],
        "2xl": ["22px", "1.35"],
        "3xl": ["28px", "1.25"],
      },
      boxShadow: {
        1: "0 1px 2px rgba(17,24,39,0.05)",
        2: "0 1px 3px rgba(17,24,39,0.08), 0 1px 2px rgba(17,24,39,0.04)",
        3: "0 4px 12px rgba(17,24,39,0.08), 0 2px 4px rgba(17,24,39,0.04)",
        pop: "0 12px 28px rgba(17,24,39,0.16), 0 4px 8px rgba(17,24,39,0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
