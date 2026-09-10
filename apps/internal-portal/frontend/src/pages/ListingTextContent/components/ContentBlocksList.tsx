import { Box, Button, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import PostAddIcon from '@mui/icons-material/PostAdd'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { SortableItem } from './SortableItem'
import { ContentBlock, ContentBlockEditor } from './ContentBlockEditor'
import { ApplyTemplateMode, TemplateDialog } from './TemplateDialog'
import type { ListingTextTemplate } from '../templates/listingTextTemplates'
import { createBlockId } from '../utils/contentBlocks'
import { buildBlocksFromTemplate } from '../utils/templates'
import { useState } from 'react'

interface ContentBlocksListProps {
  blocks: ContentBlock[]
  onBlocksChange: (blocks: ContentBlock[]) => void
  // When non-empty, an "Använd mall" button lets the user insert a template.
  templates?: ListingTextTemplate[]
  // Room count derived from the rental object, when known.
  suggestedRoomCount?: number
  // Highlights blocks that would fail validation (set after a save attempt).
  showValidationErrors?: boolean
}

export const ContentBlocksList = ({
  blocks,
  onBlocksChange,
  templates = [],
  suggestedRoomCount,
  showValidationErrors = false,
}: ContentBlocksListProps) => {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const hasTemplates = templates.length > 0

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = blocks.findIndex((block) => block.id === active.id)
      const newIndex = blocks.findIndex((block) => block.id === over.id)

      const newBlocks = arrayMove(blocks, oldIndex, newIndex)
      onBlocksChange(newBlocks)
    }

    setActiveId(null)
  }

  const handleAddBlock = () => {
    const newBlock: ContentBlock = {
      id: createBlockId(),
      type: 'text',
      content: '',
    }
    onBlocksChange([...blocks, newBlock])
  }

  const handleApplyTemplate = (
    template: ListingTextTemplate,
    roomCount: number,
    mode: ApplyTemplateMode
  ) => {
    const templateBlocks = buildBlocksFromTemplate(template, roomCount)
    onBlocksChange(
      mode === 'replace' ? templateBlocks : [...blocks, ...templateBlocks]
    )
  }

  const handleUpdateBlock = (
    id: string,
    field: 'type' | 'content' | 'name' | 'url',
    value: string
  ) => {
    const updatedBlocks = blocks.map((block) => {
      if (block.id !== id) return block

      // When changing type, keep what the user has typed: text-style types
      // share `content`, and between text and link the text is carried over
      // (content <-> name) instead of being dropped. A template hint was
      // written for the original type, so it is dropped.
      if (field === 'type') {
        const newType = value as ContentBlock['type']
        const wasLink = block.type === 'link'
        const isLink = newType === 'link'
        const retyped = { ...block, type: newType, placeholder: undefined }

        if (wasLink === isLink) {
          return retyped
        }

        if (isLink) {
          return {
            ...retyped,
            content: undefined,
            name: block.content ?? '',
            url: '',
          }
        }

        return {
          ...retyped,
          content: block.name ?? '',
          name: undefined,
          url: undefined,
        }
      }

      // Regular field update
      return { ...block, [field]: value }
    })
    onBlocksChange(updatedBlocks)
  }

  const handleDeleteBlock = (id: string) => {
    const filteredBlocks = blocks.filter((block) => block.id !== id)
    onBlocksChange(filteredBlocks)
  }

  const activeBlock = blocks.find((block) => block.id === activeId)

  // Shared by the header and the empty state, which differ only in wording
  // and emphasis.
  const renderActions = (
    templateLabel: string,
    addLabel: string,
    addVariant: 'contained' | 'outlined'
  ) => (
    <Box display="flex" gap={1} justifyContent="center">
      {hasTemplates && (
        <Button
          variant="outlined"
          startIcon={<PostAddIcon />}
          onClick={() => setTemplateDialogOpen(true)}
          size="small"
        >
          {templateLabel}
        </Button>
      )}
      <Button
        variant={addVariant}
        startIcon={<AddIcon />}
        onClick={handleAddBlock}
        size="small"
      >
        {addLabel}
      </Button>
    </Box>
  )

  return (
    <Box>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        flexWrap="wrap"
        gap={1}
        marginBottom={2}
      >
        <Typography variant="h6">Innehållsblock ({blocks.length})</Typography>
        {renderActions('Använd mall', 'Lägg till', 'contained')}
      </Box>

      {blocks.length === 0 ? (
        <Box
          sx={{
            padding: 4,
            textAlign: 'center',
            border: '2px dashed',
            borderColor: 'grey.300',
            borderRadius: 2,
            backgroundColor: 'grey.50',
          }}
        >
          <Typography color="text.secondary" gutterBottom>
            Inga innehållsblock ännu
          </Typography>
          {renderActions(
            'Börja från mall',
            'Lägg till ditt första block',
            'outlined'
          )}
        </Box>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={blocks.map((block) => block.id)}
            strategy={verticalListSortingStrategy}
          >
            {blocks.map((block, index) => (
              <SortableItem key={block.id} id={block.id}>
                <ContentBlockEditor
                  block={block}
                  index={index}
                  onUpdate={handleUpdateBlock}
                  onDelete={handleDeleteBlock}
                  showEmptyError={showValidationErrors}
                />
              </SortableItem>
            ))}
          </SortableContext>

          <DragOverlay>
            {activeBlock ? (
              <ContentBlockEditor
                block={activeBlock}
                index={blocks.findIndex((b) => b.id === activeBlock.id)}
                onUpdate={() => {}}
                onDelete={() => {}}
                isDragging
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <Box marginTop={2}>
        <Typography variant="caption" color="text.secondary">
          Tips: Dra i handtaget (⋮⋮) för att ändra ordning på blocken. Ordningen
          påverkar hur annonsen visas. Använd blocktypen "Länk" för att lägga
          till klickbara länkar.
        </Typography>
      </Box>

      {hasTemplates && (
        <TemplateDialog
          open={templateDialogOpen}
          onClose={() => setTemplateDialogOpen(false)}
          templates={templates}
          suggestedRoomCount={suggestedRoomCount}
          hasExistingBlocks={blocks.length > 0}
          onApply={handleApplyTemplate}
        />
      )}
    </Box>
  )
}
