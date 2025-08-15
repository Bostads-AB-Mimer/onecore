import { alpha, createTheme } from '@mui/material/styles'
import type {} from '@mui/x-data-grid/themeAugmentation'
import { radioClasses } from '@mui/material'
import { svSE } from '@mui/x-data-grid/locales'

import BisonBold from '../assets/Bison-Bold.woff2'
import Bison from '../assets/Bison-Regular.woff2'
import GraphikBold from '../assets/Graphik-Bold.woff2'
import GraphikRegular from '../assets/Graphik-Regular.woff2'

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
    'dark-outlined-utility': true
  }
}

// Update the Typography's variant prop options
declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    title: true
    hMenu: true
  }
}

declare module '@mui/material/styles' {
  interface Palette {
    warmGrey: Palette['primary']
  }

  interface PaletteOptions {
    warmGrey?: PaletteOptions['primary']
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

const theme = createTheme({
  palette: {
    mode: 'light',
    background: {},
    divider: 'rgba(218, 215, 211, 1)',
    grey: { '200': 'rgba(217, 217, 217, 0.5)' },
    warmGrey: {
      main: 'rgba(73, 72, 69, 1)',
    },
    primary: { main: '#000000' },
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
      'form &': {
        fontSize: 20,
        paddingLeft: 4,
        paddingBottom: 7,
      },
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
})

export const mdTheme = createTheme(
  theme,
  {
    components: {
      MuiRadio: {
        styleOverrides: {
          root: {
            color: 'black',
            [`&.${radioClasses.checked}`]: {
              color: '#007BC4',
            },
          },
        },
      },
      MuiCssBaseline: {
        styleOverrides: {
          html: [
            { '@font-face': bison },
            { '@font-face': bisonBold },
            { '@font-face': graphikRegular },
            { '@font-face': graphikBold },
          ],
          fieldset: {
            border: 'none',
            margin: 0,
            padding: 0,
          },
          textarea: {
            resize: 'none',
            overflow: 'auto',
            fontFamily: 'graphikRegular',
            fontSize: 14,
            padding: '8.5px 14px',
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          input: {
            paddingTop: 8.5,
            paddingBottom: 8.5,
          },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: {
            marginTop: 7,
            marginBottom: 7,
            'form &': {
              marginTop: '20px',
              marginBottom: '20px',
            },
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
            fontFamily: 'graphikRegular',
            fontSize: 14,
            fontWeight: 500,
          },
        },
        variants: [
          {
            props: { variant: 'dark' },
            style: {
              textTransform: 'none',
              fontWeight: 700,
              backgroundColor: 'black',
              color: 'white',
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
              textTransform: 'none',
              border: '1px solid black',
              fontWeight: 700,
              color: 'rgba(0, 0, 0, 1)',
              background: 'white',
              ':hover': {
                background: 'white',
              },
            },
          },
          {
            props: { variant: 'dark-outlined-utility' },
            style: {
              borderRadius: '6px',
              textTransform: 'none',
              border: '2px solid black',
              fontWeight: 700,
              color: 'rgba(0, 0, 0, 1)',
              padding: 4,
              lineHeight: 1,
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
            fontFamily: 'bisonBold',
            fontSize: '1.125rem',
            color: theme.palette.warmGrey.main,
          },
          cell: { fontSize: '1.25em' },
          checkboxInput: {
            color: '#007BC4',
          },
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
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderBottom: 'none',
            padding: 8,
            paddingLeft: 0,
            paddingRight: 0,
            fontSize: 14,
          },
        },
      },
    },
  },
  svSE
)
