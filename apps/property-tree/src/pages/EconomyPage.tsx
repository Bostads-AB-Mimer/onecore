import { FileClock, Receipt } from 'lucide-react'
import { Link } from 'react-router-dom'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/ui/Card'

import { routes } from '@/shared/routes'

export function EconomyPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Ekonomi
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link to={routes.economyStrofaktura}>
          <Card className="h-full transition-colors hover:bg-accent">
            <CardHeader className="flex flex-row items-center gap-3">
              <Receipt className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Skapa ströfaktura</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Hantera underlag för ströfakturering
              </CardDescription>
            </CardContent>
          </Card>
        </Link>

        <Link to={routes.economyPlaceholder}>
          <Card className="h-full transition-colors hover:bg-accent">
            <CardHeader className="flex flex-row items-center gap-3">
              <FileClock className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Kommande</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>Kommer snart</CardDescription>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
