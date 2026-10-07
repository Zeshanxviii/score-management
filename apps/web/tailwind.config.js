const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
/** Colors come from CSS variables so the same components render on the dark public screen and the light admin panel. */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { display: ['"Barlow Condensed"', '"Arial Narrow"', 'sans-serif'], sans: ['Barlow', 'system-ui', 'sans-serif'] },
      colors: { bg: v('bg'), surface: v('surface'), surface2: v('surface2'), fg: v('fg'), muted: v('muted'), line: v('line'),
        live: v('live'), gold: v('gold'), mint: v('mint'), accent: v('accent') },
    },
  },
  plugins: [],
};
