import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NuqsAdapter } from 'nuqs/adapters/react-router/v6'

import { router } from '@/app/router'

import { CommandPaletteProvider } from '@/features/search'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CommandPaletteProvider>
        <NuqsAdapter>
          <RouterProvider router={router} />
        </NuqsAdapter>
      </CommandPaletteProvider>
    </QueryClientProvider>
  )
}
