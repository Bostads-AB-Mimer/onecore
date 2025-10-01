import { Button } from '@/components/ui/button'
import { Key, Lock, KeyRound } from 'lucide-react'
import { useLocation, Link } from 'react-router-dom'

export function Navigation() {
  const location = useLocation()

  return (
    <nav className="bg-card border-b border-border mb-8">
      <div className="container mx-auto px-4">
        <div className="flex items-center space-x-1">
          <Button
            variant={location.pathname === '/KeyLoan' ? 'default' : 'ghost'}
            asChild
            className="gap-2"
          >
            <Link to="/KeyLoan">
              <KeyRound className="h-4 w-4" />
              Utlåning
            </Link>
          </Button>
          <Button
            variant={location.pathname === '/' ? 'default' : 'ghost'}
            asChild
            className="gap-2"
          >
            <Link to="/Keys">
              <Key className="h-4 w-4" />
              Nycklar
            </Link>
          </Button>
          <Button
            variant={location.pathname === '/key-systems' ? 'default' : 'ghost'}
            asChild
            className="gap-2"
          >
            <Link to="/key-systems">
              <Lock className="h-4 w-4" />
              Låssystem
            </Link>
          </Button>
        </div>
      </div>
    </nav>
  )
}
