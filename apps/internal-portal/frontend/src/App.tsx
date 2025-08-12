import 'react-toastify/dist/ReactToastify.css'
import { CssBaseline, Grid, ThemeProvider } from '@mui/material'
import { Routes, Route, Outlet } from 'react-router-dom'
import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { ErrorBoundary } from 'react-error-boundary'
import { ToastContainer } from 'react-toastify'
import { LocalizationProvider } from '@mui/x-date-pickers'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'

import Home from './pages/Home/Home'
import SiteHeader from './components/SiteHeader'
import Login from './pages/Login/Login'
import MaterialChoiceDetails from './pages/MaterialChoiceDetails/MaterialChoiceDetails'
import ParkingSpaces from './pages/ParkingSpaces'
import ParkingSpace from './pages/ParkingSpace'
import { mdTheme } from './theme'
import Residences from './pages/Residences/Residences'
import PublishParkingSpacesPage from './pages/PublishParkingSpacesListings/PublishParkingSpacesListingsPage'
import { ContactPage } from './pages/Contact/index'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15 * (60 * 1000), // 15 mins
      gcTime: 30 * (60 * 1000), // 30 mins
    },
  },
  queryCache: new QueryCache({
    onError: (error) => {
      if ((error as AxiosError).response?.status === 401) {
        location.replace('/api/auth/login')
      } else {
        console.log('An error occurred fetching data', error)
      }
    },
  }),
})

const PageBase = () => {
  return (
    <ErrorBoundary fallback={<div>Oops, there was an error...</div>}>
      <Outlet />
    </ErrorBoundary>
  )
}

function App() {
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <QueryClientProvider client={queryClient}>
        <ToastContainer />
        <ThemeProvider theme={mdTheme}>
          <CssBaseline />
          <Grid container sx={{ marginBottom: 2, marginTop: 0 }}>
            <Grid item xs={0.5} />
            <Grid item xs={11}>
              <SiteHeader />
              <Routes>
                <Route element={<PageBase />}>
                  <Route path="/" element={<ParkingSpaces />} />
                  <Route path="/bilplatser" element={<ParkingSpaces />} />
                  <Route path="/bilplatser/:id" element={<ParkingSpace />} />
                  <Route
                    path="/bilplatser/publicera"
                    element={<PublishParkingSpacesPage />}
                  />
                  <Route path="/materialval" element={<Home />} />
                  <Route
                    path="/materialval/utskrift"
                    element={<MaterialChoiceDetails />}
                  />
                  <Route path="/sokandeprofil" element={<Residences />} />
                  <Route path="/kundkort" element={<ContactPage />} />
                  <Route path="/logout" element={<Login />} />
                </Route>
              </Routes>
            </Grid>
            <Grid item xs={0.5} />
          </Grid>
        </ThemeProvider>
      </QueryClientProvider>
    </LocalizationProvider>
  )
}

export default App
