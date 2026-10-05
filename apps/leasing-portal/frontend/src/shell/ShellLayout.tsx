import { NavLink, Outlet } from 'react-router-dom'
import { Button, Toaster } from '@onecore/ui'
import { Home, LogOut } from 'lucide-react'

import type { LeasingUser } from '../host/types'
import onecoreLogo from '@onecore/ui/assets/onecore_logo_black.svg'
import { useAuth } from './auth/useAuth'

const navItems = [{ to: '/', label: 'Uthyrning', icon: Home }]

/** The frame around the pages when the portal runs on its own: header, menu, content. */
export function ShellLayout({ user }: { user: LeasingUser }) {
  const { logout } = useAuth()

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 z-30 flex h-14 w-full items-center justify-between border-b bg-background px-4 shadow-sm">
        <div className="flex items-center gap-6">
          <img src={onecoreLogo} alt="ONECore" className="h-7" />
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                    isActive
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent/50'
                  }`
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {user.name ?? user.email ?? user.id}
          </span>
          <Button variant="ghost" size="sm" onClick={logout} title="Logga ut">
            <LogOut className="h-4 w-4" />
            <span className="sr-only">Logga ut</span>
          </Button>
        </div>
      </header>
      <main className="pt-14">
        <Outlet />
      </main>
      <Toaster />
    </div>
  )
}
