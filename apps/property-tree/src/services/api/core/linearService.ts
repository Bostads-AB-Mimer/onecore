import { resolve } from '@/utils/env'

export interface CreateFeedbackRequest {
  title: string
  description: string
  categoryLabelId: string
}

export interface LinearIssue {
  id: string
  identifier: string
  title: string
  url: string
}

const baseUrl = resolve('VITE_CORE_API_URL', 'http://localhost:5010')

/**
 * Create a new feedback errand in Linear
 * Note: Uses fetch directly since endpoint may not be in generated types yet
 */
async function createErrand(data: CreateFeedbackRequest): Promise<LinearIssue> {
  const response = await fetch(`${baseUrl}/api/createLinearErrand`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    console.error('Error creating Linear errand:', response.statusText)
    throw new Error('Failed to create feedback')
  }

  const result = await response.json()
  if (!result?.content) {
    throw new Error('Invalid response from create errand API')
  }

  return result.content as LinearIssue
}

export const linearService = {
  createErrand,
}
