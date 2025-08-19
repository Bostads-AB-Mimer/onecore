import { useState } from 'react'
import { GridRowId } from '@mui/x-data-grid'
import { useCreateMultipleListings } from './useCreateMultipleListings'

interface UsePublishParkingSpacesResult {
  handlePublishParkingSpaces: (
    ids: GridRowId[],
    rentalRules: Record<string, 'SCORED' | 'NON_SCORED'>
  ) => void
  isPending: boolean
  message: { text: string; severity: 'success' | 'error' } | null
  setMessage: (message: { text: string; severity: 'success' | 'error' } | null) => void
}

export const usePublishParkingSpaces = (): UsePublishParkingSpacesResult => {
  const [message, setMessage] = useState<{
    text: string
    severity: 'success' | 'error'
  } | null>(null)

  const { mutate: createMultipleListings, isPending } =
    useCreateMultipleListings()

  const groupParkingSpacesByRentalRule = (
    ids: GridRowId[],
    rentalRules: Record<string, 'SCORED' | 'NON_SCORED'>
  ) => {
    return ids.reduce(
      (acc, id) => {
        const rentalObjectCode = String(id)
        const rentalRule = rentalRules[rentalObjectCode] || 'SCORED'

        if (!acc[rentalRule]) {
          acc[rentalRule] = []
        }
        acc[rentalRule].push(rentalObjectCode)
        return acc
      },
      {} as Record<'SCORED' | 'NON_SCORED', string[]>
    )
  }

  const publishParkingSpaces = (
    ids: GridRowId[],
    rentalRules: Record<string, 'SCORED' | 'NON_SCORED'>
  ) => {
    if (ids.length === 0) return

    const groupedByRule = groupParkingSpacesByRentalRule(ids, rentalRules)

    // Create listings for each rental rule group
    const promises = Object.entries(groupedByRule).map(
      ([rentalRule, rentalObjectCodes]) =>
        new Promise((resolve, reject) => {
          createMultipleListings(
            {
              rentalObjectCodes,
              rentalRule: rentalRule as 'SCORED' | 'NON_SCORED',
            },
            {
              onSuccess: (result) => resolve(result),
              onError: (error) => reject(error),
            }
          )
        })
    )

    // Handle all promises
    Promise.allSettled(promises)
      .then((results) => {
        const successful = results.filter(
          (r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled'
        )
        const failed = results.filter((r) => r.status === 'rejected')

        const totalListings = successful.reduce((sum, result) => {
          return sum + (result.value?.content?.length || 0)
        }, 0)

        if (failed.length === 0) {
          setMessage({
            text: `Successfully created ${totalListings} listings`,
            severity: 'success',
          })
        } else {
          setMessage({
            text: `Created ${totalListings} listings successfully, ${failed.length} groups failed`,
            severity: 'error',
          })
        }
      })
      .catch(() => {
        setMessage({
          text: 'Failed to create listings',
          severity: 'error',
        })
      })
  }

  return {
    handlePublishParkingSpaces: publishParkingSpaces,
    isPending,
    message,
    setMessage,
  }
}
