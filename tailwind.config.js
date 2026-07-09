/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      keyframes: {
        'scale-in-center': {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'fade-slide-in-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'suggestion-flash': {
          '0%': { boxShadow: '0 0 0 0 rgba(20, 184, 166, 0)' },
          '50%': { boxShadow: '0 0 8px 4px rgba(20, 184, 166, 0.4)' },
          '100%': { boxShadow: '0 0 0 0 rgba(20, 184, 166, 0)' },
        },
        'fade-in-subtle': {
          'from': { opacity: '0.8', transform: 'scale(0.99)' },
          'to': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'scale-in-center': 'scale-in-center 0.3s cubic-bezier(0.250, 0.460, 0.450, 0.940) both',
        'fade-slide-in-up': 'fade-slide-in-up 0.4s cubic-bezier(0.250, 0.460, 0.450, 0.940) both',
        'suggestion-flash': 'suggestion-flash 0.7s ease-in-out',
        'fade-in-subtle': 'fade-in-subtle 0.4s cubic-bezier(0.250, 0.460, 0.450, 0.940) both',
      },
    },
  },
  plugins: [],
};
