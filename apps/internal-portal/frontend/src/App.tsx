import { CssBaseline, Grid, ThemeProvider, createTheme } from '@mui/material'
import { Routes, Route } from 'react-router-dom'
import { QueryCache, QueryClient, QueryClientProvider } from 'react-query'
import { AxiosError } from 'axios'
import { alpha } from '@mui/material/styles'

import Home from './pages/Home'
import Lease from './pages/Lease/Lease'
import Progress from './pages/Progress'
import MaterialOptions from './pages/MaterialOptions/MaterialOptions'
import SiteHeader from './components/SiteHeader'
import Bison from '../assets/Bison-Regular.woff2'
import BisonBold from '../assets/Bison-Bold.woff2'
import GraphikRegular from '../assets/Graphik-Regular.woff2'
import GraphikBold from '../assets/Graphik-Bold.woff2'
import MaterialOptionDetails from './pages/MaterialOptions/MaterialOptionDetails'
import MaterialChoices from './pages/MaterialOptions/MaterialChoices'
import Login from './pages/Login/Login'
import Details from './pages/Details/Details'

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

const mdTheme = createTheme({
  palette: {
    mode: 'light',
    background: {
      default: 'white',
    },
    divider: '#951B81',
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
          marginTop: 20,
          marginBottom: 20,
          textTransform: 'initial',
          backgroundColor: '#00578A',
          borderRadius: '100px',
          fontFamily: 'graphikRegular',
          fontSize: 14,
          fontWeight: 500,
        },
      },
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15 * (60 * 1000), // 15 mins
      cacheTime: 30 * (60 * 1000), // 30 mins
    },
  },
  queryCache: new QueryCache({
    onError: (error) => {
      if ((error as AxiosError).response?.status === 401) {
        location.replace('/login')
      } else {
        console.log('An error occurred fetching data', error)
      }
    },
  }),
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={mdTheme}>
        <CssBaseline />
        <Grid
          container
          sx={{ marginBottom: 2, marginTop: 0, maxWidth: '450px' }}
        >
          <Grid item xs={0.5} />
          <Grid item xs={11}>
            <SiteHeader />
            <Routes>
              <Route path="/" element={<Home></Home>} />
              <Route path="/login" element={<Login></Login>} />
              <Route path="/mitt-boende" element={<Lease></Lease>} />
              <Route path="/mina-uppgifter" element={<Details></Details>} />
              <Route path="/att-gora" element={<Progress></Progress>} />
              <Route
                path="/materialval"
                element={<MaterialOptions></MaterialOptions>}
              />
              <Route
                path="/materialval/detaljer/:roomTypeId/:materialOptionGroupId/:materialOptionId"
                element={<MaterialOptionDetails></MaterialOptionDetails>}
              />
              <Route
                path="/materialval/val"
                element={<MaterialChoices></MaterialChoices>}
              />
            </Routes>
          </Grid>
          <Grid item xs={0.5} />
        </Grid>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App
