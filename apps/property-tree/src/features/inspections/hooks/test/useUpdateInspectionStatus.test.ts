import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { inspectionService } from '@/services/api/core'

import { useUpdateInspectionStatus } from '../useUpdateInspectionStatus'

// --- Mocks ---

const mockToast = vi.fn()
vi.mock('@/shared/hooks/useToast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock('@/services/api/core', () => ({
  inspectionService: {
    updateInspectionStatus: vi.fn(),
  },
}))

// --- Helpers ---

const RENTAL_ID = 'rental-123'
const INSPECTION_ID = 'insp-456'

const makeInspection = (status: string) => ({
  id: INSPECTION_ID,
  status,
  address: 'Testgatan 1',
})

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

// --- Tests ---

describe('useUpdateInspectionStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('invalidates inspection queries on success', async () => {
    const queryClient = createQueryClient()
    vi.mocked(inspectionService.updateInspectionStatus).mockResolvedValueOnce(
      makeInspection('Påbörjad') as any
    )
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(
      () => useUpdateInspectionStatus({ rentalId: RENTAL_ID }),
      { wrapper: createWrapper(queryClient) }
    )

    act(() => {
      result.current.startInspection(INSPECTION_ID)
    })

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['inspections'],
      })
    })
  })

  it('shows success toast on success', async () => {
    const queryClient = createQueryClient()
    vi.mocked(inspectionService.updateInspectionStatus).mockResolvedValueOnce(
      makeInspection('Påbörjad') as any
    )

    const { result } = renderHook(
      () => useUpdateInspectionStatus({ rentalId: RENTAL_ID }),
      { wrapper: createWrapper(queryClient) }
    )

    act(() => {
      result.current.startInspection(INSPECTION_ID)
    })

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Status uppdaterad' })
      )
    })
  })

  it('rolls back cache on error', async () => {
    const queryClient = createQueryClient()
    const original = [makeInspection('Registrerad')]
    queryClient.setQueryData(['inspections', RENTAL_ID], original)

    vi.mocked(inspectionService.updateInspectionStatus).mockRejectedValueOnce(
      new Error('API error')
    )

    const { result } = renderHook(
      () => useUpdateInspectionStatus({ rentalId: RENTAL_ID }),
      { wrapper: createWrapper(queryClient) }
    )

    act(() => {
      result.current.startInspection(INSPECTION_ID)
    })

    await waitFor(() => {
      expect(queryClient.getQueryData(['inspections', RENTAL_ID])).toEqual(
        original
      )
    })
  })

  it('shows error toast on error', async () => {
    const queryClient = createQueryClient()
    vi.mocked(inspectionService.updateInspectionStatus).mockRejectedValueOnce(
      new Error('API error')
    )

    const { result } = renderHook(
      () => useUpdateInspectionStatus({ rentalId: RENTAL_ID }),
      { wrapper: createWrapper(queryClient) }
    )

    act(() => {
      result.current.startInspection(INSPECTION_ID)
    })

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive' })
      )
    })
  })

  it('applies optimistic update before API responds', async () => {
    const queryClient = createQueryClient()
    queryClient.setQueryData(
      ['inspections', RENTAL_ID],
      [makeInspection('Registrerad')]
    )

    // Never resolves — lets us inspect cache mid-flight
    vi.mocked(inspectionService.updateInspectionStatus).mockReturnValueOnce(
      new Promise(() => {})
    )

    const { result } = renderHook(
      () => useUpdateInspectionStatus({ rentalId: RENTAL_ID }),
      { wrapper: createWrapper(queryClient) }
    )

    act(() => {
      result.current.startInspection(INSPECTION_ID)
    })

    await waitFor(() => {
      const cached = queryClient.getQueryData<any[]>(['inspections', RENTAL_ID])
      expect(cached?.[0].status).toBe('Påbörjad')
    })
  })
})
