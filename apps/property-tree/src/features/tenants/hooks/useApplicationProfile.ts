import { useQuery } from '@tanstack/react-query'

import { GET } from '@/services/api/core/baseApi'

export interface HousingReferences {
  currentHousingForm: string
  landlord: string
  householdSize: number
  numAdults: number
  numChildren: number
  referenceStatus?: string
}

export interface ApplicationProfile {
  numAdults: number
  numChildren: number
  housingType: string
  housingTypeDescription?: string
  landlord: string
  housingReference?: {
    phone: string
    email: string
    reviewStatus: string
    comment?: string
    reasonRejected?: string
    reviewedAt?: string
    reviewedBy?: string
    expiresAt?: string
  }
}

/**
 * Hook to fetch application profile (housing references) for a contact
 *
 * @param contactCode - The tenant's contact code
 * @returns Query result with application profile, loading state, and error
 */
export function useApplicationProfile(contactCode: string | undefined) {
  return useQuery<
    {
      housingReferences?: HousingReferences
      applicationProfile?: ApplicationProfile
    },
    Error
  >({
    queryKey: ['applicationProfile', contactCode],
    queryFn: async () => {
      if (!contactCode) {
        throw new Error('Contact code is required')
      }

      const { data: profileData, error: profileError } = await GET(
        '/contacts/{contactCode}/application-profile',
        {
          params: { path: { contactCode } },
        }
      )

      if (profileError) {
        console.error('Error fetching application profile:', profileError)
        // Return empty object if profile doesn't exist (not an error)
        return {}
      }

      const profile = (profileData as any)?.content

      if (!profile) {
        return {}
      }

      const housingReferences: HousingReferences = {
        currentHousingForm: profile.housingType,
        landlord: profile.landlord,
        householdSize: profile.numAdults + profile.numChildren,
        numAdults: profile.numAdults,
        numChildren: profile.numChildren,
        referenceStatus: profile.housingReference?.reviewStatus,
      }

      const applicationProfile: ApplicationProfile = {
        numAdults: profile.numAdults,
        numChildren: profile.numChildren,
        housingType: profile.housingType,
        housingTypeDescription: profile.housingTypeDescription,
        landlord: profile.landlord,
        housingReference: profile.housingReference
          ? {
              phone: profile.housingReference.phone,
              email: profile.housingReference.email,
              reviewStatus: profile.housingReference.reviewStatus,
              comment: profile.housingReference.comment,
              reasonRejected: profile.housingReference.reasonRejected,
              reviewedAt: profile.housingReference.reviewedAt,
              reviewedBy: profile.housingReference.reviewedBy,
              expiresAt: profile.housingReference.expiresAt,
            }
          : undefined,
      }

      return {
        housingReferences,
        applicationProfile,
      }
    },
    enabled: !!contactCode,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    retry: 2,
  })
}
