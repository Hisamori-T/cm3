import type { Config } from 'tailwindcss';

/**
 * Construction Manager v3 — Tailwind config (拡張部分のみ抜粋)
 * Construction Manager v3 のデザイントークンを Tailwind カラー名として
 * 使えるようにします。`bg-brand` `text-status-progress` `border-order-signed`
 * のように一貫した命名で書けます。
 */
const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // === ブランド ===
        brand: {
          DEFAULT: '#1B2A52', // クラップネイビー
          hover:   '#2A3A6B',
          50:      '#EEF1F8',
          100:     '#DCE2F0',
        },
        accent: {
          DEFAULT: '#0E7C7B',
          hover:   '#0B6968',
          50:      '#E5F2F2',
        },
        stamp:   '#C00000', // 印影専用 — 他UIには使わない

        // === 案件ステータス（7段階） ===
        status: {
          quote:    '#9CA3AF',
          order:    '#3B82F6',
          start:    '#06B6D4',
          progress: '#F59E0B',
          done:     '#10B981',
          billed:   '#8B5CF6',
          paid:     '#059669',
        },

        // === 注文書ステータス ===
        order: {
          draft:        '#6B7280',
          sent:         '#3B82F6',
          signed:       '#F59E0B',
          acknowledged: '#10B981',
          cancelled:    '#C00000',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Roboto Mono', 'ui-monospace', 'monospace'],
        serif: ['Hiragino Mincho ProN', 'Yu Mincho', 'Noto Serif JP', 'serif'],
      },
      fontSize: {
        // 業務UI用に Web標準より少し詰めめ
        xs:   ['11px', '1.5'],
        sm:   ['13px', '1.5'],
        base: ['14px', '1.55'],
        lg:   ['16px', '1.55'],
        xl:   ['18px', '1.4'],
        '2xl': ['22px', '1.35'],
        '3xl': ['28px', '1.25'],
      },
      borderRadius: {
        // 角丸は最大 lg(8px) — rounded-2xl 以上は使わない方針
        sm: '3px',
        md: '6px',
        lg: '8px',
      },
    },
  },
  plugins: [],
};

export default config;
