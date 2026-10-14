import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, Unplug, Warehouse } from 'lucide-react'

import {
  ComponentImageGallery,
  ComponentRow,
  formatComponentLabel,
} from '@/entities/component'

import { componentLibraryService } from '@/services/api/core/componentLibraryService'
import type { Component } from '@/services/types'

import { useToast } from '@/shared/hooks/useToast'
import { Button } from '@/shared/ui/Button'

import { useConfirmDialog } from '../hooks/useConfirmDialog'
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
  const { confirm, dialog: confirmDialog } = useConfirmDialog()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const libraryHref = componentLibraryHref(component)

  const isInstalled = !!component.componentInstallations?.some(
    (installation) => !installation.deinstallationDate
  )

  const deleteComponent = useMutation({
    mutationFn: () => componentLibraryService.deleteInstance(component.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['components', spaceId] })
    },
    onError: () => {
      toast({
        title: 'Kunde inte ta bort komponenten',
        description: 'Försök igen om en stund.',
        variant: 'destructive',
      })
    },
  })

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: 'Ta bort komponenten permanent?',
      description: `${formatComponentLabel(component)} tas bort ur registret, med hela sin historik. Det går inte att ångra. Avinstallera i stället om komponenten bara har flyttats eller bytts ut.`,
      confirmLabel: 'Ta bort',
    })
    if (confirmed) deleteComponent.mutate()
  }

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
            <div className="flex flex-wrap gap-2 sm:ml-auto">
              {isInstalled && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeinstall(true)}
                >
                  <Unplug />
                  Avinstallera
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={handleDelete}
                disabled={deleteComponent.isPending}
              >
                <Trash2 />
                Ta bort
              </Button>
            </div>
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

      {confirmDialog}
    </>
  )
}
