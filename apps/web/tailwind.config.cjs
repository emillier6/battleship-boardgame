/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}'],
  theme: {
    extend: {
      colors: {
        ocean: {
          900: '#03192f',
          700: '#0b3157',
          500: '#1c5b94',
          300: '#5fa8d3',
        },
      },
    },
  },
  plugins: [],
};
