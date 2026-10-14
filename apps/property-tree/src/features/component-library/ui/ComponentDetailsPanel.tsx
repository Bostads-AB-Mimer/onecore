import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Unplug, Warehouse } from 'lucide-react'

import { ComponentImageGallery, ComponentRow } from '@/entities/component'

import type { Component } from '@/services/types'

import { Button } from '@/shared/ui/Button'

import { componentLibraryHref } from '../lib/componentLibraryLink'
import { ComponentModelDocuments } from './ComponentModelDocuments'
import { DeinstallationDialog } from './DeinstallationDialog'

interface ComponentDetailsPanelProps {
  component: Component
  spaceId: string
}

export const ComponentDetailsPanel = ({
  component,
  spaceId,
}: ComponentDetailsPanelProps) => {
  const [showGallery, setShowGallery] = useState(false)
  const [showDocuments, setShowDocuments] = useState(false)
  const [showDeinstall, setShowDeinstall] = useState(false)

  const libraryHref = componentLibraryHref(component)

  return (
    <>
      <ComponentRow
        component={component}
        onShowImages={() => setShowGallery(true)}
        onShowDocuments={() => setShowDocuments(true)}
        actions={
          <>
            {libraryHref && (
              <Button variant="outline" size="sm" asChild>
                <Link to={libraryHref}>
                  <Warehouse />
                  Komponentbibliotek
                </Link>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="sm:ml-auto"
              onClick={() => setShowDeinstall(true)}
            >
              <Unplug />
              Avinstallera
            </Button>
          </>
        }
      />

      <ComponentImageGallery
        componentId={component.id}
        isOpen={showGallery}
        onClose={() => setShowGallery(false)}
      />

      {component.model?.id && (
        <ComponentModelDocuments
          modelId={component.model.id}
          isOpen={showDocuments}
          onClose={() => setShowDocuments(false)}
        />
      )}

      {showDeinstall && (
        <DeinstallationDialog
          isOpen
          onClose={() => setShowDeinstall(false)}
          component={component}
          spaceId={spaceId}
        />
      )}
    </>
  )
}
