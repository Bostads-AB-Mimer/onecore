import { useQuery } from '@tanstack/react-query'
import { GET } from '@/services/api/core/baseApi'
import type { InterestApplication } from '@/services/types'

/**
 * Hook to fetch interest applications (active listings) for a contact
 * This call can be slow depending on the number of applications
 *
 * @param contactCode - The tenant's contact code
 * @returns Query result with interest applications, loading state, and error
 */
export function useInterestApplications(contactCode: string | undefined) {
  return useQuery<InterestApplication[], Error>({
    queryKey: ['interestApplications', contactCode],
    queryFn: async () => {
      if (!contactCode) {
        throw new Error('Contact code is required')
      }

      const { data: applicantsData, error: applicantsError } = await GET(
        '/applicants-with-listings/by-contact-code/{contactCode}',
        {
          params: { path: { contactCode } },
        }
      )

      if (applicantsError) {
        console.error('Error fetching applicants:', applicantsError)
        throw new Error('Failed to fetch interest applications')
      }

      // Map applicants to interest applications
      const interestApplications: InterestApplication[] =
        (applicantsData as any)?.content?.map((item: any) => ({
          id: item.applicant.id,
          contactCode: item.applicant.contactCode,
          applicationDate: item.applicant.applicationDate,
          applicationType: item.applicant.applicationType,
          status: item.applicant.status,
          listingId: item.applicant.listingId,
          queuePoints: item.applicant.queuePoints,
          // Extract listing details for display
          address: item.listing?.rentalObject?.address,
          rentalObjectCode: item.listing?.rentalObjectCode,
          publishedFrom: item.listing?.publishedFrom,
          publishedTo: item.listing?.publishedTo,
          vacantFrom: item.listing?.rentalObject?.vacantFrom,
        })) || []

      return interestApplications
    },
    enabled: !!contactCode,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    retry: 2,
  })
}
