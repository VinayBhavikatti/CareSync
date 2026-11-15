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
        // CareSync accessible teal brand
        caresync: {
          50: '#f0fdfa', 100: '#ccfbf1', 200: '#99f6e4', 300: '#5eead4',
          400: '#2dd4bf', 500: '#14b8a6', 600: '#0f766e', 700: '#115e59',
          800: '#134e4a', 900: '#042f2e',
        },
        surface: {
          DEFAULT: '#ffffff',
          dark: '#1a1a2e',
        },
      },
      borderRadius: { 'xl': 'var(--radius-card)', '2xl': '1.25rem' },
    },
  },
  plugins: [],
};

