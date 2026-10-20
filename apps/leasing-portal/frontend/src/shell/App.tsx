import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AuthProvider } from '@onecore/auth'

import { leasingRoutes } from '../pages/routes'
import { AuthCallback } from './AuthCallback'
import { authConfig } from './authConfig'
import { ShellRoot } from './ShellRoot'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
})

const router = createBrowserRouter([
  { path: '/callback', element: <AuthCallback /> },
  { element: <ShellRoot />, children: leasingRoutes },
])

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider config={authConfig}>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  )
}
