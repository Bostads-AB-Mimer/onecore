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
  setMessage: (
    message: { text: string; severity: 'success' | 'error' } | null
  ) => void
}

export const usePublishParkingSpaces = (): UsePublishParkingSpacesResult => {
  const [message, setMessage] = useState<{
    text: string
    severity: 'success' | 'error'
  } | null>(null)

  const { mutate: createMultipleListings, isPending } =
    useCreateMultipleListings()

  // Configuration for batch processing
  const BATCH_SIZE = 50 // Process 50 parking spaces per batch
  const BATCH_DELAY = 500 // 500ms delay between batches

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

  // Split array into chunks of specified size
  const chunkArray = <T>(array: T[], size: number): T[][] => {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }

  // Delay function for spacing out batch requests
  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms))

  const publishParkingSpaces = async (
    ids: GridRowId[],
    rentalRules: Record<string, 'SCORED' | 'NON_SCORED'>
  ) => {
    if (ids.length === 0) return

    // Show warning for large batches
    if (ids.length > 200) {
      setMessage({
        text: `Publicerar ${ids.length} parkeringsplatser i batchar om ${BATCH_SIZE}. Detta kan ta en stund...`,
        severity: 'success',
      })
    }

    const groupedByRule = groupParkingSpacesByRentalRule(ids, rentalRules)

    let allSuccessful = 0
    let allFailed = 0

    try {
      // Process each rental rule group
      for (const [rentalRule, rentalObjectCodes] of Object.entries(
        groupedByRule
      )) {
        // Split large groups into smaller batches
        const batches = chunkArray(rentalObjectCodes, BATCH_SIZE)

        for (let i = 0; i < batches.length; i++) {
          const batch = batches[i]

          try {
            // Add delay between batches to avoid overwhelming the server
            if (i > 0) {
              await delay(BATCH_DELAY)
            }

            // Process the batch
            await new Promise<void>((resolve, reject) => {
              createMultipleListings(
                {
                  rentalObjectCodes: batch,
                  rentalRule: rentalRule as 'SCORED' | 'NON_SCORED',
                },
                {
                  onSuccess: (result) => {
                    allSuccessful += result?.content?.length || 0
                    resolve()
                  },
                  onError: (error) => {
                    allFailed += batch.length
                    console.error('Batch misslyckades:', error)
                    reject(error)
                  },
                }
              )
            })

            // Update progress for large operations
            if (ids.length > 100) {
              const processed = Math.min(
                (i + 1) * BATCH_SIZE,
                rentalObjectCodes.length
              )
              setMessage({
                text: `Bearbetar ${rentalRule}... ${processed}/${rentalObjectCodes.length} klara`,
                severity: 'success',
              })
            }
          } catch (error) {
            console.error(
              `Misslyckades med att bearbeta batch ${i + 1} för ${rentalRule}:`,
              error
            )
            allFailed += batch.length
            // Continue with next batch instead of stopping completely
          }
        }
      }

      // Final result message
      if (allFailed === 0) {
        setMessage({
          text: `Skapade ${allSuccessful} annonser framgångsrikt`,
          severity: 'success',
        })
      } else if (allSuccessful > 0) {
        setMessage({
          text: `Skapade ${allSuccessful} annonser framgångsrikt, ${allFailed} misslyckades`,
          severity: 'error',
        })
      } else {
        setMessage({
          text: 'Misslyckades med att skapa annonser',
          severity: 'error',
        })
      }
    } catch (error) {
      console.error('Oväntat fel under batchbearbetning:', error)
      setMessage({
        text: 'Misslyckades med att skapa annonser på grund av ett oväntat fel',
        severity: 'error',
      })
    }
  }

  return {
    handlePublishParkingSpaces: publishParkingSpaces,
    isPending,
    message,
    setMessage,
  }
}
