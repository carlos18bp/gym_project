/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'bold': ['Ubuntu-Bold', 'sans-serif'],
        'medium': ['Ubuntu-Medium', 'sans-serif'],
        'regular': ['Ubuntu-Regular', 'sans-serif'],
        'light': ['Ubuntu-Light', 'sans-serif'],
        'bolditalic': ['Ubuntu-BoldItalic', 'sans-serif'],
        'mediumitalic': ['Ubuntu-MediumItalic', 'sans-serif'],
        'italic': ['Ubuntu-Italic', 'sans-serif'],
        'lightitalic': ['Ubuntu-LightItalic', 'sans-serif'],
      },
      colors: {
        'primary': '#00002E',
        'secondary': '#D293FB',
        'therciary': '#3C46FF'
      }
    },
  },
  plugins: [],
}

