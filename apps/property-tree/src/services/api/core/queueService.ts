import { GET } from './base-api'
import type { QueueData, InterestApplication } from '@/types/api'

export const queueService = {
  /**
   * Get comprehensive queue data for a tenant
   * Currently only parking queue is fully implemented
   * Housing and storage queues will be added when backend endpoints are available
   */
  async getQueueData(contactCode: string): Promise<QueueData> {
    try {
      // Fetch tenant/contact data which includes queue info
      const { data: contactData, error: contactError } = await GET(
        '/contacts/{contactCode}',
        {
          params: { path: { contactCode } },
        }
      )

      if (contactError) {
        console.error('Error fetching contact data:', contactError)
        throw new Error('Failed to fetch contact data')
      }

      // Fetch interest applications with listings
      const { data: applicantsData, error: applicantsError } = await GET(
        '/applicants-with-listings/by-contact-code/{contactCode}',
        {
          params: { path: { contactCode } },
        }
      )

      if (applicantsError) {
        console.error('Error fetching applicants:', applicantsError)
        // Don't throw - we can still show queue points without applications
      }

      // Fetch application profile for housing references
      const { data: profileData, error: profileError } = await GET(
        '/contacts/{contactCode}/application-profile',
        {
          params: { path: { contactCode } },
        }
      )

      if (profileError) {
        console.error('Error fetching application profile:', profileError)
        // Don't throw - this is optional data
      }

      // Debug: Log the profile response structure
      console.log('Profile response:', {
        hasData: !!profileData,
        hasDataContent: !!(profileData as any)?.data?.content,
        hasContent: !!(profileData as any)?.content,
        profileData: JSON.stringify(profileData, null, 2),
      })

      // Extract queue data from contact
      // Note: API types show Record<string, never> but actual response contains waiting lists
      const contact = contactData?.content as any

      const parkingQueue = contact?.parkingSpaceWaitingList
        ? {
            queuePoints: contact.parkingSpaceWaitingList.queuePoints,
            queueTime: contact.parkingSpaceWaitingList.queueTime,
            type: contact.parkingSpaceWaitingList.type,
          }
        : undefined

      const housingQueue = contact?.housingWaitingList
        ? {
            queuePoints: contact.housingWaitingList.queuePoints,
            queueTime: contact.housingWaitingList.queueTime,
            type: contact.housingWaitingList.type,
          }
        : undefined

      const storageQueue = contact?.storageWaitingList
        ? {
            queuePoints: contact.storageWaitingList.queuePoints,
            queueTime: contact.storageWaitingList.queueTime,
            type: contact.storageWaitingList.type,
          }
        : undefined

      // Map applicants to interest applications
      // Note: API returns { applicant: {...}, listing: {...} } structure
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

      // Extract housing references from application profile
      // Note: API types show Record<string, never> but actual response is at content
      const profile = (profileData as any)?.content
      const housingReferences = profile
        ? {
            currentHousingForm: profile.housingType,
            landlord: profile.landlord,
            householdSize: profile.numAdults + profile.numChildren,
            numAdults: profile.numAdults,
            numChildren: profile.numChildren,
            referenceStatus: profile.housingReference?.reviewStatus,
          }
        : undefined

      // Also include raw profile data for editing
      const rawProfile = profile
        ? {
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
        : undefined

      return {
        parking: parkingQueue,
        housing: housingQueue,
        storage: storageQueue,
        interestApplications,
        housingReferences,
        applicationProfile: rawProfile,
      }
    } catch (error) {
      console.error('Error in getQueueData:', error)
      throw error
    }
  },

  /**
   * Get applicants/interest applications for a specific contact
   */
  async getApplicants(contactCode: string): Promise<InterestApplication[]> {
    try {
      const { data, error } = await GET(
        '/applicants-with-listings/by-contact-code/{contactCode}',
        {
          params: { path: { contactCode } },
        }
      )

      if (error) {
        console.error('Error fetching applicants:', error)
        throw new Error('Failed to fetch applicants')
      }

      return (
        (data as any)?.content?.map((item: any) => ({
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
      )
    } catch (error) {
      console.error('Error in getApplicants:', error)
      throw error
    }
  },

  /**
   * Validate tenant eligibility for applying to a parking space
   */
  async validateRentalRules(
    contactCode: string,
    districtCode: string
  ): Promise<any> {
    try {
      const { data, error } = await GET(
        '/applicants/validate-rental-rules/residential-area/{contactCode}/{districtCode}',
        {
          params: { path: { contactCode, districtCode } },
        }
      )

      if (error) {
        console.error('Error validating rental rules:', error)
        throw new Error('Failed to validate rental rules')
      }

      return (data as any)?.content
    } catch (error) {
      console.error('Error in validateRentalRules:', error)
      throw error
    }
  },
}
