module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    //color names generated with https://chir.ag/projects/name-that-color
    colors: {
      'alto': '#D9D9D9',
      'fuscous-gray': '#494845'
    },
    extend: {
      fontFamily: {
        'bison': ['bison', 'sans-serif'],
        'bison-bold': ['bison-bold', 'sans-serif'],
      }
    },
  },
  plugins: [],
};
