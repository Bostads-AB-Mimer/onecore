import { Box, Stack, Typography, Link } from '@mui/material'

import { blockTypeLabels } from './ContentBlockEditor'
import { ApiContentBlock } from '../utils/contentBlocks'

interface ReadOnlyContentBlocksProps {
  blocks: ApiContentBlock[]
}

// Simple, non-editable rendering of content blocks — no drag-and-drop, no
// inputs. Used to show a market-area's template blocks inside the object
// editor, where they can only be viewed, not changed.
export const ReadOnlyContentBlocks = ({
  blocks,
}: ReadOnlyContentBlocksProps) => (
  <Stack spacing={1.5}>
    {blocks.map((block, index) => (
      <Box key={index}>
        <Typography variant="caption" color="text.secondary">
          {blockTypeLabels[block.type]}
        </Typography>
        {block.type === 'link' ? (
          <Typography>
            {block.name} —{' '}
            <Link href={block.url} target="_blank" rel="noopener noreferrer">
              {block.url}
            </Link>
          </Typography>
        ) : (
          <Typography sx={{ whiteSpace: 'pre-line' }}>
            {block.content}
          </Typography>
        )}
      </Box>
    ))}
  </Stack>
)
