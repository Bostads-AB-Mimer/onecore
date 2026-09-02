import { useMutation, useQueryClient } from '@tanstack/react-query'

import { tenantService } from '@/services/api/core'
import type {
  CreateContactError,
  CreateContactResponse,
} from '@/services/api/core/tenantService'

import {
  toCreateContactRequestBody,
  type CreateContactFormValues,
} from '../lib/createContact'

/**
 * Hook to create a new customer in Xpand via core.
 *
 * Invalidates the contact search cache on success so the new customer shows
 * up in search immediately.
 */
export const useCreateContact = () => {
  const queryClient = useQueryClient()

  return useMutation<
    CreateContactResponse,
    CreateContactError,
    CreateContactFormValues
  >({
    mutationFn: (values) =>
      tenantService.createContact(toCreateContactRequestBody(values)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts-search'] })
    },
  })
}
