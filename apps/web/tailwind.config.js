/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // TEXAS A&M AGGIES OFFICIAL COLORS
        maroon: {
          50: '#fdf2f4',
          100: '#fce4e8',
          200: '#f9ccd4',
          300: '#f4a3b0',
          400: '#eb6b80',
          500: '#dc3c55',
          600: '#9a1c30',
          700: '#722F37',
          800: '#500000', // OFFICIAL AGGIE MAROON
          900: '#3D0000',
          950: '#2a0000',
          DEFAULT: '#500000',
        },
        // WHITE FOR CONTRAST
        white: '#FFFFFF',
        // Keep subtle backgrounds
        cream: {
          50: '#FFFFFF',
          100: '#FAFAFA',
          200: '#F5F5F5',
          DEFAULT: '#FFFFFF',
        },
        // Dark text
        charcoal: {
          50: '#F5F5F5',
          100: '#E5E5E5',
          200: '#CCCCCC',
          300: '#999999',
          400: '#666666',
          500: '#4D4D4D',
          600: '#333333',
          700: '#2D2D2D',
          800: '#1A1A1A',
          900: '#0D0D0D',
          DEFAULT: '#2D2D2D',
        },
      },
      fontFamily: {
        // Baseball-style display font for RAH logo
        baseball: ['Freshman', 'Impact', 'Arial Black', 'sans-serif'],
        display: ['var(--font-playfair)', 'Playfair Display', 'serif'],
        sans: ['var(--font-inter)', 'Inter', 'sans-serif'],
        body: ['var(--font-inter)', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        'elegant': '0 4px 20px rgba(80, 0, 0, 0.08)',
        'elegant-lg': '0 10px 40px rgba(80, 0, 0, 0.12)',
        'card': '0 2px 8px rgba(0, 0, 0, 0.06)',
        'maroon': '0 4px 14px rgba(80, 0, 0, 0.25)',
      },
      borderRadius: {
        'elegant': '12px',
      },
    },
  },
  plugins: [],
}
