/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {
    fontFamily: { mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'] },
    keyframes: {
      ripple: { '0%': { transform: 'scale(.4)', opacity: '.9' }, '100%': { transform: 'scale(2.4)', opacity: '0' } },
      bridge: { '0%,100%': { transform: 'rotate(-20deg)' }, '50%': { transform: 'rotate(25deg)' } },
      rise: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
    },
    animation: { ripple: 'ripple 1.8s ease-out infinite', bridge: 'bridge 9s ease-in-out infinite', rise: 'rise .35s ease-out' },
  } },
  plugins: [],
};
