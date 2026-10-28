import { useQuery } from '@tanstack/react-query'

import { releaseNoteService } from '@/services/api/core/releaseNoteService'

export const RELEASE_NOTES_QUERY_KEY = 'releaseNotes'

// Server returns notes sorted: pinned first, then newest.
// Pass enabled: false to hold the request until the notes are needed.
export function useReleaseNotes(
  options: { includeDrafts?: boolean; enabled?: boolean } = {}
) {
  const includeDrafts = options.includeDrafts ?? false

  return useQuery({
    queryKey: [RELEASE_NOTES_QUERY_KEY, { includeDrafts }],
    queryFn: () => releaseNoteService.getAll({ includeDrafts }),
    staleTime: 5 * 60 * 1000,
    enabled: options.enabled ?? true,
  })
}
