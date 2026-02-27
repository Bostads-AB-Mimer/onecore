import { Box, Paper, Typography, Link } from '@mui/material'
import { leasing } from '@onecore/types'
import { z } from 'zod'

type ContentBlockType = z.infer<typeof leasing.v1.ContentBlockTypeSchema>

interface ContentBlockBase {
  type: ContentBlockType
  // Text block fields
  content?: string
  // Link block fields
  name?: string
  url?: string
}

interface ListingPreviewProps {
  blocks: ContentBlockBase[]
  rentalObjectCode?: string
}

const renderParagraphs = (
  content: string,
  baseSx: Record<string, unknown>,
  placeholder: string
) => {
  if (!content) {
    return <Typography sx={baseSx}>{placeholder}</Typography>
  }

  const paragraphs = content.split('\n')
  return (
    <>
      {paragraphs.map((paragraph, i) => (
        <Typography
          key={i}
          sx={{
            ...baseSx,
            marginBottom: i < paragraphs.length - 1 ? '0.6em' : 0,
          }}
        >
          {paragraph || '\u00A0'}
        </Typography>
      ))}
    </>
  )
}

export const ListingPreview = ({
  blocks,
  rentalObjectCode,
}: ListingPreviewProps) => {
  const renderBlock = (block: ContentBlockBase, index: number) => {
    switch (block.type) {
      case 'preamble':
        return (
          <Box key={index} sx={{ marginBottom: 1 }}>
            {renderParagraphs(
              block.content || '',
              {
                width: '100%',
                fontSize: '1rem',
                fontFamily: 'graphikRegular',
                fontWeight: 700,
                lineHeight: 1.6,
              },
              'Ingress...'
            )}
          </Box>
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
              marginBottom: 0.5,
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
              marginBottom: 0.5,
              whiteSpace: 'pre-line',
            }}
          >
            {block.content || 'Underrubrik...'}
          </Typography>
        )

      case 'text':
        return (
          <Box key={index} sx={{ marginBottom: 1 }}>
            {renderParagraphs(
              block.content || '',
              {
                width: '100%',
                fontSize: '1rem',
                fontFamily: 'graphikRegular',
                lineHeight: 1.7,
              },
              'Text...'
            )}
          </Box>
        )

      case 'bullet_list':
        const items = (block.content || '')
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
              marginBottom: 1,
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
              marginBottom: 1,
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

      case 'link':
        const hasValidLink = block.name?.trim() && block.url?.trim()
        return (
          <Box key={index} sx={{ marginBottom: 1 }}>
            {hasValidLink ? (
              <Link
                href={block.url}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  color: '#951b81',
                  textDecoration: 'underline',
                  fontSize: '1rem',
                  fontFamily: 'graphikRegular',
                  '&:hover': {
                    color: '#7a1669',
                  },
                }}
              >
                {block.name}
              </Link>
            ) : (
              <Typography
                color="text.secondary"
                sx={{
                  fontSize: '1rem',
                  fontFamily: 'graphikRegular',
                  textDecoration: 'underline',
                }}
              >
                Länk...
              </Typography>
            )}
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
