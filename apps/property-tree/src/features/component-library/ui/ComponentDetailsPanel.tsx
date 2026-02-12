import { useState } from 'react'

import { ComponentCard, ComponentImageGallery } from '@/entities/component'

import type { Component } from '@/services/types'

import { ComponentModelDocuments } from './ComponentModelDocuments'

interface ComponentDetailsPanelProps {
  component: Component
}

export const ComponentDetailsPanel = ({
  component,
}: ComponentDetailsPanelProps) => {
  const [showGallery, setShowGallery] = useState(false)
  const [showDocuments, setShowDocuments] = useState(false)

  return (
    <>
      <ComponentCard
        component={component}
        onShowImages={() => setShowGallery(true)}
        onShowDocuments={() => setShowDocuments(true)}
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
    </>
  )
}
