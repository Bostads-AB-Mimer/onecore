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

// ContentBlock can be either a text block or a link block
export interface ContentBlock {
  id: string
  type: ContentBlockType
  // Text block fields
  content?: string
  // Link block fields
  name?: string
  url?: string
}

interface ContentBlockEditorProps {
  block: ContentBlock
  index: number
  onUpdate: (
    id: string,
    field: 'type' | 'content' | 'name' | 'url',
    value: string
  ) => void
  onDelete: (id: string) => void
  isDragging?: boolean
  dragListeners?: Record<string, unknown>
}

const blockTypeLabels: Record<ContentBlockType, string> = {
  preamble: 'Ingress',
  headline: 'Rubrik',
  subtitle: 'Underrubrik',
  text: 'Text',
  bullet_list: 'Punktlista',
  link: 'Länk',
}

const isValidUrl = (url: string): boolean => {
  if (!url.trim()) return true
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

export const ContentBlockEditor = ({
  block,
  index,
  onUpdate,
  onDelete,
  isDragging = false,
  dragListeners,
}: ContentBlockEditorProps) => {
  const isLinkBlock = block.type === 'link'
  const urlValid = isLinkBlock ? isValidUrl(block.url || '') : true

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
              <MenuItem value="preamble">{blockTypeLabels.preamble}</MenuItem>
              <MenuItem value="headline">{blockTypeLabels.headline}</MenuItem>
              <MenuItem value="subtitle">{blockTypeLabels.subtitle}</MenuItem>
              <MenuItem value="text">{blockTypeLabels.text}</MenuItem>
              <MenuItem value="bullet_list">
                {blockTypeLabels.bullet_list}
              </MenuItem>
              <MenuItem value="link">{blockTypeLabels.link}</MenuItem>
            </Select>
          </FormControl>

          {isLinkBlock ? (
            // Link block: show name and URL fields
            <Box display="flex" gap={2}>
              <Box flex={1}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  gutterBottom
                >
                  Namn
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={block.name || ''}
                  onChange={(e) => onUpdate(block.id, 'name', e.target.value)}
                  placeholder="T.ex. Virtuell visning"
                  error={!!block.url?.trim() && !block.name?.trim()}
                  helperText={
                    !!block.url?.trim() && !block.name?.trim()
                      ? 'Namn krävs'
                      : ''
                  }
                />
              </Box>
              <Box flex={2}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  gutterBottom
                >
                  URL
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={block.url || ''}
                  onChange={(e) => onUpdate(block.id, 'url', e.target.value)}
                  placeholder="https://example.com"
                  error={!urlValid}
                  helperText={!urlValid ? 'Ogiltig URL-format' : ''}
                />
              </Box>
            </Box>
          ) : (
            // Text block: show content textarea
            <TextField
              fullWidth
              multiline
              rows={
                block.type === 'headline' || block.type === 'subtitle' ? 2 : 4
              }
              value={block.content || ''}
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
          )}
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
