/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand blue (Tailwind "blue" scale) — pairs with sky for the brand gradient.
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
      backgroundImage: {
        // Company brand gradient: blue → sky blue.
        'brand-gradient': 'linear-gradient(135deg, #2563eb 0%, #38bdf8 100%)',
      },
      keyframes: {
        // Squash then slight overshoot — tactile "pop" for nav icons on click.
        'nav-pop': {
          '0%': { transform: 'scale(1)' },
          '35%': { transform: 'scale(0.82)' },
          '70%': { transform: 'scale(1.12)' },
          '100%': { transform: 'scale(1)' },
        },
        // Icon exits right, teleports off-screen left, drives back in.
        // Needs an overflow-hidden wrapper so the teleport is invisible.
        'nav-drive': {
          '0%': { transform: 'translateX(0)' },
          '50%': { transform: 'translateX(170%)' },
          '50.1%': { transform: 'translateX(-170%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'nav-drive-back': {
          '0%': { transform: 'translateX(0)' },
          '50%': { transform: 'translateX(-170%)' },
          '50.1%': { transform: 'translateX(170%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'nav-spin': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(180deg)' },
        },
        'nav-swing': {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '25%': { transform: 'rotate(-18deg)' },
          '55%': { transform: 'rotate(12deg)' },
          '80%': { transform: 'rotate(-6deg)' },
        },
        'nav-bounce': {
          '0%, 100%': { transform: 'translateY(0)' },
          '30%': { transform: 'translateY(-35%)' },
          '55%': { transform: 'translateY(0)' },
          '75%': { transform: 'translateY(-15%)' },
        },
        'nav-pulse': {
          '0%, 100%': { transform: 'scale(1)' },
          '25%': { transform: 'scale(1.25)' },
          '50%': { transform: 'scale(0.95)' },
          '70%': { transform: 'scale(1.12)' },
        },
        'nav-flip': {
          '0%': { transform: 'rotateY(0deg)' },
          '100%': { transform: 'rotateY(360deg)' },
        },
        'nav-rise': {
          '0%': { transform: 'translate(0, 0)' },
          '25%': { transform: 'translate(-30%, 35%) scale(0.85)', opacity: '0.5' },
          '100%': { transform: 'translate(0, 0) scale(1)', opacity: '1' },
        },
        'nav-grow': {
          '0%': { transform: 'scaleY(1)' },
          '30%': { transform: 'scaleY(0.25)' },
          '70%': { transform: 'scaleY(1.15)' },
          '100%': { transform: 'scaleY(1)' },
        },
        'nav-shake': {
          '0%, 100%': { transform: 'translateX(0) rotate(0deg)' },
          '20%': { transform: 'translateX(-15%) rotate(-6deg)' },
          '40%': { transform: 'translateX(12%) rotate(5deg)' },
          '60%': { transform: 'translateX(-8%) rotate(-3deg)' },
          '80%': { transform: 'translateX(5%) rotate(2deg)' },
        },
        'nav-swipe': {
          '0%, 100%': { transform: 'translateX(0) rotate(0deg)' },
          '30%': { transform: 'translateX(-25%) rotate(-12deg)' },
          '60%': { transform: 'translateX(30%) rotate(10deg)' },
        },
      },
      animation: {
        'nav-pop': 'nav-pop 400ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        'nav-drive': 'nav-drive 600ms ease-in-out',
        'nav-drive-back': 'nav-drive-back 600ms ease-in-out',
        'nav-spin': 'nav-spin 500ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        'nav-swing': 'nav-swing 600ms ease-in-out',
        'nav-bounce': 'nav-bounce 600ms cubic-bezier(0.28, 0.84, 0.42, 1)',
        'nav-pulse': 'nav-pulse 600ms ease-in-out',
        'nav-flip': 'nav-flip 600ms ease-in-out',
        'nav-rise': 'nav-rise 500ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        'nav-grow': 'nav-grow 600ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        'nav-shake': 'nav-shake 500ms ease-in-out',
        'nav-swipe': 'nav-swipe 600ms ease-in-out',
      },
    },
  },
  plugins: [
    function ({ addUtilities }) {
      addUtilities({
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        },
        '.pb-safe': {
          'padding-bottom': 'env(safe-area-inset-bottom, 0px)',
        },
        '.safe-bottom': {
          'padding-bottom': 'env(safe-area-inset-bottom, 0px)',
        },
      })
    },
  ],
}
