import { Button } from './ui/Button'
import { GlobalSearchBar } from './search/GlobalSearchBar'
import { Menu, Search } from 'lucide-react'
import { useAuth } from '@/auth/useAuth'
import { useUser } from '@/auth/useUser'
import { Link } from 'react-router-dom'
import onecoreLogo from '@/components/assets/logos/full/onecore_logo_black.svg'
import { useCommandPalette } from './hooks/useCommandPalette'

export function NavigationBar({ onMenuClick }: { onMenuClick: () => void }) {
  const { open: openSearch } = useCommandPalette()

  const { logout } = useAuth()
  const userState = useUser()

  const handleMenuClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onMenuClick()
  }

  const handleMenuTouch = (e: React.TouchEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onMenuClick()
  }

  const handleSearchClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    openSearch()
  }

  const handleSearchTouch = (e: React.TouchEvent) => {
    e.preventDefault()
    e.stopPropagation()
    openSearch()
  }

  return (
    <nav className="h-14 border-b bg-background backdrop-blur supports-[backdrop-filter]:bg-background/95 fixed top-0 w-full z-[70] shadow-sm">
      <div className="flex h-14 items-center justify-between mx-0 px-[16px]">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleMenuClick}
            onTouchStart={handleMenuTouch}
            className="min-h-[44px] min-w-[44px] relative z-[71] touch-manipulation active:scale-95 transition-transform lg:hidden"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle Menu</span>
          </Button>
          <Link
            to="/"
            className="hover:opacity-80 transition-opacity cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={onecoreLogo} alt="OneCore" className="h-7" />
          </Link>
        </div>

        <div className="mx-48 flex-1 hidden sm:block">
          <GlobalSearchBar />
        </div>

        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            className="sm:hidden min-h-[44px] min-w-[44px] relative z-[71] touch-manipulation active:scale-95 transition-transform"
            onClick={handleSearchClick}
            onTouchStart={handleSearchTouch}
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <Search className="h-5 w-5" />
            <span className="sr-only">Toggle Search</span>
          </Button>
          {userState.tag === 'success' && (
            <div className="flex items-center gap-4">
              <span className="text-sm">{userState.user.name}</span>
              <button
                onClick={logout}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Logga ut
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
