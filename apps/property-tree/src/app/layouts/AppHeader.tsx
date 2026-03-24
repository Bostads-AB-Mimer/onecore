import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, Search, Lightbulb, Newspaper, User, LogOut } from 'lucide-react'

import { useAuth } from '@/features/auth'
import { GlobalSearchBar, useCommandPalette } from '@/features/search'

import { ReleaseNotesModal } from '@/widgets/dashboard'

import { useUser } from '@/entities/user'

import onecoreLogo from '@/shared/assets/logos/full/onecore_logo_black.svg'
import { Button } from '@/shared/ui/Button'
import { useFeedbackModal } from '@/shared/hooks/useFeedbackModal'

interface AppHeaderProps {
  onMenuClick: () => void
  hideMobileSearch?: boolean
}

export function AppHeader({ onMenuClick, hideMobileSearch }: AppHeaderProps) {
  const { open: openSearch } = useCommandPalette()
  const { open: openFeedback } = useFeedbackModal()
  const [isReleaseNotesOpen, setIsReleaseNotesOpen] = useState(false)

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

        <div className="flex items-center">
          {!hideMobileSearch && (
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
          )}
          <Button
            variant="ghost"
            onClick={() => setIsReleaseNotesOpen(true)}
            className="min-h-[44px] gap-1.5 hidden sm:flex"
            title="Nyheter"
          >
            <Newspaper className="h-5 w-5" />
            <span>Nyheter</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsReleaseNotesOpen(true)}
            className="min-h-[44px] min-w-[44px] sm:hidden"
            title="Nyheter"
          >
            <Newspaper className="h-5 w-5" />
            <span className="sr-only">Nyheter</span>
          </Button>
          <Button
            variant="ghost"
            onClick={openFeedback}
            className="min-h-[44px] gap-1.5 hidden sm:flex"
            title="Feedback"
          >
            <Lightbulb className="h-5 w-5" />
            <span>Feedback</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={openFeedback}
            className="min-h-[44px] min-w-[44px] sm:hidden"
            title="Feedback"
          >
            <Lightbulb className="h-5 w-5" />
            <span className="sr-only">Feedback</span>
          </Button>
          {userState.tag === 'success' && (
            <>
              <Button
                variant="ghost"
                onClick={logout}
                className="min-h-[44px] gap-1.5 hidden sm:flex"
              >
                <LogOut className="h-4 w-4" />
                <span>Logga ut</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                className="min-h-[44px] min-w-[44px] sm:hidden"
                title="Logga ut"
              >
                <LogOut className="h-5 w-5" />
                <span className="sr-only">Logga ut</span>
              </Button>
              <div className="hidden sm:flex items-center gap-1.5 px-4 py-2">
                <User className="h-4 w-4" />
                <span className="text-sm">{userState.user.name}</span>
              </div>
            </>
          )}
        </div>
      </div>
      <ReleaseNotesModal
        open={isReleaseNotesOpen}
        onOpenChange={setIsReleaseNotesOpen}
      />
    </nav>
  )
}
