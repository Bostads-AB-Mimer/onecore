import { alpha, createTheme } from '@mui/material/styles'

import BisonBold from '../assets/Bison-Bold.woff2'
import Bison from '../assets/Bison-Regular.woff2'
import GraphikBold from '../assets/Graphik-Bold.woff2'
import GraphikRegular from '../assets/Graphik-Regular.woff2'
import type {} from '@mui/x-data-grid/themeAugmentation'

declare module '@mui/material/styles' {
  interface TypographyVariants {
    title: React.CSSProperties
    hMenu: React.CSSProperties
  }

  // allow configuration using `createTheme`
  interface TypographyVariantsOptions {
    title?: React.CSSProperties
    hMenu?: React.CSSProperties
  }
}

declare module '@mui/material/Button' {
  interface ButtonPropsVariantOverrides {
    dark: true
    'dark-outlined': true
  }
}

// Update the Typography's variant prop options
declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    title: true
    hMenu: true
  }
}

const bison = {
  fontFamily: 'bison',
  fontStyle: 'normal',
  fontDisplay: 'swap',
  fontWeight: 400,
  src: `
    url(${Bison}) format('woff2')
  `,
}
const bisonBold = {
  fontFamily: 'bisonBold',
  fontStyle: 'bold',
  fontDisplay: 'swap',
  fontWeight: 900,
  src: `
    url(${BisonBold}) format('woff2')
  `,
}
const graphikRegular = {
  fontFamily: 'graphikRegular',
  fontStyle: 'normal',
  fontDisplay: 'swap',
  fontWeight: 400,
  src: `
    url(${GraphikRegular}) format('woff2')
  `,
}
const graphikBold = {
  fontFamily: 'graphikBold',
  fontStyle: 'normal',
  fontDisplay: 'swap',
  fontWeight: 500,
  src: `
    url(${GraphikBold}) format('woff2')
  `,
}

export const mdTheme = createTheme({
  palette: {
    mode: 'light',
    background: {},
    divider: '#951B81',
    grey: { '200': 'rgba(217, 217, 217, 0.5)' },
  },
  typography: {
    title: {
      fontSize: 36,
      textTransform: 'uppercase',
      fontFamily: 'bison',
      paddingTop: 10,
    },
    h1: {
      fontSize: 32,
      textTransform: 'uppercase',
      fontFamily: 'bisonBold',
      fontWeight: 900,
      paddingTop: 10,
    },
    h2: {
      fontSize: 20,
      textTransform: 'uppercase',
      fontFamily: 'bisonBold',
      fontWeight: 900,
      paddingTop: 10,
    },
    h3: {
      fontSize: 14,
      fontFamily: 'graphikRegular',
      paddingTop: 10,
      fontWeight: 900,
    },
    h4: {
      fontSize: 14,
    },
    hMenu: {
      fontSize: 20,
      fontFamily: 'bisonBold',
      textTransform: 'uppercase',
      color: '#007BC4',
      paddingTop: 65,
      paddingLeft: 15,
    },
    body1: {
      fontSize: 14,
      fontFamily: 'graphikRegular',
      paddingTop: 5,
    },
    body2: {
      fontSize: 12,
      fontFamily: 'graphikRegular',
      paddingTop: 5,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: [
          { '@font-face': bison },
          { '@font-face': bisonBold },
          { '@font-face': graphikRegular },
          { '@font-face': graphikBold },
        ],
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          paddingTop: 7,
          paddingBottom: 7,
        },
      },
    },
    MuiTypography: {
      defaultProps: {
        variantMapping: {
          title: 'h1',
          hMenu: 'h4',
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          textTransform: 'initial',
          backgroundColor: 'black',
          fontFamily: 'graphikRegular',
          fontSize: 14,
          fontWeight: 500,
        },
      },
      variants: [
        {
          props: { variant: 'dark' },
          style: {
            borderRadius: '8px',
            textTransform: 'none',
            fontWeight: 700,
            backgrund: 'rgba(0, 0, 0, 1)',
            color: 'rgba(255, 255, 255, 1)',
            transition: 'none',
            ':hover': {
              background: 'black',
            },
            ':disabled': {
              background: 'rgba(0, 0, 0, 0.2)',
            },
          },
        },
        {
          props: { variant: 'dark-outlined' },
          style: {
            borderRadius: '8px',
            textTransform: 'none',
            border: '2px solid black',
            fontWeight: 700,
            color: 'rgba(0, 0, 0, 1)',
            background: 'white',
            ':hover': {
              background: 'white',
            },
          },
        },
      ],
    },
    MuiLink: {
      styleOverrides: {
        root: {
          fontSize: 12,
          fontFamily: 'graphikRegular',
          color: '#951B81',
          fontWeight: 900,
          textDecoration: 'none',
        },
      },
    },
    MuiBackdrop: {
      styleOverrides: {
        root: {
          backgroundColor: alpha('#000', 0.2),
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          marginTop: 15,
          backgroundColor: '#F4EFE9',
          borderWidth: 0,
          borderRadius: 0,
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          paddingLeft: 43,
          paddingRight: 10,
          paddingTop: 0,
          paddingBottom: 0,
          marginBottom: 0,
        },
      },
    },
    MuiDataGrid: {
      styleOverrides: {
        root: {
          backgroundColor: 'white',
          border: 'none',
        },
        columnHeader: {
          borderBottom: '2px solid black',
        },
        cell: { fontSize: '1.25em' },
      },
    },
    MuiCardActions: {
      styleOverrides: {
        root: {
          paddingTop: 5,
          justifyContent: 'right',
        },
      },
    },
  },
})
