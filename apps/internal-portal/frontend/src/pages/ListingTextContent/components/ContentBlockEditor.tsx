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
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { leasing } from '@onecore/types'
import { z } from 'zod'

import { isInvalidBlock, isValidUrl } from '../utils/contentBlocks'

export type ContentBlockType = z.infer<typeof leasing.v1.ContentBlockTypeSchema>

// ContentBlock can be either a text block or a link block
export interface ContentBlock {
  id: string
  type: ContentBlockType
  // Text block fields
  content?: string
  // Link block fields
  name?: string
  url?: string
  // UI-only writing hint set by templates, shown as the field placeholder.
  // Never persisted (see toApiBlocks).
  placeholder?: string
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
  // Marks an empty text block as invalid (shown after a failed save attempt).
  showEmptyError?: boolean
  // Collapsed blocks show a one-line summary instead of the edit fields.
  collapsed?: boolean
  onToggleCollapsed?: (id: string) => void
}

export const blockTypeLabels: Record<ContentBlockType, string> = {
  preamble: 'Ingress',
  headline: 'Rubrik',
  subtitle: 'Underrubrik 2',
  text: 'Text',
  bullet_list: 'Punktlista',
  bold_text: 'Underrubrik 3',
  link: 'Länk',
}

// One-line summary of a block's content for the collapsed header.
const blockSummary = (block: ContentBlock): string => {
  if (block.type === 'link') {
    return block.name?.trim() || block.url?.trim() || ''
  }
  return block.content?.trim().replace(/\s+/g, ' ') || ''
}

export const ContentBlockEditor = ({
  block,
  index,
  onUpdate,
  onDelete,
  isDragging = false,
  dragListeners,
  showEmptyError = false,
  collapsed = false,
  onToggleCollapsed,
}: ContentBlockEditorProps) => {
  const isLinkBlock = block.type === 'link'
  const urlValid = isLinkBlock ? isValidUrl(block.url || '') : true
  const contentMissing = showEmptyError && !block.content?.trim()
  // A missing link name is flagged as soon as a URL is typed, and both link
  // fields are flagged after a failed save (mirrors hasInvalidBlock).
  const nameMissing =
    !block.name?.trim() && (showEmptyError || !!block.url?.trim())
  const urlMissing = showEmptyError && !block.url?.trim()
  // A collapsed block hides its fields, so an invalid one is always flagged in
  // the header (not only after a failed save) - saving is blocked by it.
  const collapsedInvalid = collapsed && isInvalidBlock(block)
  const summary = blockSummary(block)
  // In collapsed mode the row is a single line, so controls center on it.
  const controlsMarginTop = collapsed ? 0 : 1

  return (
    <Paper
      elevation={isDragging ? 8 : 2}
      sx={{
        padding: collapsed ? 1 : 2,
        paddingLeft: 2,
        marginBottom: 2,
        backgroundColor: isDragging ? 'grey.100' : 'white',
        opacity: isDragging ? 0.9 : 1,
        transition: 'all 0.2s ease',
        border: '1px solid',
        borderColor: isDragging
          ? 'primary.main'
          : collapsedInvalid
            ? 'error.main'
            : 'grey.300',
      }}
    >
      <Box
        display="flex"
        alignItems={collapsed ? 'center' : 'flex-start'}
        gap={1}
      >
        {/* Drag Handle */}
        <Box
          {...dragListeners}
          sx={{
            display: 'flex',
            alignItems: 'center',
            cursor: 'grab',
            '&:active': { cursor: 'grabbing' },
            color: 'grey.500',
            marginTop: controlsMarginTop,
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
            marginTop: controlsMarginTop,
          }}
        >
          <Typography variant="body2" color="text.secondary" fontWeight="bold">
            {index + 1}
          </Typography>
        </Box>

        {/* Content */}
        {collapsed ? (
          // Collapsed: type label + one-line summary; clicking it expands.
          <Box
            flex={1}
            minWidth={0}
            display="flex"
            alignItems="center"
            gap={1}
            onClick={() => onToggleCollapsed?.(block.id)}
            sx={{ cursor: onToggleCollapsed ? 'pointer' : 'default' }}
          >
            <Typography variant="body2" fontWeight="bold" flexShrink={0}>
              {blockTypeLabels[block.type]}
            </Typography>
            {collapsedInvalid ? (
              <Box
                display="flex"
                alignItems="center"
                gap={0.5}
                color="error.main"
              >
                <ErrorOutlineIcon fontSize="small" />
                <Typography variant="body2" color="error.main">
                  {isLinkBlock ? 'Ofullständig länk' : 'Tomt block'}
                </Typography>
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary" noWrap>
                {summary}
              </Typography>
            )}
          </Box>
        ) : (
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
                <MenuItem value="bold_text">
                  {blockTypeLabels.bold_text}
                </MenuItem>
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
                    error={nameMissing}
                    helperText={nameMissing ? 'Namn krävs' : ''}
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
                    error={!urlValid || urlMissing}
                    helperText={
                      urlMissing
                        ? 'URL krävs'
                        : !urlValid
                          ? 'Ogiltig URL-format'
                          : ''
                    }
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
                  block.placeholder ??
                  (block.type === 'bullet_list'
                    ? 'Skriv en punkt per rad...'
                    : 'Skriv innehåll...')
                }
                error={contentMissing}
                helperText={
                  contentMissing
                    ? 'Innehåll krävs'
                    : block.type === 'bullet_list'
                      ? 'Skriv varje punkt på en ny rad'
                      : ''
                }
              />
            )}
          </Box>
        )}

        {onToggleCollapsed && (
          <IconButton
            onClick={() => onToggleCollapsed(block.id)}
            size="small"
            aria-label={collapsed ? 'Expandera block' : 'Minimera block'}
            sx={{ marginTop: controlsMarginTop }}
          >
            {collapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
          </IconButton>
        )}

        {/* Delete Button */}
        <IconButton
          onClick={() => onDelete(block.id)}
          color="error"
          size="small"
          aria-label="Ta bort block"
          sx={{ marginTop: controlsMarginTop }}
        >
          <DeleteIcon />
        </IconButton>
      </Box>
    </Paper>
  )
}
