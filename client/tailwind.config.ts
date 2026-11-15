/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontSize: {
        // Ensure minimum 18px base for elderly accessibility
        base: ['18px', { lineHeight: '1.6' }],
        lg: ['20px', { lineHeight: '1.6' }],
        xl: ['22px', { lineHeight: '1.5' }],
        '2xl': ['26px', { lineHeight: '1.4' }],
        '3xl': ['32px', { lineHeight: '1.3' }],
        '4xl': ['40px', { lineHeight: '1.2' }],
      },
      minHeight: {
        'tap': '48px',  // Minimum tap target
      },
      minWidth: {
        'tap': '48px',
      },
      colors: {
        // Kindred brand — high-contrast, warm
        kindred: {
          50:  '#fef7f0',
          100: '#fdebd8',
          200: '#fad4b0',
          300: '#f7b47d',
          400: '#f38b47',
          500: '#ef6c24',
          600: '#e05218',
          700: '#ba3f15',
          800: '#943419',
          900: '#782d18',
        },
        surface: {
          DEFAULT: '#ffffff',
          dark: '#1a1a2e',
        },
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
      },
    },
  },
  plugins: [],
};

