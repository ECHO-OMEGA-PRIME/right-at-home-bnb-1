/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/renderer/**/*.{js,ts,jsx,tsx,html}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        maroon: {
          50: '#fdf2f2',
          100: '#fce4e4',
          200: '#f9cece',
          300: '#f4a8a8',
          400: '#eb7070',
          500: '#dc4444',
          600: '#c82828',
          700: '#a81d1d',
          800: '#8b1c1c',
          900: '#500000', // Primary Aggie Maroon
          950: '#3d0000', // Dark variant
        },
        cream: {
          50: '#fdfdfb',
          100: '#f9f9f5',
          200: '#f5f5f0',
          300: '#e8e8e0',
          400: '#d5d5c8',
        },
        gold: {
          400: '#d4b896',
          500: '#c4a777',
          600: '#b49666',
        }
      },
      fontFamily: {
        'display': ['Playfair Display', 'Georgia', 'serif'],
        'sans': ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        'logo': ['Impact', 'Arial Black', 'Helvetica Neue', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 2px 8px rgba(0, 0, 0, 0.06)',
        'card-hover': '0 4px 16px rgba(0, 0, 0, 0.1)',
        'maroon': '0 4px 14px rgba(80, 0, 0, 0.25)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
