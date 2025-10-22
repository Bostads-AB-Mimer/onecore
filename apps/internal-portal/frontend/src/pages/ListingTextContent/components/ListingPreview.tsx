import { Box, Paper, Typography } from '@mui/material'
import { leasing } from '@onecore/types'
import { z } from 'zod'

type ContentBlockType = z.infer<typeof leasing.v1.ContentBlockTypeSchema>

interface ContentBlockBase {
  type: ContentBlockType
  content: string
}

interface ListingPreviewProps {
  blocks: ContentBlockBase[]
  rentalObjectCode?: string
}

export const ListingPreview = ({
  blocks,
  rentalObjectCode,
}: ListingPreviewProps) => {
  const renderBlock = (block: ContentBlockBase, index: number) => {
    switch (block.type) {
      case 'preamble':
        return (
          <Typography
            key={index}
            variant="body2"
            paragraph
            sx={{ marginBottom: 2, fontWeight: 'bold', lineHeight: 1.6 }}
          >
            {block.content || 'Ingress...'}
          </Typography>
        )

      case 'headline':
        return (
          <Typography
            key={index}
            variant="h2"
            component="h2"
            gutterBottom
            sx={{ marginBottom: 2 }}
          >
            {block.content || 'Rubrik...'}
          </Typography>
        )

      case 'subtitle':
        return (
          <Typography
            key={index}
            variant="h4"
            component="h3"
            gutterBottom
            sx={{ fontWeight: 600, marginBottom: 1.5, color: 'text.secondary' }}
          >
            {block.content || 'Underrubrik...'}
          </Typography>
        )

      case 'text':
        return (
          <Typography
            key={index}
            variant="body1"
            paragraph
            sx={{ marginBottom: 2, lineHeight: 1.7 }}
          >
            {block.content || 'Text...'}
          </Typography>
        )

      case 'bullet_list':
        const items = block.content
          .split('\n')
          .filter((line: string) => line.trim() !== '')

        return items.length > 0 ? (
          <Box key={index} component="ul" sx={{ marginBottom: 2, paddingLeft: 3 }}>
            {items.map((item: string, i: number) => (
              <Typography key={i} component="li" variant="body1" sx={{ marginBottom: 0.5 }}>
                {item.trim()}
              </Typography>
            ))}
          </Box>
        ) : (
          <Box key={index} component="ul" sx={{ marginBottom: 2, paddingLeft: 3 }}>
            <Typography component="li" variant="body1" color="text.secondary">
              Punktlista...
            </Typography>
          </Box>
        )

      default:
        return null
    }
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Förhandsvisning
      </Typography>
      <Paper
        elevation={2}
        sx={{
          padding: 3,
          backgroundColor: 'grey.50',
          border: '2px solid',
          borderColor: 'grey.300',
          minHeight: 300,
        }}
      >
        {rentalObjectCode && (
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              marginBottom: 2,
              padding: 1,
              backgroundColor: 'info.light',
              borderRadius: 1,
            }}
          >
            Hyresid: {rentalObjectCode}
          </Typography>
        )}

        {blocks.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 200,
            }}
          >
            <Typography color="text.secondary">
              Lägg till innehållsblock för att se förhandsvisning
            </Typography>
          </Box>
        ) : (
          <Box>{blocks.map((block, index) => renderBlock(block, index))}</Box>
        )}
      </Paper>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', marginTop: 1 }}>
        Så här kommer annonsen att visas för användare
      </Typography>
    </Box>
  )
}
