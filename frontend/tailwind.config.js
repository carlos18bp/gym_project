/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'regular': ['Inter-Regular', 'sans-serif'],
        'medium': ['Inter-Medium', 'sans-serif'],
        'semibold': ['Inter-SemiBold', 'sans-serif'],
      },
      colors: {
        'primary': '#141E30',
        'secondary': '#3348FF',
        'terciary': '#F0F7FF',
        'selected-background': '#E0EDFF',
        'stroke': '#CCE0FF',
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}

