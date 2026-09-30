import { createTheme } from '@mui/material/styles';
import { red, grey } from '@mui/material/colors';

// A custom theme for this app
const theme = createTheme({
  typography: {
    fontFamily: 'Nestle'
  },
  components: {
    // Botones en minúscula normal: en mayúsculas los textos se leen peor y se cortan antes.
    MuiButton: { styleOverrides: { root: { textTransform: 'none' } } },
    MuiToggleButton: { styleOverrides: { root: { textTransform: 'none' } } },
    MuiCssBaseline: {
      styleOverrides: `
        body {
          margin: 0;
          min-height: 100vh;
          overflow-x: hidden;
        }
        html {
          scroll-behavior: smooth;
          font-size: var(--base-unit, 16px);
        }
        #root {
          display: flex;
          flex-direction:row;
          height: 100vh;
        }
        @font-face {
          font-family: 'Nestle';
          font-style: normal;
          font-weight: 400;
          font-display: swap;
          src: local('Nestle Regular'), local('Nestle-Book'), url(/fonts/NestleText-Book.woff) format('woff2');
          unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
        }
        @font-face {
          font-family: 'Nestle';
          font-style: normal;
          font-weight: 700;
          font-display: swap;
          src: local('Nestle Bold'), local('Nestle-Bold'), url(/fonts/NestleText-Bold.woff) format('woff2');
          unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
        }
        @font-face {
          font-family: 'Nestle';
          font-style: normal;
          font-weight: 200;
          font-display: swap;
          src: local('Nestle Light'), local('Nestle-Light'), url(/fonts/NestleText-Light.woff) format('woff2');
          unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
        }`
    }
  },
  palette: {
    primary: {
      main: '#556cd6',
    },
    secondary: {
      main: grey[300],
    },
    error: {
      main: red.A400,
    },
  },
});

export default theme;