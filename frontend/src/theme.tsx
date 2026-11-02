import { createTheme } from '@mui/material/styles';
import { red, grey } from '@mui/material/colors';

// A custom theme for this app
// Una sola tinta para la acción principal, una sola esquina y un solo peso: lo de MUI y lo propio de la
// pantalla salen de acá, así no conviven dos estilos.
// El azul de lo fijado a mano (estilo.ts): una sola tinta, amable en switches y checkboxes.
const TINTA = '#1F4E9A';
const ESQUINA = 6;

const theme = createTheme({
  typography: {
    fontFamily: 'Nestle',
    button: { fontWeight: 700 },
  },
  shape: { borderRadius: ESQUINA },
  components: {
    // Botones en minúscula normal: en mayúsculas los textos se leen peor y se cortan antes.
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          textTransform: 'none',
          // Solo lo que cambia, y apretar se siente: escala apenas al presionar.
          transition: 'background-color 120ms ease-out, border-color 120ms ease-out, color 120ms ease-out, transform 120ms ease-out',
          '&:active': { transform: 'scale(0.97)' },
          '@media (prefers-reduced-motion: reduce)': { '&:active': { transform: 'none' } },
        },
        sizeSmall: { minHeight: 30, paddingLeft: 12, paddingRight: 12 },
        outlined: { borderColor: 'currentColor' },
      },
    },
    MuiToggleButton: { styleOverrides: { root: { textTransform: 'none' } } },
    MuiChip: { styleOverrides: { root: { borderRadius: ESQUINA, fontWeight: 700 } } },
    MuiAccordion: { styleOverrides: { root: { borderRadius: ESQUINA, '&:first-of-type, &:last-of-type': { borderRadius: ESQUINA } } } },
    MuiCssBaseline: {
      styleOverrides: `
        body {
          margin: 0;
          min-height: 100vh;
          overflow-x: hidden;
        }
        html {
          font-size: var(--base-unit, 16px);
        }
        @media (prefers-reduced-motion: no-preference) {
          html { scroll-behavior: smooth; }
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
      main: TINTA,
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