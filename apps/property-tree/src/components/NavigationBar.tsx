import { Button } from './ui/Button'
import { useState } from 'react'
import { GlobalSearchBar } from './search/GlobalSearchBar'
import { Menu, Search } from 'lucide-react'
import { useAuth } from '@/auth/useAuth'
import { useUser } from '@/auth/useUser'
import onecoreLogo from '@/components/assets/logos/full/onecore_logo_black.svg'

export function NavigationBar({ onMenuClick }: { onMenuClick: () => void }) {
  const [showMobileSearch, setShowMobileSearch] = useState(false)

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

  const handleSearchToggle = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setShowMobileSearch(!showMobileSearch)
  }

  const handleSearchTouch = (e: React.TouchEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setShowMobileSearch(!showMobileSearch)
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
          <img src={onecoreLogo} alt="OneCore" className="h-7" />
        </div>

        <div className="mx-48 flex-1 hidden sm:block">
          <GlobalSearchBar />
        </div>

        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            className="sm:hidden min-h-[44px] min-w-[44px] relative z-[71] touch-manipulation active:scale-95 transition-transform"
            onClick={handleSearchToggle}
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

      {/* Mobile search bar */}
      {showMobileSearch && (
        <div className="px-4 py-2 bg-background sm:hidden border-t relative z-[60]">
          <GlobalSearchBar />
        </div>
      )}
    </nav>
  )
}
