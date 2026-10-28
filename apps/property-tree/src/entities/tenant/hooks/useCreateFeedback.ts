import { useMutation } from '@tanstack/react-query'

import {
  type CreateFeedbackRequest,
  type LinearIssue,
  linearService,
} from '@/services/api/core/linearService'

/**
 * Hook to create a new feedback errand in Linear
 */
export const useCreateFeedback = () => {
  return useMutation<LinearIssue, Error, CreateFeedbackRequest>({
    mutationFn: (data) => linearService.createErrand(data),
  })
}
