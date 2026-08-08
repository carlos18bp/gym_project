/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  safelist: [
    // Activity feed colors - backgrounds
    'bg-green-200', 'bg-blue-200', 'bg-indigo-200', 'bg-red-200', 'bg-yellow-200', 'bg-gray-200',
    // Activity feed colors - borders
    'border-green-500', 'border-blue-500', 'border-indigo-500', 'border-red-500', 'border-yellow-500', 'border-gray-500',
    // Activity feed colors - timeline connectors
    'bg-green-300', 'bg-blue-300', 'bg-indigo-300', 'bg-red-300', 'bg-yellow-300', 'bg-gray-300',
    // Activity feed colors - icon text colors
    'text-green-500', 'text-blue-500', 'text-indigo-500', 'text-red-500', 'text-yellow-500', 'text-gray-500',
  ],
  theme: {
    extend: {
      // Viewport-unit utilities must compensate the global `zoom` applied to
      // <html> in src/style.css. CSS `zoom` scales the used value of lengths,
      // but viewport units resolve against the UNZOOMED viewport, so a plain
      // `100vh` paints at only 80% (desktop) / 75% (phone) of the screen.
      // Dividing by --app-zoom restores "exactly one viewport". The `, 1`
      // fallback keeps these utilities valid where style.css is not loaded.
      height: { screen: 'calc(100vh / var(--app-zoom, 1))' },
      minHeight: { screen: 'calc(100vh / var(--app-zoom, 1))' },
      maxHeight: { screen: 'calc(100vh / var(--app-zoom, 1))' },
      width: { screen: 'calc(100vw / var(--app-zoom, 1))' },
      fontFamily: {
        'regular': ['Inter-Regular', 'sans-serif'],
        'italic': ['Inter-Italic', 'sans-serif'],
        'medium': ['Inter-Medium', 'sans-serif'],
        'semibold': ['Inter-SemiBold', 'sans-serif'],
      },
      colors: {
        'primary': '#141E30',
        'secondary': '#3348FF',
        'terciary': '#F0F7FF',
        'selected-background': '#E0EDFF',
        'stroke': '#CCE0FF',
        'purple-brand': '#A69BFF'
      },
      animation: {
        'pulse-subtle': 'pulse-subtle 2s ease-in-out infinite',
      },
      keyframes: {
        'pulse-subtle': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(51, 72, 255, 0.3)' },
          '50%': { boxShadow: '0 0 0 4px rgba(51, 72, 255, 0.15)' },
        },
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}

