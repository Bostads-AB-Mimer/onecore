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
            variant="body1"
            paragraph
            sx={{
              width: '100%',
              fontSize: '1rem',
              fontFamily: 'graphikRegular',
              fontWeight: 700,
              marginBottom: 4,
              lineHeight: 1.6,
              whiteSpace: 'pre-line',
              '&:first-of-type': { paddingTop: 0 },
            }}
          >
            {block.content || 'Ingress...'}
          </Typography>
        )

      case 'headline':
        return (
          <Typography
            key={index}
            variant="h1"
            component="h1"
            gutterBottom
            sx={{
              fontSize: '3rem',
              fontFamily: 'bisonBold',
              fontWeight: 700,
              textTransform: 'uppercase',
              color: '#00a4b3',
              marginBottom: 2,
              whiteSpace: 'pre-line',
            }}
          >
            {block.content || 'Rubrik...'}
          </Typography>
        )

      case 'subtitle':
        return (
          <Typography
            key={index}
            variant="h3"
            component="h3"
            gutterBottom
            sx={{
              fontSize: '1.5rem',
              fontFamily: 'bisonBold',
              fontWeight: 700,
              textTransform: 'uppercase',
              marginBottom: 4,
              whiteSpace: 'pre-line',
            }}
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
            sx={{
              width: '100%',
              fontSize: '1rem',
              fontFamily: 'graphikRegular',
              marginBottom: 4,
              lineHeight: 1.7,
              whiteSpace: 'pre-line',
              '&:first-of-type': { paddingTop: 0 },
            }}
          >
            {block.content || 'Text...'}
          </Typography>
        )

      case 'bullet_list':
        const items = block.content
          .split('\n')
          .filter((line: string) => line.trim() !== '')

        return items.length > 0 ? (
          <Box
            key={index}
            component="ul"
            sx={{
              width: '100%',
              fontSize: '1rem',
              fontFamily: 'graphikRegular',
              marginBottom: 4,
              paddingLeft: 3,
              '&:first-of-type': { paddingTop: 0 },
            }}
          >
            {items.map((item: string, i: number) => (
              <Typography
                key={i}
                component="li"
                variant="body1"
                sx={{
                  fontFamily: 'graphikRegular',
                  fontSize: '1rem',
                  marginBottom: 0.5,
                }}
              >
                {item.trim()}
              </Typography>
            ))}
          </Box>
        ) : (
          <Box
            key={index}
            component="ul"
            sx={{
              width: '100%',
              fontSize: '1rem',
              fontFamily: 'graphikRegular',
              marginBottom: 4,
              paddingLeft: 3,
              '&:first-of-type': { paddingTop: 0 },
            }}
          >
            <Typography
              component="li"
              variant="body1"
              color="text.secondary"
              sx={{
                fontFamily: 'graphikRegular',
                fontSize: '1rem',
              }}
            >
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
            Objektsnummer: {rentalObjectCode}
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

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', marginTop: 1 }}
      >
        Så här kommer annonsen att visas för användare
      </Typography>
    </Box>
  )
}
