/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cafe: {
          50: '#fbf9f6',
          100: '#f6f2ec',
          200: '#ece3d6',
          300: '#decbb6',
          400: '#caa88f',
          500: '#b8896d',
          600: '#a37155',
          700: '#835743',
          800: '#6c4739',
          900: '#583c31',
          950: '#2f1e19',
        },
        ink: {
          50: '#f6f7f9',
          100: '#ededf2',
          200: '#d7d9e2',
          300: '#b4b7c8',
          400: '#8c91a9',
          500: '#6f748f',
          600: '#585c76',
          700: '#474960',
          800: '#3c3e50',
          900: '#1b1c24',
          950: '#0e0e13',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'serif'],
      }
    },
  },
  plugins: [],
}
