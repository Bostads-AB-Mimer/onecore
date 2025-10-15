import {
  Box,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  TextField,
  Typography,
  Paper,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import { leasing } from '@onecore/types'
import { z } from 'zod'

type ContentBlockType = z.infer<typeof leasing.v1.ContentBlockTypeSchema>

export interface ContentBlock {
  id: string
  type: ContentBlockType
  content: string
}

interface ContentBlockEditorProps {
  block: ContentBlock
  index: number
  onUpdate: (id: string, field: 'type' | 'content', value: string) => void
  onDelete: (id: string) => void
  isDragging?: boolean
  dragListeners?: Record<string, any>
}

const blockTypeLabels: Record<ContentBlockType, string> = {
  headline: 'Rubrik',
  subtitle: 'Underrubrik',
  text: 'Text',
  bullet_list: 'Punktlista',
}

export const ContentBlockEditor = ({
  block,
  index,
  onUpdate,
  onDelete,
  isDragging = false,
  dragListeners,
}: ContentBlockEditorProps) => {
  return (
    <Paper
      elevation={isDragging ? 8 : 2}
      sx={{
        padding: 2,
        marginBottom: 2,
        backgroundColor: isDragging ? 'grey.100' : 'white',
        opacity: isDragging ? 0.9 : 1,
        transition: 'all 0.2s ease',
        border: '1px solid',
        borderColor: isDragging ? 'primary.main' : 'grey.300',
      }}
    >
      <Box display="flex" alignItems="flex-start" gap={1}>
        {/* Drag Handle */}
        <Box
          {...dragListeners}
          sx={{
            display: 'flex',
            alignItems: 'center',
            cursor: 'grab',
            '&:active': { cursor: 'grabbing' },
            color: 'grey.500',
            marginTop: 1,
          }}
        >
          <DragIndicatorIcon />
        </Box>

        {/* Block Number */}
        <Box
          sx={{
            minWidth: 40,
            display: 'flex',
            alignItems: 'center',
            marginTop: 1,
          }}
        >
          <Typography variant="body2" color="text.secondary" fontWeight="bold">
            {index + 1}
          </Typography>
        </Box>

        {/* Content */}
        <Box flex={1}>
          <FormControl fullWidth size="small" sx={{ marginBottom: 2 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Blocktyp
            </Typography>
            <Select
              value={block.type}
              onChange={(e) =>
                onUpdate(block.id, 'type', e.target.value as ContentBlockType)
              }
            >
              <MenuItem value="headline">{blockTypeLabels.headline}</MenuItem>
              <MenuItem value="subtitle">{blockTypeLabels.subtitle}</MenuItem>
              <MenuItem value="text">{blockTypeLabels.text}</MenuItem>
              <MenuItem value="bullet_list">
                {blockTypeLabels.bullet_list}
              </MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            multiline
            rows={block.type === 'headline' || block.type === 'subtitle' ? 2 : 4}
            value={block.content}
            onChange={(e) => onUpdate(block.id, 'content', e.target.value)}
            placeholder={
              block.type === 'bullet_list'
                ? 'Skriv en punkt per rad...'
                : 'Skriv innehåll...'
            }
            helperText={
              block.type === 'bullet_list'
                ? 'Skriv varje punkt på en ny rad'
                : ''
            }
          />
        </Box>

        {/* Delete Button */}
        <IconButton
          onClick={() => onDelete(block.id)}
          color="error"
          size="small"
          sx={{ marginTop: 1 }}
        >
          <DeleteIcon />
        </IconButton>
      </Box>
    </Paper>
  )
}
