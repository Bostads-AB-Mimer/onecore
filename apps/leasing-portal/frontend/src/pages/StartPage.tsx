import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '@onecore/ui'

import { BffRequestError, describeBffError } from '../api/errors'
import { useLeasingHost } from '../host/useLeasingHost'

export function StartPage() {
  const { api, user } = useLeasingHost()

  const profile = useQuery({
    queryKey: ['leasing', 'profile'],
    queryFn: async () => {
      const { data, response } = await api.GET('/auth/profile')
      if (!data) throw new BffRequestError(response.status)
      return data
    },
  })

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Uthyrning</h1>

      <Card>
        <CardHeader>
          <CardTitle>Inloggad</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <p>{user.name ?? user.id}</p>
          {profile.isPending ? (
            <Skeleton className="h-4 w-48" />
          ) : profile.isError ? (
            <p className="text-destructive">
              {describeBffError(profile.error)}
            </p>
          ) : (
            <p className="text-muted-foreground">
              {profile.data.email ?? profile.data.preferred_username ?? ''}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
