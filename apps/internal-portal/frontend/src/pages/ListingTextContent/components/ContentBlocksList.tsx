import { Box, Button, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
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
import { useState } from 'react'

interface ContentBlocksListProps {
  blocks: ContentBlock[]
  onBlocksChange: (blocks: ContentBlock[]) => void
}

export const ContentBlocksList = ({
  blocks,
  onBlocksChange,
}: ContentBlocksListProps) => {
  const [activeId, setActiveId] = useState<string | null>(null)

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
      id: `block-${Date.now()}-${Math.random()}`,
      type: 'text',
      content: '',
    }
    onBlocksChange([...blocks, newBlock])
  }

  const handleUpdateBlock = (
    id: string,
    field: 'type' | 'content',
    value: string
  ) => {
    const updatedBlocks = blocks.map((block) =>
      block.id === id ? { ...block, [field]: value } : block
    )
    onBlocksChange(updatedBlocks)
  }

  const handleDeleteBlock = (id: string) => {
    const filteredBlocks = blocks.filter((block) => block.id !== id)
    onBlocksChange(filteredBlocks)
  }

  const activeBlock = blocks.find((block) => block.id === activeId)

  return (
    <Box>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        marginBottom={2}
      >
        <Typography variant="h6">Textelement ({blocks.length})</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddBlock}
          size="small"
        >
          Lägg till
        </Button>
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
            Inga textelement ännu
          </Typography>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={handleAddBlock}
            size="small"
          >
            Lägg till din första text
          </Button>
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
          Tips: Dra i handtaget (⋮⋮) för att ändra ordning på texterna.
          Ordningen påverkar hur annonsen visas.
        </Typography>
      </Box>
    </Box>
  )
}
