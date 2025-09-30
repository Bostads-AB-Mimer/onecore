import { useQuery } from '@tanstack/react-query'

interface UseSearchOptions {
  minLength?: number
  enabled?: boolean
}

export const useSearch = <T>(
  searchFn: (query: string) => Promise<T[]>,
  queryKey: string,
  q: string,
  options: UseSearchOptions = {}
) => {
  const { minLength = 3, enabled = true } = options

  return useQuery<T[]>({
    queryKey: [queryKey, q],
    enabled: enabled && Boolean(q?.length >= minLength),
    queryFn: () => searchFn(q),
    retry: (failureCount: number, error: any) => {
      if (error?.response?.status === 401) {
        return false
      } else {
        return failureCount < 3
      }
    },
  })
}