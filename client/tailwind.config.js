/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink:     '#1A1F36',
        navy:    '#1E2D5A',
        maroon:  '#6B2737',
        'maroon-dark': '#4E1C27',
        paper:   '#F5F3EE',
        rule:    '#D4D0C8',
        surface: '#FFFFFF',
        pass:    '#3B6B47',
        fail:    '#8B3A3A',
        pending: '#7A6830',
        draft:   '#4A5568',
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans:  ['Inter', 'system-ui', 'sans-serif'],
      },
      fontVariantNumeric: {
        tabular: 'tabular-nums',
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      borderColor: {
        DEFAULT: '#D4D0C8',
      },
    },
  },
  plugins: [],
}
